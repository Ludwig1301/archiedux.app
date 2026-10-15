import Link from "next/link";
import SiteHeader from "../components/site-header.jsx";
import SceneCard from "../components/scene-card.jsx";
import { scenes } from "../lib/scenes.js";

const steps = [
  ["01", "Oda kur", "Bir sahne seç; arkadaşlarına oda kodunu gönder."],
  ["02", "Karakterini al", "Rolünü seç ya da oda kurucusunun atamasını bekle."],
  ["03", "Repliğini kaydet", "Altyazını gör, mikrofonundan sesini kaydet ve tekrar dene."],
  ["04", "Birlikte izle", "Kayıtlar tamamlanınca sahneyi hep birlikte oynatın."],
];

export default function HomePage() {
  const featured = scenes[0];
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-white/[0.06]">
          <div className="pointer-events-none absolute -right-40 top-[-12rem] h-[40rem] w-[40rem] rounded-full bg-lilac/10 blur-[100px]" />
          <div className="pointer-events-none absolute -left-48 bottom-[-20rem] h-[36rem] w-[36rem] rounded-full bg-mint/5 blur-[100px]" />
          <div className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-24 pt-20 md:grid-cols-[1.1fr_.9fr] md:items-center md:py-28 lg:px-8">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-lilac/20 bg-lilac/[0.07] px-3 py-1.5 text-xs font-semibold text-lilac">
                <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                Arkadaşlarınla, aynı sahnede
              </div>
              <h1 className="max-w-3xl text-5xl font-black leading-[1.03] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                Sahneyi seç.
                <br />
                <span className="text-lilac">Sesi siz verin.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">
                Açık lisanslı sahnelerde karakterleri paylaşın, repliklerinizi kaydedin ve ortaya
                çıkan dublajı birlikte izleyin.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/tr/oda-kur" className="button-primary">
                  Ücretsiz oda kur <span aria-hidden="true">↗</span>
                </Link>
                <Link href="/tr/sahneler" className="button-secondary">
                  Sahneleri keşfet
                </Link>
              </div>
              <div className="mt-8 flex items-center gap-3 text-sm text-zinc-500">
                <span className="flex -space-x-2">
                  {["R", "S", "D"].map((letter, index) => (
                    <span
                      key={letter}
                      className={`grid h-8 w-8 place-items-center rounded-full border-2 border-ink text-xs font-bold text-ink ${
                        index === 1 ? "bg-mint" : index === 2 ? "bg-amber-200" : "bg-lilac"
                      }`}
                    >
                      {letter}
                    </span>
                  ))}
                </span>
                <span>Bir oda kodu yeter; kurulum yok.</span>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-lg">
              <div className="absolute -inset-4 rounded-[2rem] bg-lilac/10 blur-2xl" />
              <div className="surface relative overflow-hidden rounded-[1.7rem] p-4 shadow-glow">
                <div className="flex items-center justify-between px-2 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.17em] text-zinc-500">Şimdi sahnede</p>
                    <p className="mt-1 text-sm font-semibold">{featured.title}</p>
                  </div>
                  <span className="flex items-center gap-2 rounded-full bg-mint/10 px-3 py-1.5 text-xs text-mint">
                    <span className="h-1.5 w-1.5 rounded-full bg-mint" /> {featured.players} rol
                  </span>
                </div>
                <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
                  <iframe
                    className="h-full w-full"
                    src={`https://www.youtube-nocookie.com/embed/${featured.videoId}?start=${featured.sourceStart}&end=${featured.sourceEnd}&autoplay=1&mute=1&loop=1&playlist=${featured.videoId}&controls=0&modestbranding=1&playsinline=1&rel=0`}
                    title={`${featured.film} — ${featured.title}`}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                  <span className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/55 px-3 py-1.5 text-xs text-zinc-100">
                    {featured.film} · CC BY 3.0
                  </span>
                </div>
                <div className="mt-4 rounded-xl border border-lilac/20 bg-lilac/[0.06] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-lilac">
                    {featured.characters[0]?.name} · örnek replik
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-200">“{featured.lines[0]?.text}”</p>
                </div>
              </div>
              <Link
                href={`/tr/sahne/${featured.id}`}
                className="surface absolute -bottom-6 -left-8 hidden items-center gap-3 rounded-xl px-4 py-3 sm:flex"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-mint/10 text-mint">▶</span>
                <span>
                  <span className="block text-xs text-zinc-500">Bu sahneyle</span>
                  <span className="text-sm font-semibold">Oda kur</span>
                </span>
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-lilac">Nasıl oynanır?</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Dört adımda kendi sahnen</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-zinc-500">Oda kur, arkadaşlarını çağır, rolünü seslendir. Gerisini birlikte halledersiniz.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([number, title, description]) => (
              <article key={number} className="surface rounded-2xl p-5">
                <span className="text-xs font-bold tracking-widest text-lilac">{number}</span>
                <h3 className="mt-7 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="dublajlar" className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-14 lg:px-8">
          <div className="surface flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">Topluluk dublajları</p>
              <h2 className="mt-2 text-xl font-bold">Kayıt paylaşımı sıradaki adım.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Bu MVP’de sesler sadece oda içinde oynatılır ve kalıcı olarak yayımlanmaz. Herkese açık
                dublaj galerisi, izin ve moderasyon akışı hazırlandıktan sonra açılacak.
              </p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400">Yakında</span>
          </div>
        </section>
        <section id="gunun-sahnesi" className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-20 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-lilac">Açık lisanslı seçkiler</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Bugün neyi seslendiriyoruz?</h2>
            </div>
            <Link href="/tr/sahneler" className="hidden text-sm font-semibold text-lilac hover:text-white sm:block">
              Tüm sahneler →
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {scenes.map((scene, index) => (
              <SceneCard key={scene.id} scene={scene} featured={index === 0} />
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-white/[0.07] px-4 py-3 text-xs leading-5 text-zinc-500">
            Her sahne kartında kaynak ve lisans bilgisi bulunur. Bu MVP yalnızca açık lisanslı veya
            kullanıcı tarafından izinli olarak sağlanan medya için tasarlanmıştır.
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-white/[0.02]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-5 py-14 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">Tamamen ücretsiz</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Hesap yok, ödeme yok, sadece oda kodu.</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Oda kur, arkadaşlarını kodla çağır, rolleri paylaş, mikrofonunla kaydını ver ve dublajı
                birlikte izleyin. Herkese açık.
              </p>
            </div>
            <Link href="/tr/oda-kur" className="button-primary">İlk odanı kur ↗</Link>
          </div>
        </section>

        <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-xs text-zinc-500 lg:px-8">
          <span>© {new Date().getFullYear()} Replik Kulübü · Bağımsız bir topluluk MVP’si</span>
          <span>Medya hakları ve atıflar sahne detaylarında belirtilir.</span>
        </footer>
      </main>
    </>
  );
}
