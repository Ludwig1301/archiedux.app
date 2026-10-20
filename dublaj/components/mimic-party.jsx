"use client";

import { useEffect, useRef, useState } from "react";
import VoiceRecorder from "./voice-recorder.jsx";
import {
  CheckIcon,
  GamepadIcon,
  MicIcon,
  MinusIcon,
  PlayIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  StopIcon,
  UsersIcon,
} from "./icons.jsx";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 5;
const STEPS = ["Kurulum", "Kayıt", "Dinle", "Oyla", "Sonuç"];
const STEP_INDEX = { setup: 0, record: 1, review: 2, vote: 3, results: 4 };

const PROMPTS = [
  { text: "Bir korsan gibi “Wi-Fi şifresi neydi?” diye sor.", tag: "Korsan" },
  { text: "Uykulu bir ejderha gibi “günaydın” de.", tag: "Ejderha" },
  { text: "Haber spikeri gibi “kedim klavyeme oturdu” de.", tag: "Haber" },
  { text: "Kötü bir dublör gibi “hayır, o benim babam!” de.", tag: "Dram" },
  { text: "Bir robot gibi “aşk nedir?” diye sor.", tag: "Robot" },
  { text: "Çok kızgın bir güvercin gibi “ekmek nerede?” de.", tag: "Kuş" },
  { text: "Bir opera sanatçısı gibi “market kapandı” de.", tag: "Opera" },
  { text: "Fısıldayan bir casus gibi “plan değişti” de.", tag: "Casus" },
  { text: "Bir çizgi film kötüsü gibi “bu daha bitmedi!” de.", tag: "Kötü" },
  { text: "Aşırı heyecanlı bir spiker gibi “gol!” diye bağır.", tag: "Spor" },
  { text: "Bir filozof gibi “peki ya çorba?” diye sor.", tag: "Filozof" },
  { text: "Şımarık bir kedi gibi “bana mama al” de.", tag: "Kedi" },
];

function letterFor(index) {
  return String.fromCharCode(65 + index);
}

function pickPrompt(previous) {
  const options = PROMPTS.filter((prompt) => prompt.text !== previous?.text);
  return options[Math.floor(Math.random() * options.length)] || PROMPTS[0];
}

function TakePlayer({ take, active, onToggle }) {
  const audioRef = useRef(null);
  const onToggleRef = useRef(onToggle);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    onToggleRef.current = onToggle;
  }, [onToggle]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (active) {
      audio.currentTime = 0;
      audio.play().catch(() => onToggleRef.current?.(null));
    } else {
      audio.pause();
      audio.currentTime = 0;
      setProgress(0);
    }
  }, [active]);

  return (
    <div
      className={`rounded-sm border p-3 transition ${
        active ? "border-brass/50 bg-brass/[0.06]" : "border-line bg-black/20"
      }`}
    >
      <audio
        ref={audioRef}
        src={take.url}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          if (audio.duration) setProgress(Math.min(1, audio.currentTime / audio.duration));
        }}
        onEnded={() => onToggleRef.current?.(null)}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-sm border border-brass/25 bg-brass/[0.07] font-mono text-xs font-bold text-brass">
          {take.label}
        </span>
        <button
          type="button"
          onClick={() => onToggle?.(active ? null : take)}
          className="button-secondary min-h-8 px-2.5 text-[11px]"
        >
          {active ? <StopIcon className="h-3.5 w-3.5" /> : <PlayIcon className="h-3.5 w-3.5" />}
          {active ? "Durdur" : "Dinle"}
        </button>
      </div>
      <div className="meter-track mt-2 h-1">
        <div className="meter-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-dim">
        {active ? "Anonim kayıt oynatılıyor…" : "Kimin sesi olduğu gizli."}
      </p>
    </div>
  );
}

