"use client";

import { useMemo, useState } from "react";
import SceneCard from "./scene-card.jsx";
import { HelpIcon } from "./icons.jsx";

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
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="sr-only" htmlFor="scene-search">
          Sahnelerde ara
        </label>
        <input
          id="scene-search"
          className="field focus-ring w-full sm:max-w-sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Sahne, film veya tür ara…"
        />
        <div className="flex flex-wrap gap-1.5" aria-label="Tür filtresi">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
              className={`chip focus-ring ${category === item ? "chip-active" : ""}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {visibleScenes.length ? (
        <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleScenes.map((scene) => (
            <SceneCard key={scene.id} scene={scene} />
          ))}
        </div>
      ) : (
        <div className="surface mt-7 flex flex-col items-center gap-3 p-10 text-center">
          <HelpIcon className="h-6 w-6 text-brass-dim" />
          <p className="text-sm text-muted">Bu aramayla eşleşen sahne bulunamadı.</p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategory("Tümü");
            }}
            className="button-secondary min-h-9 px-3.5 text-xs"
          >
            Filtreleri temizle
          </button>
        </div>
      )}
    </>
  );
}
