import Link from "next/link";
import SiteHeader from "../../../components/site-header.jsx";
import MimicParty from "../../../components/mimic-party.jsx";
import { GamepadIcon, MicIcon, UsersIcon } from "../../../components/icons.jsx";

export const metadata = {
  title: "Mimic Party — Taklit ve oylama oyunu",
  description:
    "3–5 arkadaşla tek cihazda taklit partisi. Absürt replikleri seslendir, kayıtları anonim dinle ve en iyi taklidi oyla.",
};

export default function MimicPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[calc(100vh-72px)] max-w-6xl px-5 py-10 lg:px-8">
        <Link href="/" className="text-xs font-semibold text-dim transition hover:text-parchment">
          ← Ana sayfa
        </Link>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-sm border border-brass/30 bg-brass/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-brass">
              <GamepadIcon className="h-3.5 w-3.5" />
              Yeni · Canlı taklit partisi
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-parchment sm:text-5xl">
              Mimic <span className="gold-text">Party</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted sm:text-base">
              Absürt bir replik gelir, sırayla en iyi taklidini yaparsın. Kayıtlar anonim dinlenir,
              arkadaşların en iyi taklidi oylar. Tek cihaz, 3–5 oyuncu, bol kahkaha.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="chip">
              <UsersIcon className="h-3.5 w-3.5 text-brass" /> 3–5 oyuncu
            </span>
            <span className="chip">
              <MicIcon className="h-3.5 w-3.5 text-brass" /> 8 sn kayıt
            </span>
            <span className="chip">Tek cihaz</span>
          </div>
        </div>

        <div className="mt-7">
          <MimicParty />
        </div>

        <div className="mt-5 rounded-sm border border-line bg-black/20 px-4 py-3 text-[11px] leading-5 text-dim">
          Mimic Party tarayıcında çalışır. Ses kayıtları cihazından ayrılmaz ve oyun bitince serbest bırakılır.
          Mikrofon izni yalnızca kayıt başlatıldığında istenir.
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-[11px] text-dim lg:px-8">
          <span>© {new Date().getFullYear()} Replik Kulübü · ARCH topluluğu için</span>
          <Link href="/#packs" className="text-brass transition hover:text-parchment">
            Dub pack’leri keşfet ↗
          </Link>
        </div>
      </footer>
    </>
  );
}
