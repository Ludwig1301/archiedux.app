import Link from "next/link";

export default function SceneCard({ scene, featured = false }) {
  const thumbnail = `https://i.ytimg.com/vi/${scene.videoId}/hqdefault.jpg`;
  return (
    <article className="surface group overflow-hidden rounded-2xl transition duration-200 hover:-translate-y-1 hover:border-lilac/40">
      <Link
        href={`/tr/sahne/${scene.id}`}
        className="focus-ring block rounded-2xl"
        aria-label={`${scene.title} sahnesini görüntüle`}
      >
        <div className="relative aspect-video overflow-hidden bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail}
            alt={`${scene.film} — ${scene.title}`}
            loading="lazy"
            className="h-full w-full object-cover opacity-80 transition duration-300 group-hover:scale-105 group-hover:opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/5" />
          <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-xs text-zinc-100 backdrop-blur">
            {scene.category}
          </span>
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white">
            {scene.age}
          </span>
          <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-white/15 text-lg text-white backdrop-blur transition group-hover:scale-110">
            ▶
          </span>
          <div className="absolute inset-x-0 bottom-0 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-300">{scene.film}</p>
            <p className="mt-1 text-lg font-bold text-white">{scene.title}</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-zinc-400">
            {scene.players} karakter · {scene.duration}
          </span>
          <span className="text-sm font-semibold text-lilac">{featured ? "Günün sahnesi" : "Sahneyi aç"} ↗</span>
        </div>
      </Link>
    </article>
  );
}
