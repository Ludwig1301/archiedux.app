import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "../../../../components/site-header.jsx";
import ScenePreview from "../../../../components/scene-preview.jsx";
import {
  ArrowRightIcon,
  ClockIcon,
  FilmIcon,
  MicIcon,
  ShieldIcon,
  UsersIcon,
} from "../../../../components/icons.jsx";
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
      <main className="mx-auto min-h-[calc(100vh-72px)] max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        <Link href="/tr/sahneler" className="text-xs font-semibold text-dim transition hover:text-parchment">
          ← Sahneler
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.85fr]">
          <div>
            <ScenePreview
              videoId={scene.videoId}
              title={`${scene.film} — ${scene.title}`}
              startAt={scene.sourceStart}
            />

            <div className="surface mt-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brass">
                    {scene.film} · {scene.year}
                  </p>
                  <h1 className="display mt-2 text-3xl text-parchment sm:text-4xl">{scene.title}</h1>
                </div>
                <span className="rounded-sm border border-line px-2.5 py-1 text-xs font-semibold text-muted">
                  {scene.age}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="chip">
                  <UsersIcon className="h-3.5 w-3.5 text-brass" /> {scene.players} karakter
                </span>
                <span className="chip">
                  <ClockIcon className="h-3.5 w-3.5 text-brass" /> {scene.duration}
                </span>
                <span className="chip">
                  <FilmIcon className="h-3.5 w-3.5 text-brass" /> {scene.category}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {scene.characters.map((character) => (
                  <span key={character.id} className="chip">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: character.color }}
                    />
                    {character.name}
                  </span>
                ))}
              </div>

              <div className="mt-5 border border-line bg-black/20 p-4">
                <h2 className="flex items-center gap-2 text-sm font-bold text-parchment">
                  <ShieldIcon className="h-4 w-4 text-brass" />
                  Atıf ve lisans
                </h2>
                <p className="mt-2 text-xs leading-5 text-muted">{scene.credit}</p>
                <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold">
                  <a
                    href={scene.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brass transition hover:text-parchment"
                  >
                    Kaynak sayfası ↗
                  </a>
                  <a
                    href={scene.licenseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brass transition hover:text-parchment"
                  >
                    CC BY 3.0 ↗
                  </a>
                </div>
              </div>
            </div>
          </div>

          <aside className="surface h-fit p-5 sm:p-6">
            <p className="eyebrow">Sahne replikleri</p>
            <h2 className="mt-2 text-xl font-bold text-parchment">Kimin sesini veriyorsun?</h2>
            <p className="mt-1.5 text-xs leading-5 text-dim">
              Her replik, videodaki zaman aralığına göre kaydedilir.
            </p>

            <div className="mt-5 space-y-2.5">
              {scene.lines.map((line) => {
                const character = scene.characters.find((item) => item.id === line.characterId);
                return (
                  <div key={line.id} className="border border-line bg-white/[0.02] p-3.5">
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 font-semibold" style={{ color: character?.color }}>
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: character?.color }}
                        />
                        {character?.name}
                      </span>
                      <span className="font-mono text-dim">{line.start.toFixed(1)}s</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-parchment">{line.text}</p>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-5 text-dim">
              <MicIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass-dim" />
              Türkçe altyazılar bu açık lisanslı sahne için hazırlanmış bir uyarlamadır.
            </p>

            <Link href={`/tr/oda-kur?scene=${scene.id}`} className="button-primary mt-5 w-full">
              Bu sahneyle oda kur
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link href="/tr/sahneler" className="button-secondary mt-2 w-full">
              Diğer sahneler
            </Link>
          </aside>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-[11px] text-dim lg:px-8">
          <span>© {new Date().getFullYear()} Replik Kulübü · {scene.film}</span>
          <span>Açık lisanslı sahne · atıf kartta</span>
        </div>
      </footer>
    </>
  );
}
