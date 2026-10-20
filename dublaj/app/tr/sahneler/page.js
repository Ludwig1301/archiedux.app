import Link from "next/link";
import SiteHeader from "../../../components/site-header.jsx";
import SceneCatalog from "../../../components/scene-catalog.jsx";
import { ArrowRightIcon, FilmIcon, ShieldIcon } from "../../../components/icons.jsx";
import { scenes } from "../../../lib/scenes.js";

export const metadata = {
  title: "Sahneler",
  description:
    "Açık lisanslı dublaj sahnelerini keşfet. Replik sayısına, role ve türe göre filtrele; tek tıkla oda kur.",
};

export default function ScenesPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[calc(100vh-72px)] max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <Link href="/" className="text-xs font-semibold text-dim transition hover:text-parchment">
          ← Ana sayfa
        </Link>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">Katalog</p>
            <h1 className="display mt-2 text-4xl text-parchment sm:text-5xl">Seslendirilecek sahneler</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
              Kaynağı ve lisansı açıkça belirtilen kısa sahneler. Bir sahneyi seç, replikleri incele ve
              arkadaşlarınla odaya başla.
            </p>
          </div>
          <Link href="/tr/oda-kur" className="button-primary">
            Oda kur
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
          {[
            [scenes.length, "oynanabilir sahne"],
            ["CC", "açık lisans"],
            ["8", "oyuncuya kadar"],
          ].map(([value, label]) => (
            <div key={label} className="bg-panel px-4 py-3">
              <p className="text-xl font-bold text-parchment">{value}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-dim">{label}</p>
            </div>
          ))}
        </div>

        <SceneCatalog scenes={scenes} />

        <section className="surface mt-8 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="flex items-center gap-2 text-sm font-bold text-parchment">
                <FilmIcon className="h-4 w-4 text-brass" />
                Katalogda yer alması için
              </p>
              <p className="mt-2 text-xs leading-6 text-muted">
                Yeni sahneler yalnızca kamu malı, açık lisanslı veya hak sahibinden izin alınmışsa
                eklenir. Kaynak, lisans bağlantısı, atıf metni ve varsa altyazı kaynağı yayımdan önce
                doğrulanır.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-brass/25 bg-brass/[0.05] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-brass">
              <ShieldIcon className="h-3.5 w-3.5" />
              Lisans kontrolü
            </span>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-[11px] text-dim lg:px-8">
          <span>© {new Date().getFullYear()} Replik Kulübü · Açık lisanslı medya</span>
          <Link href="/#packs" className="text-brass transition hover:text-parchment">
            Dub pack’leri gör ↗
          </Link>
        </div>
      </footer>
    </>
  );
}
