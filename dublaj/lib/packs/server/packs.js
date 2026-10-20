import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORIES, CHARACTER_COLORS } from "../types.js";
import { config } from "./config.js";
import { withBase } from "../../base-path.js";

const ID_RE = /^[a-z0-9][a-z0-9-]{1,90}$/;

export function isValidPackId(id) {
  return ID_RE.test(id);
}

export function packDir(packId) {
  if (!isValidPackId(packId)) throw new Error("Geçersiz paket kimliği");
  return path.join(config.packsDir, packId);
}

export function packFile(packId, name) {
  return path.join(packDir(packId), name);
}

export function publicUrls(packId) {
  return {
    videoUrl: withBase(`/packs/${packId}/video.mp4`),
    backgroundAudioUrl: withBase(`/packs/${packId}/background.mp3`),
    referenceVocalUrl: withBase(`/packs/${packId}/vocals.mp3`),
  };
}

const TR_MAP = { ç: "c", ğ: "g", ı: "i", i̇: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

export function slugify(input) {
  return (
    input
      .toLocaleLowerCase("tr-TR")
      .replace(/[çğıöşüâîû]|i̇/g, (c) => TR_MAP[c] ?? c)
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "paket"
  );
}

export async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function newPackId(title) {
  const base = slugify(title);
  for (let i = 0; i < 10; i++) {
    const id = `${base}-${crypto.randomBytes(3).toString("hex")}`;
    if (!(await exists(path.join(config.packsDir, id)))) return id;
  }
  throw new Error("Paket kimliği üretilemedi");
}

async function writeJsonAtomic(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

export const readPack = (id) => readJson(packFile(id, "pack.json"));
export const readMeta = (id) => readJson(packFile(id, "meta.json"));
export const readStatus = (id) => readJson(packFile(id, "status.json"));
export const writePack = (pack) => writeJsonAtomic(packFile(pack.packId, "pack.json"), pack);
export const writeMeta = (meta) => writeJsonAtomic(packFile(meta.packId, "meta.json"), meta);
export const writeStatus = (s) => writeJsonAtomic(packFile(s.packId, "status.json"), s);

export async function updateMeta(id, patch) {
  const meta = await readMeta(id);
  if (!meta) throw new Error("Paket bulunamadı");
  const next = { ...meta, ...patch, updatedAt: new Date().toISOString() };
  await writeMeta(next);
  return next;
}

export async function listPacks(filter = {}) {
  let entries = [];
  try {
    entries = await fs.readdir(config.packsDir);
  } catch {
    return [];
  }
  const out = [];
  await Promise.all(
    entries.filter(isValidPackId).map(async (id) => {
      const [pack, meta] = await Promise.all([readPack(id), readMeta(id)]);
      if (!pack || !meta) return;
      if (filter.status && !filter.status.includes(meta.status)) return;
      out.push({ pack, meta });
    }),
  );
  out.sort((a, b) => b.meta.updatedAt.localeCompare(a.meta.updatedAt));
  return out;
}

export async function deletePack(id) {
  await fs.rm(packDir(id), { recursive: true, force: true });
}

/* ---------------- validation of edited packs coming from the editor ---------------- */

const HEX = /^#[0-9a-fA-F]{6}$/;
const CHAR_ID = /^[\w-]{1,32}$/;
const r2 = (n) => Math.round(n * 100) / 100;

export class ValidationError extends Error {}

export function sanitizePack(input, existing) {
  if (!input || typeof input !== "object") throw new ValidationError("Geçersiz paket verisi");
  const p = input;

  const title = String(p.title ?? existing.title)
    .trim()
    .slice(0, 120);
  if (!title) throw new ValidationError("Başlık boş olamaz");
  const category = CATEGORIES.includes(String(p.category)) ? p.category : existing.category;

  const rawChars = Array.isArray(p.characters) ? p.characters.slice(0, 24) : existing.characters;
  const seen = new Set();
  const characters = [];
  rawChars.forEach((c, i) => {
    const id = String(c?.id ?? "");
    if (!CHAR_ID.test(id) || seen.has(id)) return;
    seen.add(id);
    characters.push({
      id,
      name:
        String(c?.name ?? "")
          .trim()
          .slice(0, 40) || `Karakter ${i + 1}`,
      color: HEX.test(String(c?.color)) ? String(c.color).toUpperCase() : CHARACTER_COLORS[i % CHARACTER_COLORS.length],
    });
  });
  if (!characters.length) throw new ValidationError("En az bir karakter gerekli");

  const duration = existing.duration;
  const rawLines = Array.isArray(p.lines) ? p.lines.slice(0, 400) : existing.lines;
  const lines = rawLines
    .map((l) => {
      const start = Math.max(0, Math.min(duration, Number(l?.startTime)));
      const end = Math.max(0, Math.min(duration, Number(l?.endTime)));
      return {
        lineId: 0,
        characterId: seen.has(String(l?.characterId)) ? String(l.characterId) : characters[0].id,
        startTime: r2(start),
        endTime: r2(end),
        text: String(l?.text ?? "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 600),
      };
    })
    .filter((l) => Number.isFinite(l.startTime) && Number.isFinite(l.endTime) && l.endTime - l.startTime >= 0.1)
    .sort((a, b) => a.startTime - b.startTime)
    .map((l, i) => ({ ...l, lineId: i + 1 }));

  return {
    packId: existing.packId,
    title,
    category,
    language: "TR",
    duration: existing.duration,
    ...publicUrls(existing.packId),
    characters,
    lines,
  };
}

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** True when DUBPACK_ADMIN_TOKEN is configured and the request carries it. */
export function isAdmin(req) {
  if (!config.adminToken) return false;
  return safeEqual(req.headers.get("x-admin-token") || "", config.adminToken);
}

export function newEditKey() {
  const key = crypto.randomBytes(24).toString("base64url");
  return { key, hash: hashKey(key) };
}

export function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/** Creator (edit key) or admin may modify a pack. */
export function canEdit(req, meta) {
  if (isAdmin(req)) return true;
  const key = req.headers.get("x-edit-key") || "";
  return Boolean(key && meta.editKeyHash && safeEqual(hashKey(key), meta.editKeyHash));
}

export function publicMeta(meta) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { editKeyHash, ...rest } = meta;
  return rest;
}
