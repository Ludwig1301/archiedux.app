import Link from "next/link";
import { PlayIcon } from "./icons.jsx";

export default function SceneCard({ scene, featured = false }) {
  const thumbnail = `https://i.ytimg.com/vi/${scene.videoId}/hqdefault.jpg`;
  return (
    <article className="surface group overflow-hidden transition duration-200 hover:-translate-y-1 hover:border-brass/40">
      <Link
        href={`/tr/sahne/${scene.id}`}
        className="focus-ring block"
        aria-label={`${scene.title} sahnesini görüntüle`}
      >
        <div className="relative aspect-video overflow-hidden bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail}
            alt={`${scene.film} — ${scene.title}`}
            loading="lazy"
            className="h-full w-full object-cover opacity-75 transition duration-300 group-hover:scale-105 group-hover:opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />
          <span className="absolute left-3 top-3 rounded-sm border border-line bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-parchment backdrop-blur">
            {scene.category}
          </span>
          <span className="absolute right-3 top-3 rounded-sm bg-black/65 px-2 py-1 text-[10px] font-bold text-brass">
            {scene.age}
          </span>
          <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-sm border border-brass/40 bg-brass/15 text-brass backdrop-blur transition group-hover:scale-110 group-hover:bg-brass group-hover:text-ink">
            <PlayIcon className="h-5 w-5" />
          </span>
          <div className="absolute inset-x-0 bottom-0 p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">{scene.film}</p>
            <p className="mt-1 text-lg font-bold text-parchment">{scene.title}</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-3.5">
          <span className="text-xs text-dim">
            {scene.players} karakter · {scene.duration}
          </span>
          <span className="text-xs font-semibold text-brass">
            {featured ? "Günün sahnesi" : "Sahneyi aç"} ↗
          </span>
        </div>
      </Link>
    </article>
  );
}
