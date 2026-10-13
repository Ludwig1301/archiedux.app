import Link from "next/link";

export default function SceneCard({ scene, featured = false }) {
  return (
    <article className="surface group overflow-hidden rounded-2xl transition duration-200 hover:-translate-y-1 hover:border-lilac/40">
      <Link
        href={`/tr/sahne/${scene.id}`}
        className="focus-ring block rounded-2xl"
        aria-label={`${scene.title} sahnesini görüntüle`}
      >
        <div className="relative flex aspect-[16/10] flex-col justify-between overflow-hidden bg-[radial-gradient(ellipse_at_75%_35%,rgba(112,88,181,.4),transparent_48%),linear-gradient(135deg,#20232e,#11131a_60%,#1d2229)] p-5">
          <div className="absolute -right-8 -top-12 h-48 w-48 rounded-full border border-white/10" />
          <div className="absolute -right-1 top-3 h-32 w-32 rounded-full border border-white/10" />
          <div className="relative flex items-center justify-between">
            <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs text-zinc-200">
              {scene.category}
            </span>
            <span className="rounded-full bg-black/45 px-2.5 py-1 text-xs font-bold text-white">
              {scene.age}
            </span>
          </div>
          <div className="relative">
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition group-hover:scale-105">
              ▶
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-300">{scene.film}</p>
            <p className="mt-1 text-xl font-bold text-white">{scene.title}</p>
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
