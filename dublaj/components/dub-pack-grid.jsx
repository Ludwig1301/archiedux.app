"use client";

import { useMemo, useState } from "react";
import DubPackCard from "./dub-pack-card.jsx";
import { dubPackCategories } from "../lib/dub-packs.js";
import { FilmIcon, SparklesIcon } from "./icons.jsx";

export default function DubPackGrid({ packs, showSearch = false, limit }) {
  const [category, setCategory] = useState("Tümü");
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr");
    const filtered = packs.filter((pack) => {
      const matchesCategory = category === "Tümü" || pack.category === category;
      const haystack = `${pack.title} ${pack.source} ${pack.category} ${pack.tags.join(" ")}`.toLocaleLowerCase("tr");
      return matchesCategory && (!term || haystack.includes(term));
    });
    return typeof limit === "number" ? filtered.slice(0, limit) : filtered;
  }, [category, limit, packs, search]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" aria-label="Dub pack kategorileri">
          {dubPackCategories.map((item) => (
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

        {showSearch && (
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Dub pack ara</span>
            <SparklesIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brass-dim" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Sahne, film veya tür ara…"
              className="field min-h-10 pl-9 text-sm"
            />
          </label>
        )}
      </div>

      {visible.length > 0 ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((pack, index) => (
            <DubPackCard key={pack.id} pack={pack} index={index} />
          ))}
        </div>
      ) : (
        <div className="surface mt-5 flex flex-col items-center gap-3 p-10 text-center">
          <FilmIcon className="h-8 w-8 text-brass-dim" />
          <p className="text-sm text-muted">Bu filtreyle eşleşen dub pack bulunamadı.</p>
          <button
            type="button"
            className="button-secondary min-h-9 text-xs"
            onClick={() => {
              setCategory("Tümü");
              setSearch("");
            }}
          >
            Filtreleri temizle
          </button>
        </div>
      )}
    </div>
  );
}
