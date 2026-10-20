"use client";

/** Recorded takes are kept in IndexedDB so a page refresh never loses a performance. */

const DB = "dubstudio";
const STORE = "takes";

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" }).createIndex("packId", "packId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export async function loadTakes(packId) {
  try {
    return await tx("readonly", (s) => s.index("packId").getAll(packId));
  } catch {
    return [];
  }
}

export async function saveTake(take) {
  try {
    await tx("readwrite", (s) => s.put({ ...take, key: `${take.packId}:${take.lineId}` }));
  } catch {
    /* private mode etc. — takes still live in memory */
  }
}

export async function deleteTake(packId, lineId) {
  try {
    await tx("readwrite", (s) => s.delete(`${packId}:${lineId}`));
  } catch {
    /* ignore */
  }
}
