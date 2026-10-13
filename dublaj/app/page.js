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
                    <p className="text-xs uppercase tracking-[0.17em] text-zinc-500">Şimdi odada</p>
                    <p className="mt-1 text-sm font-semibold">Tutkuların peşinde</p>
                  </div>
                  <span className="flex items-center gap-2 rounded-full bg-mint/10 px-3 py-1.5 text-xs text-mint">
                    <span className="h-1.5 w-1.5 rounded-full bg-mint" /> 2 oyuncu
                  </span>
                </div>
                <div className="relative grid aspect-video place-items-center overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_70%_40%,rgba(135,105,220,.45),transparent_45%),linear-gradient(125deg,#252938,#101117_58%,#19211f)]">
                  <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(transparent_96%,rgba(255,255,255,.06)_97%),linear-gradient(90deg,transparent_96%,rgba(255,255,255,.06)_97%)] [background-size:26px_26px]" />
                  <div className="relative grid h-16 w-16 place-items-center rounded-full border border-white/30 bg-white/10 text-2xl backdrop-blur">▶</div>
                  <span className="absolute bottom-4 left-4 rounded-lg bg-black/40 px-3 py-1.5 text-xs text-zinc-200">Tears of Steel · CC BY 3.0</span>
                </div>
                <div className="mt-4 rounded-xl border border-lilac/20 bg-lilac/[0.06] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-lilac">Thom · senin repliğin</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-200">“Celia, tutkularımızın peşinden gitmeliyiz...”</p>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-2/3 rounded-full bg-lilac" />
                  </div>
                </div>
              </div>
              <div className="surface absolute -bottom-6 -left-8 hidden items-center gap-3 rounded-xl px-4 py-3 sm:flex">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-mint/10 text-mint">♫</span>
                <span>
                  <span className="block text-xs text-zinc-500">Kayıt hazır</span>
                  <span className="text-sm font-semibold">Bir daha dinle</span>
                </span>
                <span className="ml-3 text-lilac">▶</span>
              </div>
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

        <section id="uyelik" className="scroll-mt-24 border-y border-white/[0.07] bg-white/[0.02]">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">Arkadaş grubun için</p>
              <h2 className="mt-3 text-3xl font-bold">Basit ve şeffaf üyelik.</h2>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <article className="surface rounded-2xl p-6">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-mint">MVP’de açık</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <h3 className="text-2xl font-black">Ücretsiz</h3>
                  <span className="text-sm text-zinc-500">şimdilik</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-400">Oda kurma, sahne keşfi, rol paylaşımı, mikrofon kaydı ve ortak oynatma.</p>
                <Link href="/tr/oda-kur" className="button-primary mt-5">İlk odanı kur</Link>
              </article>
              <article className="surface rounded-2xl p-6">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-lilac">Geliştirme listesinde</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <h3 className="text-2xl font-black">VIP</h3>
                  <span className="text-sm text-zinc-500">henüz satışta değil</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-400">Ek sahne koleksiyonları ve dublajları yayımlama gibi özellikler ileride değerlendirilecek.</p>
                <span className="mt-5 inline-flex rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-500">Ödeme alınmıyor</span>
              </article>
            </div>
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
