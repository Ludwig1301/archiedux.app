"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { youTubeId } from "../../lib/packs/client/format.js";
import { CheckIcon, SparklesIcon, UploadIcon, VideoIcon } from "../icons.jsx";
import { CreatePackModal } from "./create-pack-modal.jsx";
import { inputClass } from "./ui.jsx";

const PIPELINE = [
  ["Sahne alınır", "YouTube’dan seçtiğin aralık indirilir ya da yüklediğin MP4 kesilir."],
  ["Ses katmanlara ayrılır", "Oyuncu sesleri müzik ve efektlerden ayrıştırılır."],
  ["Replikler çıkar", "Türkçe konuşma zaman damgalı repliklere çevrilir."],
  ["Sen seslendirirsin", "Replikleri düzelt, karakter ata, kaydet ve MP4 indir."],
];

/** Ana sayfadaki AI Creator kartı: gerçek Dub Pack hattını başlatır. */
export function CreatorPanel() {
  const [modal, setModal] = useState({ open: false });
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);

  return (
    <div className="packs-ui surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-sm border border-brass/25 bg-brass/[0.07] text-brass">
            <SparklesIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-parchment">AI Creator</p>
            <p className="text-[11px] text-dim">YouTube linki ya da MP4 → hazır dub pack</p>
          </div>
        </div>
        <span className="rounded-sm border border-line px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-dim">
          60 sn’ye kadar
        </span>
      </div>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          setModal({ open: true, source: "youtube", url });
        }}
      >
        <label htmlFor="creator-url" className="text-xs font-semibold text-parchment">
          YouTube linki
        </label>
        <div className="mt-1.5 flex gap-2">
          <div className="relative flex-1">
            <Link2 size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brass-dim" />
            <input
              id="creator-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className={`${inputClass} pl-9`}
            />
          </div>
          <button type="submit" className="button-primary min-h-10 px-4 text-xs" disabled={!youTubeId(url)}>
            Başla
          </button>
        </div>
      </form>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) setModal({ open: true, source: "upload", file });
        }}
        className={`mt-3 flex flex-col items-center justify-center gap-2.5 rounded-sm border border-dashed px-5 py-7 text-center transition ${
          dragging ? "border-brass bg-brass/[0.08]" : "border-line bg-black/20 hover:border-brass/35"
        }`}
      >
        <span className="grid h-10 w-10 place-items-center rounded-sm border border-brass/25 bg-brass/[0.06] text-brass">
          <UploadIcon className="h-4 w-4" />
        </span>
        <p className="text-sm font-semibold text-parchment">ya da MP4 dosyanı buraya bırak</p>
        <button
          type="button"
          className="button-secondary min-h-9 px-3 text-xs"
          onClick={() => setModal({ open: true, source: "upload" })}
        >
          <VideoIcon className="h-4 w-4" />
          Dosya seç
        </button>
      </div>

      <ol className="mt-4 space-y-2">
        {PIPELINE.map(([title, description]) => (
          <li key={title} className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-sm border border-sage/40 bg-sage/10 text-sage">
              <CheckIcon className="h-3 w-3" />
            </span>
            <span>
              <span className="block text-xs font-semibold text-parchment">{title}</span>
              <span className="block text-[11px] leading-5 text-dim">{description}</span>
            </span>
          </li>
        ))}
      </ol>

      <CreatePackModal
        open={modal.open}
        initialSource={modal.source}
        initialUrl={modal.url}
        initialFile={modal.file}
        onClose={() => setModal({ open: false })}
      />
    </div>
  );
}
