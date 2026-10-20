import Link from "next/link";
import SiteHeader from "../../../components/site-header.jsx";
import RoomSetup from "../../../components/room-setup.jsx";
import { GamepadIcon, LockIcon, ShieldIcon, UsersIcon } from "../../../components/icons.jsx";

export const metadata = {
  title: "Oda kur veya katıl",
  description:
    "Oda koduyla arkadaşlarını dublaj stüdyosuna çağır. Hesap gerekmez; sahneyi seç, rolleri paylaşın ve replikleri birlikte kaydedin.",
};

export default async function CreateRoomPage({ searchParams }) {
  const query = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[calc(100vh-72px)] max-w-6xl px-5 py-10 lg:px-8 lg:py-14">
        <Link href="/" className="text-xs font-semibold text-dim transition hover:text-parchment">
          ← Ana sayfa
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
          <div>
            <p className="eyebrow">Arkadaşlarını çağır</p>
            <h1 className="display mt-3 text-4xl text-parchment sm:text-5xl">
              Bir oda aç,
              <br />
              <span className="gold-text">sahneyi paylaş.</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted">
              Oda kodunu arkadaşlarına gönder. Hesap gerekmez; girdiğin ad yalnızca odada görünür.
              Kurucu rolleri dağıtır, herkes kendi repliğini kaydeder.
            </p>

            <div className="mt-6 space-y-2.5">
              {[
                [UsersIcon, "8 oyuncuya kadar aynı oda"],
                [ShieldIcon, "Kayıtlar oda kapanınca silinir"],
                [LockIcon, "Mikrofon izni yalnızca kayıtta"],
              ].map(([Icon, text]) => (
                <p key={text} className="flex items-center gap-2.5 text-xs text-muted">
                  <span className="grid h-7 w-7 place-items-center rounded-sm border border-brass/20 bg-brass/[0.05] text-brass">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {text}
                </p>
              ))}
            </div>

            <div className="mt-6 border-t border-line pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-dim">Taklit partisi mi?</p>
              <p className="mt-1.5 text-xs leading-5 text-muted">
                Tek cihazda 3–5 kişiyle oynanan Mimic Party’yi dene.
              </p>
              <Link href="/tr/mimic" className="button-secondary mt-3 min-h-9 px-3.5 text-xs">
                <GamepadIcon className="h-4 w-4" />
                Mimic Party
              </Link>
            </div>
          </div>

          <div>
            <RoomSetup initialScene={query?.scene} />
            <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-dim">
              <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass-dim" />
              Kayıtlar geçicidir ve oda çalışırken sunucu belleğinde tutulur. Oda kapanınca tüm ses
              kayıtları silinir.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-[11px] text-dim lg:px-8">
          <span>© {new Date().getFullYear()} Replik Kulübü</span>
          <Link href="/#faq" className="text-brass transition hover:text-parchment">
            Nasıl çalışır? ↗
          </Link>
        </div>
      </footer>
    </>
  );
}
