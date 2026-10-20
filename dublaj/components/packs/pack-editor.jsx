"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe, Lock, Mic, Pause, Play, Plus, Save, Scissors, Trash2, UserPlus } from "lucide-react";
import { CATEGORIES, CHARACTER_COLORS } from "../../lib/packs/types.js";
import { api, forgetEditKey } from "../../lib/packs/client/api.js";
import { AudioEngine, computePeaks } from "../../lib/packs/client/audio-engine.js";
import { clamp, fmtTime, parseTime, round2 } from "../../lib/packs/client/format.js";
import { Timeline } from "./pack-timeline.jsx";
import { AppHeader, Button, IconButton, Notice, Spinner, btn, inputClass } from "./ui.jsx";
import { withBase } from "../../lib/base-path.js";

const NAME_SUGGESTIONS = [
  "Polat Alemdar",
  "Süleyman Çakır",
  "Memati Baş",
  "Abdülhey Çoban",
  "Aslan Akbey",
  "Yılmaz",
  "İlkkan",
  "Ezel",
  "Ramiz Dayı",
  "Cengiz",
  "Aykut Elmas",
  "Anlatıcı",
];

function NumberTime({ value, onCommit, label }) {
  const [text, setText] = useState(value.toFixed(2));
  useEffect(() => setText(value.toFixed(2)), [value]);
  return (
    <input
      aria-label={label}
      className="tabular h-8 w-[4.6rem] rounded-sm bg-panel-2 px-2 text-sm border border-line focus:outline-none focus:ring-2 focus:ring-brass"
      value={text}
      inputMode="decimal"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const v = parseTime(text);
        if (v === null) setText(value.toFixed(2));
        else onCommit(round2(v));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.target.blur();
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          onCommit(round2(value + (e.key === "ArrowUp" ? 0.05 : -0.05)));
        }
      }}
    />
  );
}

