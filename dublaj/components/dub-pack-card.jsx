import Link from "next/link";
import {
  ArrowRightIcon,
  ClockIcon,
  FilmIcon,
  PlayIcon,
  UsersIcon,
} from "./icons.jsx";

function CardBody({ pack, index }) {
  const playable = pack.status === "playable";
  const thumbnail = pack.videoId ? `https://i.ytimg.com/vi/${pack.videoId}/hqdefault.jpg` : null;

  return (
    <>
      <div className="pack-art" style={{ background: pack.art }}>
        {thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-55 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-70"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0d] via-[#0b0b0d]/35 to-transparent" />
        <span className="pack-number">{String(index + 1).padStart(2, "0")}</span>

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <span className="rounded-sm border border-line bg-black/45 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-parchment backdrop-blur">
            {pack.category}
          </span>
          {pack.badge ? (
            <span className="rounded-sm bg-brass px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink">
              {pack.badge}
            </span>
          ) : !playable ? (
            <span className="rounded-sm border border-line bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted backdrop-blur">
              Yakında
            </span>
          ) : null}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-muted">{pack.source}</p>
          <p className="mt-0.5 text-lg font-bold leading-tight text-parchment">{pack.title}</p>
        </div>
      </div>

      <div className="p-4">
        <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-muted">{pack.blurb}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-dim">
          <span className="inline-flex items-center gap-1">
            <FilmIcon className="h-3.5 w-3.5 text-brass-dim" />
            {pack.lines} replik
          </span>
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="h-3.5 w-3.5 text-brass-dim" />
            {pack.players} rol
          </span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="h-3.5 w-3.5 text-brass-dim" />
            {pack.duration}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-sm border border-brass/20 bg-brass/[0.06] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-brass">
            DUB · {pack.language}
          </span>
          {pack.tags.map((tag) => (
            <span key={tag} className="rounded-sm border border-line px-1.5 py-0.5 text-[10px] text-dim">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="text-[11px] text-dim">
            {playable ? "Açık lisans · hemen oyna" : "Katalog hazırlanıyor"}
          </span>
          {playable ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brass">
              <PlayIcon className="h-3.5 w-3.5" />
              Oyna
              <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          ) : (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-dim">Yakında</span>
          )}
        </div>
      </div>
    </>
  );
}

export default function DubPackCard({ pack, index = 0 }) {
  if (pack.status === "playable") {
    return (
      <Link
        href={`/tr/sahne/${pack.sceneId}`}
        className="pack-card focus-ring group block"
        aria-label={`${pack.title} sahnesini aç`}
      >
        <CardBody pack={pack} index={index} />
      </Link>
    );
  }

  return (
    <article className="pack-card group" aria-label={`${pack.title} yakında`}>
      <CardBody pack={pack} index={index} />
    </article>
  );
}
