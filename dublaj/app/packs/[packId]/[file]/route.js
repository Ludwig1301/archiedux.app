import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { Readable } from "node:stream";

import { isValidPackId, packFile } from "../../../../lib/packs/server/packs.js";

/**
 * Serves pack media at the exact URLs stored in pack.json
 * (/packs/<packId>/video.mp4, background.mp3, vocals.mp3, pack.json, thumb.jpg)
 * with HTTP Range support so <video> seeking works in every browser.
 */
const FILES = {
  "video.mp4": "video/mp4",
  "background.mp3": "audio/mpeg",
  "vocals.mp3": "audio/mpeg",
  "pack.json": "application/json; charset=utf-8",
  "thumb.jpg": "image/jpeg",
};

async function serve(req, ctx, headOnly) {
  const { packId, file } = await ctx.params;
  const type = FILES[file];
  if (!type || !isValidPackId(packId)) return new Response("Not found", { status: 404 });
  const full = packFile(packId, file);
  let stat;
  try {
    stat = await fs.stat(full);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const size = stat.size;
  const etag = `"${size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const base = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    ETag: etag,
    "Last-Modified": stat.mtime.toUTCString(),
    // pack.json changes when edited; media files are immutable once processed.
    "Cache-Control": file === "pack.json" ? "no-cache" : "public, max-age=3600",
  };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: base });

  const range = req.headers.get("range");
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (range) {
    const m = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!m || (m[1] === "" && m[2] === "")) {
      return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
    }
    if (m[1] === "") {
      start = Math.max(0, size - Number(m[2]));
    } else {
      start = Number(m[1]);
      end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
    }
    status = 206;
    base["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  base["Content-Length"] = String(end - start + 1);
  if (headOnly || size === 0) return new Response(null, { status, headers: base });

  const stream = createReadStream(full, { start, end });
  req.signal.addEventListener("abort", () => stream.destroy());
  return new Response(Readable.toWeb(stream), { status, headers: base });
}

export function GET(req, ctx) {
  return serve(req, ctx, false);
}

export function HEAD(req, ctx) {
  return serve(req, ctx, true);
}