export default function MimicParty() {
  const [phase, setPhase] = useState("setup");
  const [names, setNames] = useState(["", "", ""]);
  const [scores, setScores] = useState({});
  const [round, setRound] = useState(1);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [takes, setTakes] = useState([]);
  const [anonymousTakes, setAnonymousTakes] = useState([]);
  const [recordIndex, setRecordIndex] = useState(0);
  const [currentTake, setCurrentTake] = useState(null);
  const [activeTake, setActiveTake] = useState(null);
  const [votes, setVotes] = useState([]);
  const [voteIndex, setVoteIndex] = useState(0);
  const [voteCounts, setVoteCounts] = useState({});
  const [roundWinners, setRoundWinners] = useState([]);
  const [error, setError] = useState("");

  const urlsRef = useRef(new Set());

  useEffect(() => () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
  }, []);

  function clearRoundUrls() {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
  }

  function revokeUrl(url) {
    if (!url) return;
    if (urlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      urlsRef.current.delete(url);
    }
  }

  function updateName(index, value) {
    setNames((current) => current.map((name, itemIndex) => (itemIndex === index ? value : name)));
  }

  function addPlayer() {
    if (names.length >= MAX_PLAYERS) return;
    setNames((current) => [...current, ""]);
  }

  function removePlayer(index) {
    if (names.length <= MIN_PLAYERS) return;
    setNames((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function startGame() {
    const trimmed = names.map((name) => name.trim());
    if (trimmed.some((name) => name.length < 2)) {
      setError("Her oyuncu için en az 2 karakterlik bir ad gir.");
      return;
    }
    if (new Set(trimmed.map((name) => name.toLocaleLowerCase("tr"))).size !== trimmed.length) {
      setError("Oyuncu adları birbirinden farklı olmalı.");
      return;
    }

    clearRoundUrls();
    setNames(trimmed);
    setScores(Object.fromEntries(trimmed.map((name) => [name, 0])));
    setRound(1);
    setPrompt(pickPrompt());
    setTakes([]);
    setAnonymousTakes([]);
    setVotes([]);
    setVoteCounts({});
    setRoundWinners([]);
    setRecordIndex(0);
    setVoteIndex(0);
    setCurrentTake(null);
    setActiveTake(null);
    setError("");
    setPhase("record");
  }

  function handleRecorded(result) {
    if (currentTake?.url) revokeUrl(currentTake.url);
    if (!result) {
      setCurrentTake(null);
      return;
    }
    const url = URL.createObjectURL(result.blob);
    urlsRef.current.add(url);
    setCurrentTake({ blob: result.blob, url });
  }

  function advanceRecording() {
    if (!currentTake) return;
    const nextTakes = [
      ...takes,
      { player: names[recordIndex], blob: currentTake.blob, url: currentTake.url },
    ];
    setTakes(nextTakes);
    setCurrentTake(null);

    if (recordIndex + 1 >= names.length) {
      const shuffled = [...nextTakes];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
      }
      setAnonymousTakes(shuffled.map((take, index) => ({ ...take, label: letterFor(index) })));
      setActiveTake(null);
      setPhase("review");
    } else {
      setRecordIndex(recordIndex + 1);
    }
  }

  function toggleTake(take) {
    if (!take) {
      setActiveTake(null);
      return;
    }
    setActiveTake((current) => (current === take.label ? null : take.label));
  }

  function goVote() {
    setActiveTake(null);
    setVotes([]);
    setVoteCounts({});
    setRoundWinners([]);
    setVoteIndex(0);
    setError("");
    setPhase("vote");
  }

  function finishVoting(nextVotes) {
    const counts = {};
    anonymousTakes.forEach((take) => {
      counts[take.label] = 0;
    });
    nextVotes.forEach((vote) => {
      counts[vote.label] = (counts[vote.label] || 0) + 1;
    });

    setVoteCounts(counts);
    const max = Math.max(0, ...Object.values(counts));
    const winners = anonymousTakes
      .filter((take) => counts[take.label] === max)
      .map((take) => ({ player: take.player, label: take.label, votes: counts[take.label] }));
    setRoundWinners(winners);

    if (max > 0) {
      setScores((current) => {
        const next = { ...current };
        winners.forEach((winner) => {
          next[winner.player] = (next[winner.player] || 0) + 1;
        });
        return next;
      });
    }

    setPhase("results");
  }

  function castVote(take) {
    const voter = names[voteIndex];
    if (!voter) return;
    if (take.player === voter) {
      setError("Kendi kaydına oy veremezsin. Başka bir kaydı seç.");
      return;
    }
    const nextVotes = [...votes, { voter, label: take.label, player: take.player }];
    setVotes(nextVotes);
    setError("");
    if (voteIndex + 1 >= names.length) {
      finishVoting(nextVotes);
    } else {
      setVoteIndex(voteIndex + 1);
    }
  }

  function nextRound() {
    clearRoundUrls();
    setRound((current) => current + 1);
    setPrompt((current) => pickPrompt(current));
    setTakes([]);
    setAnonymousTakes([]);
    setVotes([]);
    setVoteCounts({});
    setRoundWinners([]);
    setRecordIndex(0);
    setVoteIndex(0);
    setCurrentTake(null);
    setActiveTake(null);
    setError("");
    setPhase("record");
  }

  function restartGame() {
    clearRoundUrls();
    setScores({});
    setRound(1);
    setTakes([]);
    setAnonymousTakes([]);
    setVotes([]);
    setVoteCounts({});
    setRoundWinners([]);
    setRecordIndex(0);
    setVoteIndex(0);
    setCurrentTake(null);
    setActiveTake(null);
    setError("");
    setPhase("setup");
  }

  const stepIndex = STEP_INDEX[phase];
  const scoreboard = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <ol className="grid grid-cols-5 gap-1.5" aria-label="Oyun adımları">
        {STEPS.map((step, index) => {
          const done = index < stepIndex;
          const active = index === stepIndex;
          return (
            <li
              key={step}
              className={`rounded-sm border px-1 py-2 text-center transition ${
                active
                  ? "border-brass/55 bg-brass/[0.08] text-brass"
                  : done
                    ? "border-sage/30 bg-sage/[0.04] text-sage"
                    : "border-line bg-black/20 text-dim"
              }`}
            >
              <span className="block font-mono text-[9px] font-bold">{String(index + 1).padStart(2, "0")}</span>
              <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wider sm:text-[10px]">{step}</span>
            </li>
          );
        })}
      </ol>

      {phase === "setup" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <section className="surface p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Mimic Party</p>
                <h2 className="mt-1 text-xl font-bold text-parchment">Oyuncuları kur</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-dim">
                <UsersIcon className="h-3.5 w-3.5" /> {names.length}/{MAX_PLAYERS}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">
              Tek cihazda sırayla oynanır. Herkes bir repliği taklit eder, kayıtlar anonim dinlenir ve oylanır.
            </p>

            <div className="mt-4 space-y-2">
              {names.map((name, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-brass/25 bg-brass/[0.06] font-mono text-xs font-bold text-brass">
                    {index + 1}
                  </span>
                  <input
                    value={name}
                    onChange={(event) => updateName(index, event.target.value)}
                    className="field min-h-10 text-sm"
                    placeholder={`Oyuncu ${index + 1}`}
                    maxLength={24}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => removePlayer(index)}
                    disabled={names.length <= MIN_PLAYERS}
                    className="button-ghost min-h-9 px-2 text-dim disabled:opacity-30"
                    aria-label={`${index + 1}. oyuncuyu kaldır`}
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {names.length < MAX_PLAYERS && (
              <button type="button" onClick={addPlayer} className="button-ghost mt-2 min-h-9 text-xs">
                <PlusIcon className="h-4 w-4" />
                Oyuncu ekle
              </button>
            )}

            {error && (
              <p role="alert" className="mt-3 rounded-sm border border-rust/35 bg-rust/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <button type="button" onClick={startGame} className="button-primary mt-4 min-h-11 w-full">
              <GamepadIcon className="h-4 w-4" />
              Partiyi başlat
            </button>
          </section>

          <aside className="surface h-fit p-4 sm:p-6">
            <p className="eyebrow">Nasıl oynanır?</p>
            <h3 className="mt-1 text-lg font-bold text-parchment">Üç tur, bol kahkaha.</h3>
            <div className="mt-4 space-y-4">
              {[
                ["01", "Promptu dinle", "Her turda absürt bir replik ve taklit türü gelir."],
                ["02", "Sırayla kaydet", "Cihazı elden ele geçirin; herkes en iyi taklidini yapar."],
                ["03", "Anonim oyla", "Kayıtlar A/B/C olarak dinlenir. En iyi taklit puan alır."],
              ].map(([number, title, description]) => (
                <div key={number} className="flex gap-3">
                  <span className="font-mono text-xs font-bold text-brass">{number}</span>
                  <div>
                    <p className="text-sm font-semibold text-parchment">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-dim">{description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-sm border border-brass/20 bg-brass/[0.05] p-3 text-[11px] leading-5 text-muted">
              <MicIcon className="mr-1 inline h-3.5 w-3.5 text-brass" />
              Mikrofon izni yalnızca kayıt düğmesine basıldığında istenir. Kayıtlar cihazdan ayrılmaz.
            </div>
          </aside>
        </div>
      )}

      {phase === "record" && (
        <section className="surface mt-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Tur {round} · Prompt</p>
              <h2 className="mt-1 text-xl font-bold text-parchment">Sıra: {names[recordIndex]}</h2>
            </div>
            <span className="rounded-sm border border-line px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-dim">
              Kayıt {recordIndex + 1}/{names.length}
            </span>
          </div>

          <div className="mt-4 rounded-sm border border-brass/25 bg-brass/[0.045] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-sm border border-brass/25 bg-brass/[0.08] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-brass">
                {prompt.tag}
              </span>
              <SparklesIcon className="h-4 w-4 text-brass" />
            </div>
            <p className="mt-3 text-lg font-semibold leading-7 text-parchment sm:text-xl">“{prompt.text}”</p>
            <p className="mt-2 text-xs text-muted">En iyi taklidini yap. Ton, hız ve karakter serbest.</p>
          </div>

          <div className="mt-3">
            <VoiceRecorder
              key={`${round}-${recordIndex}`}
              maxSeconds={8}
              onRecorded={handleRecorded}
              hint="Geri sayımdan sonra en fazla 8 saniye. Kaydını dinleyip tekrar çekebilirsin."
            />
          </div>

          <button
            type="button"
            onClick={advanceRecording}
            disabled={!currentTake}
            className="button-primary mt-3 min-h-10 w-full text-xs sm:w-auto sm:px-5"
          >
            <CheckIcon className="h-4 w-4" />
            {recordIndex + 1 >= names.length ? "Kayıtları bitir ve dinlemeye geç" : "Kaydı onayla, sıradaki oyuncu"}
          </button>

          <p className="mt-2 text-[11px] text-dim">
            Kayıtlar anonim etiketlerle dinlenecek. Kimin hangi kaydı yaptığı oylama bitene kadar gösterilmez.
          </p>
        </section>
      )}

      {phase === "review" && (
        <section className="surface mt-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Tur {round} · Anonim dinleme</p>
              <h2 className="mt-1 text-xl font-bold text-parchment">Hangisi en iyi taklit?</h2>
            </div>
            <span className="rounded-sm border border-line px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-dim">
              {anonymousTakes.length} kayıt
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            Kayıtları sırayla dinleyin. İsimler gizli; sadece etiketler var. Hazır olunca oylamaya geçin.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {anonymousTakes.map((take) => (
              <TakePlayer
                key={take.label}
                take={take}
                active={activeTake === take.label}
                onToggle={toggleTake}
              />
            ))}
          </div>

          <button type="button" onClick={goVote} className="button-primary mt-4 min-h-10 px-5 text-xs">
            <GamepadIcon className="h-4 w-4" />
            Oylamaya geç
          </button>
        </section>
      )}

      {phase === "vote" && (
        <section className="surface mt-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Tur {round} · Oylama</p>
              <h2 className="mt-1 text-xl font-bold text-parchment">{names[voteIndex]} oyluyor</h2>
            </div>
            <span className="rounded-sm border border-line px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-dim">
              Oy {voteIndex + 1}/{names.length}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            En komik veya en isabetli bulduğun kaydı seç. Kendi kaydına oy veremezsin.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {anonymousTakes.map((take) => (
              <button
                key={take.label}
                type="button"
                onClick={() => castVote(take)}
                className="focus-ring group rounded-sm border border-line bg-black/20 p-3 text-left transition hover:border-brass/45 hover:bg-brass/[0.05]"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-sm border border-brass/25 bg-brass/[0.07] font-mono text-sm font-bold text-brass">
                    {take.label}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brass opacity-70 transition group-hover:opacity-100">
                    Oy ver
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                </span>
                <span className="mt-2 block text-[11px] text-dim">Anonim kayıt · {take.player === names[voteIndex] ? "senin kaydın" : "gizli oyuncu"}</span>
              </button>
            ))}
          </div>

          {error && (
            <p role="alert" className="mt-3 rounded-sm border border-rust/35 bg-rust/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
        </section>
      )}

      {phase === "results" && (
        <section className="surface mt-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Tur {round} · Sonuç</p>
              <h2 className="mt-1 text-xl font-bold text-parchment">
                {roundWinners.length > 1 ? "Berabere!" : "Kazanan belli oldu"}
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-brass/30 bg-brass/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brass">
              <StarIcon className="h-3.5 w-3.5" /> +1 puan
            </span>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_.8fr]">
            <div className="space-y-2">
              {roundWinners.length > 0 ? (
                roundWinners.map((winner) => (
                  <div key={winner.label} className="flex items-center gap-3 rounded-sm border border-brass/30 bg-brass/[0.055] p-3">
                    <span className="grid h-10 w-10 place-items-center rounded-sm border border-brass/35 bg-brass/10 font-mono text-sm font-bold text-brass">
                      {winner.label}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-parchment">{winner.player}</p>
                      <p className="text-[11px] text-muted">{winner.votes} oy · “{prompt.text}”</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">Bu turda geçerli oy oluşmadı.</p>
              )}

              <div className="grid gap-2 sm:grid-cols-3">
                {anonymousTakes.map((take) => (
                  <div key={take.label} className="rounded-sm border border-line bg-black/20 p-2.5 text-center">
                    <p className="font-mono text-xs font-bold text-brass">{take.label}</p>
                    <p className="mt-1 text-[11px] text-muted">{voteCounts[take.label] || 0} oy</p>
                    <p className="mt-0.5 truncate text-[10px] text-dim">{take.player}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-sm border border-line bg-black/20 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-dim">Skorboard</p>
              <div className="mt-2 space-y-1.5">
                {scoreboard.map(([name, score], index) => (
                  <div key={name} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-[10px] text-dim">{String(index + 1).padStart(2, "0")}</span>
                      <span className="truncate text-parchment">{name}</span>
                    </span>
                    <span className="font-mono font-bold text-brass">{score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={nextRound} className="button-primary min-h-10 px-5 text-xs">
              <PlayIcon className="h-4 w-4" />
              Sonraki tur
            </button>
            <button type="button" onClick={restartGame} className="button-secondary min-h-10 px-4 text-xs">
              <UsersIcon className="h-4 w-4" />
              Oyuncuları değiştir
            </button>
          </div>
          <p className="mt-2 text-[11px] text-dim">
            Her turda yeni bir prompt gelir. Puanlar oyun boyunca birikir.
          </p>
        </section>
      )}
    </div>
  );
}
