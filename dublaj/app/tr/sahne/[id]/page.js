import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "../../../../components/site-header.jsx";
import ScenePreview from "../../../../components/scene-preview.jsx";
import { getScene } from "../../../../lib/scenes.js";

export function generateStaticParams() {
  return [{ id: "tears-of-steel-opening" }];
}

export default async function ScenePage({ params }) {
  const { id } = await params;
  const scene = getScene(id);
  if (!scene) notFound();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-screen max-w-7xl px-5 py-10 lg:px-8">
        <Link href="/tr/sahneler" className="text-sm text-zinc-500 hover:text-white">← Sahneler</Link>
        <div className="mt-7 grid gap-8 lg:grid-cols-[1.4fr_.8fr]">
          <div>
            <ScenePreview videoId={scene.videoId} title={`${scene.film} — ${scene.title}`} startAt={scene.sourceStart} />
            <div className="surface mt-4 rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-lilac">{scene.film} · {scene.year}</p>
                  <h1 className="mt-2 text-3xl font-black">{scene.title}</h1>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-300">{scene.age}</span>
              </div>
              <p className="mt-3 text-sm text-zinc-400">{scene.players} karakter · {scene.duration} seslendirme bölümü · {scene.category}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {scene.characters.map((character) => (
                  <span key={character.id} className="rounded-full border border-white/10 px-3 py-1.5 text-sm">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: character.color }} />
                    {character.name}
                  </span>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-lilac/15 bg-lilac/[0.05] p-4">
                <h2 className="text-sm font-bold text-lilac">Atıf ve lisans</h2>
                <p className="mt-2 text-xs leading-5 text-zinc-400">{scene.credit}</p>
                <div className="mt-3 flex gap-4 text-xs font-semibold">
                  <a href={scene.sourceUrl} target="_blank" rel="noreferrer" className="text-lilac hover:text-white">Kaynak sayfası ↗</a>
                  <a href={scene.licenseUrl} target="_blank" rel="noreferrer" className="text-lilac hover:text-white">CC BY 3.0 ↗</a>
                </div>
              </div>
            </div>
          </div>
          <aside className="surface h-fit rounded-2xl p-6">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-lilac">Sahne replikleri</p>
            <h2 className="mt-2 text-xl font-bold">Kimin sesini veriyorsun?</h2>
            <div className="mt-5 space-y-3">
              {scene.lines.map((line) => {
                const character = scene.characters.find((item) => item.id === line.characterId);
                return (
                  <div key={line.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <div className="flex justify-between gap-2 text-xs">
                      <span style={{ color: character?.color }}>{character?.name}</span>
                      <span className="text-zinc-500">{line.start.toFixed(1)}s</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-200">{line.text}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs leading-5 text-zinc-500">Türkçe altyazılar bu açık lisanslı sahne için hazırlanmış bir uyarlamadır.</p>
            <Link href={`/tr/oda-kur?scene=${scene.id}`} className="button-primary mt-6 w-full">Bu sahneyle oda kur</Link>
          </aside>
        </div>
      </main>
    </>
  );
}
