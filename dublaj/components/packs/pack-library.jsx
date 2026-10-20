"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Clapperboard, Link2, Pencil, Plus, Upload } from "lucide-react";
import { CATEGORIES } from "../../lib/packs/types.js";
import { api, myPackIds } from "../../lib/packs/client/api.js";
import { fmtTime, youTubeId } from "../../lib/packs/client/format.js";
import { withBase } from "../../lib/base-path.js";
import { CreatePackModal } from "./create-pack-modal.jsx";
import { AdminButton } from "./admin-button.jsx";
import { AppHeader, Button, Spinner, btn, inputClass } from "./ui.jsx";

const STATUS_LABEL = {
  processing: "İşleniyor",
  draft: "Taslak",
  published: "Yayında",
  failed: "Hata",
};

function PackCard({ item, mine }) {
  const { pack, meta } = item;
  const ready = meta.status === "draft" || meta.status === "published";
  return (
    <article className="pack-card group flex flex-col">
      <Link
        href={ready ? `/tr/paket/${pack.packId}` : `/tr/paket/${pack.packId}/duzenle`}
        className="focus-ring block"
        aria-label={`${pack.title} sahnesini aç`}
      >
        <div className="pack-art">
          {meta.hasThumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={withBase(`/packs/${pack.packId}/thumb.jpg`)}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover opacity-70 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-85"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-dim">
              <Clapperboard size={28} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0d] via-[#0b0b0d]/30 to-transparent" />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
            <span className="rounded-sm border border-line bg-black/45 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-parchment backdrop-blur">
              {pack.category}
            </span>
            {mine && (
              <span className="rounded-sm bg-brass px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink">
                {STATUS_LABEL[meta.status]}
              </span>
            )}
          </div>
          <span className="tabular absolute bottom-3 right-3 rounded-sm bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-parchment">
            {fmtTime(pack.duration, false)}
          </span>
          <p className="absolute inset-x-0 bottom-0 line-clamp-2 p-3.5 pr-16 text-lg font-bold leading-tight text-parchment">
            {pack.title}
          </p>
        </div>
      </Link>
      <div className="flex items-center gap-3 px-4 py-3 text-[11px] text-dim">
        <span className="tabular">{pack.lines.length} replik</span>
        <span className="tabular">{pack.characters.length} rol</span>
        <span className="ml-auto flex -space-x-1" aria-label={pack.characters.map((c) => c.name).join(", ")}>
          {pack.characters.slice(0, 5).map((c) => (
            <span
              key={c.id}
              title={c.name}
              className="size-3.5 rounded-full ring-2 ring-panel"
              style={{ background: c.color }}
            />
          ))}
        </span>
        {mine && (
          <Link href={`/tr/paket/${pack.packId}/duzenle`} className={btn("ghost", "sm", "-mr-2")}>
            <Pencil size={13} /> Düzenle
          </Link>
        )}
      </div>
    </article>
  );
}

export function Library() {
  const [items, setItems] = useState(null);
  const [mine, setMine] = useState([]);
  const [filter, setFilter] = useState("Tümü");
  const [modal, setModal] = useState({ open: false });
  const [heroUrl, setHeroUrl] = useState("");
  const [error, setError] = useState(null);
  const searchParams = useSearchParams();

  // Menüden gelen ?yeni=youtube|upload (ve isteğe bağlı ?url=…) oluşturma penceresini açar.
  useEffect(() => {
    const yeni = searchParams.get("yeni");
    if (yeni === "youtube" || yeni === "upload") setModal({ open: true, source: yeni, url: searchParams.get("url") || "" });
  }, [searchParams]);

  useEffect(() => {
    api
      .library()
      .then((r) => setItems(r.packs))
      .catch((e) => {
        setError(e.message);
        setItems([]);
      });
    api
      .mine(myPackIds())
      .then((r) => setMine(r.packs.filter((p) => Boolean(p.pack))))
      .catch(() => undefined);
  }, []);

  const shown = useMemo(
    () => (items ?? []).filter((i) => filter === "Tümü" || i.pack.category === filter),
    [items, filter],
  );
  const counts = useMemo(() => {
    const c = { Tümü: items?.length ?? 0 };
    for (const i of items ?? []) c[i.pack.category] = (c[i.pack.category] ?? 0) + 1;
    return c;
  }, [items]);

  return (
    <>
      <AppHeader>
        <AdminButton />
        <Button variant="primary" onClick={() => setModal({ open: true, source: "youtube" })}>
          <Plus size={16} /> Yeni paket
        </Button>
      </AppHeader>

      <main className="packs-ui pb-24">
        <section className="relative overflow-hidden border-b border-line">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_80%_0%,rgba(201,162,39,0.10),transparent_65%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:px-8 lg:py-20">
            <div>
              <p className="eyebrow">Dub Pack’ler</p>
              <h1 className="mt-4 text-4xl font-bold leading-[1.02] tracking-[-0.05em] text-parchment sm:text-5xl xl:text-6xl">
                Türk dizileri ve memeler,
                <br />
                <span className="gold-text">senin sesinle.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-muted">
                Kurtlar Vadisi’nden Gibi’ye, Ezel’den efsane memelere. Orijinal müzik ve efektler altta çalarken
                karakterleri sen seslendir, bitince MP4 olarak indir.
              </p>
            </div>
            <form
              className="surface p-5"
              onSubmit={(e) => {
                e.preventDefault();
                setModal({ open: true, url: heroUrl, source: "youtube" });
              }}
            >
              <label htmlFor="hero-url" className="text-sm font-semibold text-parchment">
                Kendi sahneni dublajla
              </label>
              <p className="mt-1 text-xs text-dim">
                En fazla 60 saniyelik bir aralık seç. Ses ayrıştırma ve Türkçe replikler otomatik çıkar.
              </p>
              <div className="mt-3 flex gap-2">
                <div className="relative flex-1">
                  <Link2
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brass-dim"
                  />
                  <input
                    id="hero-url"
                    value={heroUrl}
                    onChange={(e) => setHeroUrl(e.target.value)}
                    placeholder="YouTube linkini yapıştır"
                    className={`${inputClass} h-11 pl-9`}
                  />
                </div>
                <Button type="submit" variant="primary" size="lg" disabled={!youTubeId(heroUrl)} className="h-11">
                  Başla
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setModal({ open: true, source: "upload" })}
                className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-sm text-sm text-muted hover:text-parchment"
              >
                <Upload size={14} className="text-brass" /> ya da bilgisayarından MP4 yükle
              </button>
            </form>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          {mine.length > 0 && (
            <section className="pt-14">
              <h2 className="display text-2xl text-parchment sm:text-3xl">Paketlerim</h2>
              <p className="mt-2 text-sm text-muted">
                Bu tarayıcıdan oluşturdukların. Taslaklar yalnızca linki olanlara açık.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {mine.map((i) => (
                  <PackCard key={i.pack.packId} item={i} mine />
                ))}
              </div>
            </section>
          )}

          <section className="pt-14">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="display text-2xl text-parchment sm:text-3xl">Yayındaki paketler</h2>
              <div role="tablist" aria-label="Kategori" className="flex flex-wrap gap-1.5">
                {["Tümü", ...CATEGORIES].map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={filter === c}
                    onClick={() => setFilter(c)}
                    className={`chip focus-ring ${filter === c ? "chip-active" : ""}`}
                  >
                    {c}
                    {counts[c] ? <span className="tabular opacity-60">{counts[c]}</span> : null}
                  </button>
                ))}
              </div>
            </div>

            {items === null ? (
              <div className="grid place-items-center py-24 text-muted">
                <Spinner size={22} />
              </div>
            ) : error ? (
              <p className="py-16 text-red-300">{error}</p>
            ) : shown.length === 0 ? (
              <div className="surface mt-6 flex flex-col items-center gap-3 px-6 py-14 text-center">
                <Clapperboard className="h-8 w-8 text-brass-dim" />
                <p className="text-lg font-bold text-parchment">
                  {filter === "Tümü" ? "Henüz yayında paket yok" : `${filter} kategorisinde paket yok`}
                </p>
                <p className="max-w-md text-sm text-muted">
                  Bir YouTube sahnesi ya da MP4 ile ilk paketi oluştur. Düzenleyip yayınladığında burada görünür.
                </p>
                <Button variant="primary" className="mt-2" onClick={() => setModal({ open: true, source: "youtube" })}>
                  <Plus size={16} /> Paket oluştur
                </Button>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {shown.map((i) => (
                  <PackCard key={i.pack.packId} item={i} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <CreatePackModal
        open={modal.open}
        initialUrl={modal.url}
        initialSource={modal.source}
        onClose={() => setModal({ open: false })}
      />
    </>
  );
}
