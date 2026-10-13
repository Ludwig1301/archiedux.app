"use client";

import { useMemo, useState } from "react";
import SceneCard from "./scene-card.jsx";

export default function SceneCatalog({ scenes }) {
  const [category, setCategory] = useState("Tümü");
  const [search, setSearch] = useState("");
  const categories = ["Tümü", ...new Set(scenes.map((scene) => scene.category))];
  const visibleScenes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr");
    return scenes.filter((scene) => {
      const matchesCategory = category === "Tümü" || scene.category === category;
      const matchesSearch =
        !term ||
        `${scene.title} ${scene.film} ${scene.category}`.toLocaleLowerCase("tr").includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [category, scenes, search]);

  return (
    <>
      <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="sr-only" htmlFor="scene-search">Sahnelerde ara</label>
        <input
          id="scene-search"
          className="focus-ring min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm sm:max-w-sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Sahne, film veya tür ara…"
        />
        <div className="flex flex-wrap gap-2" aria-label="Tür filtresi">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
              className={`focus-ring rounded-full border px-4 py-2 text-sm ${
                category === item
                  ? "border-lilac/40 bg-lilac/10 text-lilac"
                  : "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {visibleScenes.length ? (
        <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {visibleScenes.map((scene) => <SceneCard key={scene.id} scene={scene} />)}
        </div>
      ) : (
        <p className="surface mt-7 rounded-2xl p-8 text-center text-sm text-zinc-400">
          Bu aramayla eşleşen sahne bulunamadı.
        </p>
      )}
    </>
  );
}
