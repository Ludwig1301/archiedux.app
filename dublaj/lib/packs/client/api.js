"use client";

import { withBase } from "../../base-path.js";

const KEYS = "dub:editKeys";
const ADMIN = "dub:adminToken";

function readKeys() {
  try {
    return JSON.parse(localStorage.getItem(KEYS) || "{}");
  } catch {
    return {};
  }
}

export function saveEditKey(packId, key) {
  try {
    localStorage.setItem(KEYS, JSON.stringify({ ...readKeys(), [packId]: key }));
  } catch {
    /* storage unavailable */
  }
}

export function forgetEditKey(packId) {
  try {
    const k = readKeys();
    delete k[packId];
    localStorage.setItem(KEYS, JSON.stringify(k));
  } catch {
    /* ignore */
  }
}

export function myPackIds() {
  return Object.keys(readKeys());
}

export function getAdminToken() {
  try {
    return localStorage.getItem(ADMIN) || "";
  } catch {
    return "";
  }
}

export function setAdminToken(token) {
  try {
    if (token) localStorage.setItem(ADMIN, token);
    else localStorage.removeItem(ADMIN);
  } catch {
    /* ignore */
  }
}

export function authHeaders(packId) {
  const h = {};
  const admin = getAdminToken();
  if (admin) h["x-admin-token"] = admin;
  if (packId) {
    const key = readKeys()[packId];
    if (key) h["x-edit-key"] = key;
  }
  return h;
}

export class ApiError extends Error {
  status;
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function json(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `İstek başarısız (${res.status})`, res.status);
  return data;
}

export const api = {
  library: () => fetch(withBase("/api/packs"), { cache: "no-store" }).then((r) => json(r)),
  mine: (ids) =>
    ids.length
      ? fetch(withBase(`/api/packs?ids=${encodeURIComponent(ids.join(","))}`), { cache: "no-store" }).then((r) => json(r))
      : Promise.resolve({ packs: [] }),
  get: (packId) =>
    fetch(withBase(`/api/packs/${packId}`), { cache: "no-store", headers: authHeaders(packId) }).then((r) => json(r)),
  status: (packId) => fetch(withBase(`/api/packs/${packId}/status`), { cache: "no-store" }).then((r) => json(r)),
  save: (packId, pack, status) =>
    fetch(withBase(`/api/packs/${packId}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(packId) },
      body: JSON.stringify({ pack, status }),
    }).then((r) => json(r)),
  remove: (packId) =>
    fetch(withBase(`/api/packs/${packId}`), { method: "DELETE", headers: authHeaders(packId) }).then((r) => json(r)),
  youtubeInfo: (url) => fetch(withBase(`/api/youtube/info?url=${encodeURIComponent(url)}`)).then((r) => json(r)),
};

/** Upload with progress (fetch has no upload progress). */
export function createPack(form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", withBase("/api/packs"));
    const admin = getAdminToken();
    if (admin) xhr.setRequestHeader("x-admin-token", admin);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.packId && data.editKey)
        resolve({ packId: data.packId, editKey: data.editKey });
      else reject(new ApiError(data.error || `Yükleme başarısız (${xhr.status})`, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Ağ hatası — bağlantını kontrol et.", 0));
    xhr.send(form);
  });
}