export function Editor({ initialPack, meta: initialMeta, canEdit, canPublish }) {
  const [pack, setPack] = useState(initialPack);
  const [meta, setMeta] = useState(initialMeta);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(null);
  const [flash, setFlash] = useState(null);
  const [selectedId, setSelectedId] = useState(initialPack.lines[0]?.lineId ?? null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [peaks, setPeaks] = useState(null);
  const video = useRef(null);
  const stopAt = useRef(null);
  const rowRefs = useRef(new Map());

  const lines = useMemo(() => [...pack.lines].sort((a, b) => a.startTime - b.startTime), [pack.lines]);
  const charById = useMemo(() => new Map(pack.characters.map((c) => [c.id, c])), [pack.characters]);
  const selected = lines.find((l) => l.lineId === selectedId) ?? null;

  const update = useCallback((fn) => {
    setPack((p) => fn(p));
    setDirty(true);
  }, []);
  const updateLine = useCallback(
    (lineId, patch) =>
      update((p) => ({ ...p, lines: p.lines.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)) })),
    [update],
  );

  // Waveform peaks from the isolated vocals.
  useEffect(() => {
    let cancelled = false;
    AudioEngine.get()
      .loadUrl(pack.referenceVocalUrl)
      .then((buf) => !cancelled && setPeaks(computePeaks(buf, 4000)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pack.referenceVocalUrl]);

  // Playhead follows the video (rAF for smoothness; stops at a line's end when playing one line).
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const v = video.current;
      if (v) {
        setTime(v.currentTime);
        if (stopAt.current !== null && v.currentTime >= stopAt.current) {
          v.pause();
          stopAt.current = null;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const seek = useCallback(
    (t) => {
      const v = video.current;
      if (!v) return;
      stopAt.current = null;
      v.currentTime = clamp(t, 0, pack.duration);
    },
    [pack.duration],
  );

  const togglePlay = useCallback(() => {
    const v = video.current;
    if (!v) return;
    stopAt.current = null;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  }, []);

  const playLine = useCallback((l) => {
    const v = video.current;
    if (!v) return;
    setSelectedId(l.lineId);
    v.currentTime = Math.max(0, l.startTime - 0.15);
    stopAt.current = l.endTime + 0.1;
    v.play().catch(() => undefined);
  }, []);

  const addLine = useCallback(() => {
    const start = round2(clamp(time, 0, Math.max(0, pack.duration - 0.5)));
    const end = round2(Math.min(pack.duration, start + 2));
    const id = Math.max(0, ...pack.lines.map((l) => l.lineId)) + 1;
    const characterId = selected?.characterId ?? pack.characters[0].id;
    update((p) => ({
      ...p,
      lines: [...p.lines, { lineId: id, characterId, startTime: start, endTime: end, text: "" }],
    }));
    setSelectedId(id);
  }, [time, pack, selected, update]);

  const splitLine = useCallback(() => {
    if (!selected || time <= selected.startTime + 0.2 || time >= selected.endTime - 0.2) return;
    const words = selected.text.split(" ");
    const ratio = (time - selected.startTime) / (selected.endTime - selected.startTime);
    const cut = Math.round(words.length * ratio);
    const id = Math.max(0, ...pack.lines.map((l) => l.lineId)) + 1;
    const t = round2(time);
    update((p) => ({
      ...p,
      lines: [
        ...p.lines.map((l) =>
          l.lineId === selected.lineId ? { ...l, endTime: t, text: words.slice(0, cut).join(" ") } : l,
        ),
        {
          lineId: id,
          characterId: selected.characterId,
          startTime: t,
          endTime: selected.endTime,
          text: words.slice(cut).join(" "),
        },
      ],
    }));
  }, [selected, time, pack.lines, update]);

  const deleteLine = useCallback(
    (lineId) => {
      update((p) => ({ ...p, lines: p.lines.filter((l) => l.lineId !== lineId) }));
      if (selectedId === lineId) setSelectedId(null);
    },
    [update, selectedId],
  );

  // Keyboard shortcuts (ignored while typing).
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (selected && (e.key === "i" || e.key === "ı" || e.key === "I")) {
        updateLine(selected.lineId, { startTime: round2(Math.min(time, selected.endTime - 0.2)) });
      } else if (selected && (e.key === "o" || e.key === "O")) {
        updateLine(selected.lineId, { endTime: round2(Math.max(time, selected.startTime + 0.2)) });
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const i = lines.findIndex((l) => l.lineId === selectedId);
        const next = lines[clamp(i + (e.key === "ArrowDown" ? 1 : -1), 0, lines.length - 1)];
        if (next) {
          setSelectedId(next.lineId);
          seek(next.startTime);
        }
      } else if (selected && e.key === "Enter") {
        playLine(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, selected, time, updateLine, lines, selectedId, seek, playLine]);

  const firstSelect = useRef(true);
  useEffect(() => {
    if (firstSelect.current) {
      firstSelect.current = false; // don't yank the page down on load
      return;
    }
    if (selectedId !== null) rowRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  /* ---------- characters ---------- */
  const addCharacter = () => {
    const n = pack.characters.length;
    let i = n + 1;
    while (pack.characters.some((c) => c.id === `char_${i}`)) i++;
    update((p) => ({
      ...p,
      characters: [
        ...p.characters,
        { id: `char_${i}`, name: `Karakter ${i}`, color: CHARACTER_COLORS[n % CHARACTER_COLORS.length] },
      ],
    }));
  };
  const updateCharacter = (id, patch) =>
    update((p) => ({ ...p, characters: p.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const removeCharacter = (id) => {
    if (pack.characters.length <= 1) return;
    const fallback = pack.characters.find((c) => c.id !== id).id;
    update((p) => ({
      ...p,
      characters: p.characters.filter((c) => c.id !== id),
      lines: p.lines.map((l) => (l.characterId === id ? { ...l, characterId: fallback } : l)),
    }));
  };

  /* ---------- save / publish ---------- */
  async function persist(kind) {
    setSaving(kind);
    setFlash(null);
    try {
      const status = kind === "publish" ? "published" : kind === "unpublish" ? "draft" : undefined;
      const selectedStart = selected?.startTime;
      const res = await api.save(pack.packId, pack, status);
      setPack(res.pack);
      setMeta(res.meta);
      setDirty(false);
      if (selectedStart !== undefined)
        setSelectedId(res.pack.lines.find((l) => l.startTime === selectedStart)?.lineId ?? null);
      setFlash({
        tone: "info",
        text:
          kind === "publish"
            ? "Yayınlandı. Paket artık Dub Pack’ler sayfasında."
            : kind === "unpublish"
              ? "Yayından kaldırıldı, taslağa döndü."
              : "Kaydedildi.",
      });
    } catch (e) {
      setFlash({ tone: "error", text: e.message });
    } finally {
      setSaving(null);
    }
  }

  async function remove() {
    if (!confirm("Bu paket ve tüm dosyaları kalıcı olarak silinsin mi?")) return;
    try {
      await api.remove(pack.packId);
      forgetEditKey(pack.packId);
      location.href = withBase("/tr/paketler");
    } catch (e) {
      setFlash({ tone: "error", text: e.message });
    }
  }

  const ro = !canEdit;
  const emptyText = lines.filter((l) => !l.text.trim()).length;

  return (
    <>
      <AppHeader>
        <span className="mr-auto hidden items-center gap-3 text-sm sm:inline-flex">
          <span className={`inline-flex items-center gap-1.5 ${meta.status === "published" ? "text-sage-bright" : "text-muted"}`}>
            {meta.status === "published" ? <Globe size={14} /> : <Lock size={14} />}
            {meta.status === "published" ? "Yayında" : "Taslak"}
          </span>
          {dirty && <span className="text-brass-bright">Kaydedilmemiş değişiklikler var</span>}
        </span>
        <Link href={`/tr/paket/${pack.packId}`} className={btn("listen", "md")}>
          <Mic size={16} /> <span className="hidden sm:inline">Dublaj sahnesi</span>
        </Link>
        {canEdit && (
          <Button onClick={() => persist("save")} disabled={!dirty || saving !== null}>
            {saving === "save" ? <Spinner /> : <Save size={16} />} <span className="hidden sm:inline">Kaydet</span>
          </Button>
        )}
        {canPublish &&
          (meta.status === "published" ? (
            <Button variant="ghost" onClick={() => persist("unpublish")} disabled={saving !== null}>
              Yayından kaldır
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => persist("publish")}
              disabled={saving !== null || lines.length === 0}
            >
              {saving === "publish" ? <Spinner /> : <Globe size={16} />}{" "}
              <span className="hidden sm:inline">Kaydet ve </span>yayınla
            </Button>
          ))}
      </AppHeader>

      <main className="packs-ui mx-auto w-full max-w-7xl flex-1 px-5 pb-20 pt-6 lg:px-8">
        {ro && (
          <div className="mb-5">
            <Notice tone="warn">
              Bu paketi sen oluşturmadın; sadece görüntüleyebilirsin. Yönetici anahtarın varsa ana sayfadaki anahtar
              simgesinden gir.
            </Notice>
          </div>
        )}
        {flash && (
          <div className="mb-5" role="status">
            <Notice tone={flash.tone}>{flash.text}</Notice>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <input
                aria-label="Paket başlığı"
                className="min-w-0 flex-1 rounded-sm bg-transparent display text-2xl text-parchment outline-none focus:ring-1 focus:ring-brass-dim sm:text-3xl"
                value={pack.title}
                disabled={ro}
                maxLength={120}
                onChange={(e) => update((p) => ({ ...p, title: e.target.value }))}
              />
              <select
                aria-label="Kategori"
                className={`${inputClass} w-auto`}
                value={pack.category}
                disabled={ro}
                onChange={(e) => update((p) => ({ ...p, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="overflow-hidden rounded-sm border border-brass/20 bg-black shadow-[0_30px_100px_rgba(0,0,0,0.42)]">
              <video
                ref={video}
                src={pack.videoUrl}
                className="mx-auto aspect-video max-h-[52vh] w-full"
                playsInline
                preload="auto"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onClick={togglePlay}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="listen" onClick={togglePlay} aria-label={playing ? "Duraklat" : "Oynat"}>
                {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? "Duraklat" : "Oynat"}
              </Button>
              <span className="tabular px-2 text-sm text-muted">
                {fmtTime(time)} / {fmtTime(pack.duration)}
              </span>
              {canEdit && (
                <div className="ml-auto flex gap-2">
                  <Button size="sm" onClick={addLine}>
                    <Plus size={14} /> Buraya replik ekle
                  </Button>
                  <Button
                    size="sm"
                    onClick={splitLine}
                    disabled={!selected || time <= selected.startTime + 0.2 || time >= selected.endTime - 0.2}
                  >
                    <Scissors size={14} /> Seçiliyi böl
                  </Button>
                </div>
              )}
            </div>

            <Timeline
              duration={pack.duration}
              lines={lines}
              characters={pack.characters}
              selectedId={selectedId}
              currentTime={time}
              peaks={peaks}
              onSeek={seek}
              onSelect={setSelectedId}
              onChangeTiming={(id, s, e) => !ro && updateLine(id, { startTime: s, endTime: e })}
            />
          </div>

          <aside className="space-y-4">
            <section className="surface p-4">
              <div className="flex items-center">
                <h2 className="display text-lg font-bold">Karakterler</h2>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={addCharacter}
                    disabled={pack.characters.length >= 24}
                  >
                    <UserPlus size={14} /> Ekle
                  </Button>
                )}
              </div>
              <datalist id="char-names">
                {NAME_SUGGESTIONS.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <ul className="mt-3 space-y-2">
                {pack.characters.map((c) => {
                  const count = pack.lines.filter((l) => l.characterId === c.id).length;
                  return (
                    <li key={c.id} className="flex items-center gap-2">
                      <label
                        className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-sm ring-1 ring-white/20"
                        style={{ background: c.color }}
                        title="Renk seç"
                      >
                        <input
                          type="color"
                          className="absolute inset-0 cursor-pointer opacity-0"
                          value={c.color}
                          disabled={ro}
                          onChange={(e) => updateCharacter(c.id, { color: e.target.value.toUpperCase() })}
                        />
                      </label>
                      <input
                        list="char-names"
                        className={`${inputClass} h-8`}
                        value={c.name}
                        disabled={ro}
                        maxLength={40}
                        onChange={(e) => updateCharacter(c.id, { name: e.target.value })}
                        aria-label="Karakter adı"
                      />
                      <span className="tabular w-6 text-right text-xs text-dim" title="Replik sayısı">
                        {count}
                      </span>
                      {canEdit && (
                        <IconButton
                          label="Karakteri sil"
                          onClick={() => removeCharacter(c.id)}
                          disabled={pack.characters.length <= 1}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-muted">
                Konuşmacılar otomatik ayrılmaz; her repliğin karakterini listeden seç.
              </p>
            </section>

            <section className="surface p-4 text-sm">
              <h2 className="display text-lg font-bold">Paket bilgisi</h2>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted">
                <dt>Süre</dt>
                <dd className="tabular text-parchment">{fmtTime(pack.duration)}</dd>
                <dt>Replik</dt>
                <dd className="tabular text-parchment">
                  {lines.length}
                  {emptyText > 0 && <span className="text-amber-300"> ({emptyText} metinsiz)</span>}
                </dd>
                {meta.separator && (
                  <>
                    <dt>Ayrıştırma</dt>
                    <dd className="text-parchment">{meta.separator}</dd>
                  </>
                )}
                {meta.transcriber && (
                  <>
                    <dt>Metin</dt>
                    <dd className="text-parchment">{meta.transcriber}</dd>
                  </>
                )}
              </dl>
              {meta.separator === "ffmpeg" && (
                <p className="mt-3 text-xs text-amber-200">
                  Ses yedek yöntemle ayrıldı; arka planda konuşma izleri kalabilir. Sunucuya Demucs kurulursa kalite
                  belirgin artar.
                </p>
              )}
              {canEdit && (
                <button
                  onClick={remove}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs text-red-400 hover:underline"
                >
                  <Trash2 size={12} /> Paketi sil
                </button>
              )}
            </section>
          </aside>
        </div>

        <section className="mt-6">
          <h2 className="display text-xl font-bold tracking-tight">Replikler</h2>
          {lines.length === 0 ? (
            <div className="mt-3 rounded-sm border border-dashed border-line px-6 py-10 text-center text-muted">
              Whisper bu sahnede konuşma bulamadı. Oynatıcıyı konuşmanın başına getirip “Buraya replik ekle” ile başla.
            </div>
          ) : (
            <ol className="mt-3 divide-y divide-line/70 overflow-hidden surface">
              {lines.map((l, idx) => {
                const c = charById.get(l.characterId);
                const sel = l.lineId === selectedId;
                const active = time >= l.startTime && time < l.endTime;
                return (
                  <li
                    key={l.lineId}
                    ref={(el) => {
                      if (el) rowRefs.current.set(l.lineId, el);
                      else rowRefs.current.delete(l.lineId);
                    }}
                    onFocusCapture={() => setSelectedId(l.lineId)}
                    onClick={() => setSelectedId(l.lineId)}
                    className={`grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-3 py-2.5 md:grid-cols-[2rem_11rem_auto_1fr_auto] ${sel ? "bg-brass/10" : active ? "bg-panel-2" : ""}`}
                    style={{ boxShadow: sel ? `inset 3px 0 0 ${c?.color ?? "#8B5CF6"}` : undefined }}
                  >
                    <span className="tabular text-sm text-dim">{idx + 1}</span>
                    <select
                      aria-label="Karakter"
                      className="h-8 rounded-sm bg-panel-2 px-2 text-sm font-semibold border border-line focus:outline-none focus:ring-2 focus:ring-brass"
                      style={{ color: c?.color }}
                      value={l.characterId}
                      disabled={ro}
                      onChange={(e) => updateLine(l.lineId, { characterId: e.target.value })}
                    >
                      {pack.characters.map((ch) => (
                        <option key={ch.id} value={ch.id} style={{ color: ch.color }}>
                          {ch.name}
                        </option>
                      ))}
                    </select>
                    <div className="col-span-2 flex items-center gap-1.5 md:col-span-1">
                      <NumberTime
                        label="Başlangıç"
                        value={l.startTime}
                        onCommit={(v) => !ro && updateLine(l.lineId, { startTime: clamp(v, 0, l.endTime - 0.1) })}
                      />
                      <span className="text-dim">–</span>
                      <NumberTime
                        label="Bitiş"
                        value={l.endTime}
                        onCommit={(v) =>
                          !ro && updateLine(l.lineId, { endTime: clamp(v, l.startTime + 0.1, pack.duration) })
                        }
                      />
                    </div>
                    <input
                      aria-label="Replik metni"
                      className={`col-span-2 h-9 w-full rounded-sm bg-transparent px-2 text-[15px] ring-1 ring-transparent hover:ring-line focus:bg-panel-2 focus:outline-none focus:ring-brass md:col-span-1 ${!l.text ? "placeholder:text-amber-300/70" : ""}`}
                      value={l.text}
                      placeholder="Replik metnini yaz…"
                      disabled={ro}
                      maxLength={600}
                      onChange={(e) => updateLine(l.lineId, { text: e.target.value })}
                    />
                    <div className="col-span-2 flex justify-end gap-1 md:col-span-1">
                      <IconButton label="Repliği oynat" onClick={() => playLine(l)}>
                        <Play size={15} />
                      </IconButton>
                      {canEdit && (
                        <IconButton
                          label="Repliği sil"
                          onClick={() => deleteLine(l.lineId)}
                          className="hover:!text-red-400"
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-3 text-xs text-dim">
            Kısayollar: Boşluk oynat/duraklat, ↑ ↓ replikler arası gez, Enter seçili repliği oynat, I başlangıç, O
            bitiş.
          </p>
        </section>
      </main>
    </>
  );
}
