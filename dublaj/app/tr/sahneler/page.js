import Link from "next/link";
import SiteHeader from "../../../components/site-header.jsx";
import SceneCatalog from "../../../components/scene-catalog.jsx";
import { scenes } from "../../../lib/scenes.js";

export default function ScenesPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-screen max-w-7xl px-5 py-12 lg:px-8">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white">← Ana sayfa</Link>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-lilac">Keşfet</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">Seslendirilecek sahneler</h1>
            <p className="mt-3 max-w-2xl text-zinc-400">
              Kaynağı ve lisansı açıkça belirtilen kısa sahneler. Herhangi bir katalog girdisi
              lisans doğrulaması olmadan yayımlanmamalıdır.
            </p>
          </div>
          <Link href="/tr/oda-kur" className="button-primary">Oda kur</Link>
        </div>
        <SceneCatalog scenes={scenes} />
        <div className="surface mt-8 rounded-2xl p-6">
          <h2 className="text-lg font-bold">Katalogda yer alması için</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Yeni sahneler ancak kamu malı, açık lisanslı veya hak sahibinden izin alınmışsa
            eklenmelidir. Kaynak, lisans bağlantısı, atıf metni ve varsa altyazı kaynağı
            yayımdan önce doğrulanmalıdır.
          </p>
        </div>
      </main>
    </>
  );
}
