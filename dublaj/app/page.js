import Link from "next/link";
import SiteHeader from "../components/site-header.jsx";
import Brand from "../components/brand.jsx";
import DubStage from "../components/dub-stage.jsx";
import DubPackGrid from "../components/dub-pack-grid.jsx";
import MicTester from "../components/mic-tester.jsx";
import UploadStudio from "../components/upload-studio.jsx";
import { dubPacks } from "../lib/dub-packs.js";
import { scenes } from "../lib/scenes.js";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  FilmIcon,
  GamepadIcon,
  HeadphonesIcon,
  HelpIcon,
  LockIcon,
  MicIcon,
  PlayIcon,
  ShieldIcon,
  SparklesIcon,
  StarIcon,
  UploadIcon,
  UsersIcon,
  WandIcon,
} from "../components/icons.jsx";

const featured = scenes[0];

const steps = [
  {
    number: "01",
    title: "Sahneyi seç",
    description: "Açık lisanslı bir dub pack aç veya kendi MP4’ünü yükle.",
    icon: FilmIcon,
  },
  {
    number: "02",
    title: "Odayı kur",
    description: "Oda kodunu arkadaşlarına gönder. Hesap açmak gerekmez.",
    icon: UsersIcon,
  },
  {
    number: "03",
    title: "Rolünü al",
    description: "Kurucu karakterleri dağıtır; herkes kendi repliğini görür.",
    icon: SparklesIcon,
  },
  {
    number: "04",
    title: "Repliği kaydet",
    description: "Orijinali dinle, geri sayımdan sonra mikrofonuna konuş.",
    icon: MicIcon,
  },
  {
    number: "05",
    title: "Birlikte izle",
    description: "Tüm replikler hazır olunca dublajı senkron oynatın veya indirin.",
    icon: PlayIcon,
  },
];

const faqs = [
  {
    question: "Hesap açmam gerekiyor mu?",
    answer:
      "Hayır. Oda kurmak veya kodla katılmak için sadece bir görünen ad yeterli. Hesap ve kalıcı profil özellikleri yakında eklenecek; o zamana kadar misafir olarak oynayabilirsin.",
  },
  {
    question: "Sahnelerin lisansı ne?",
    answer:
      "Katalogdaki oynanabilir sahneler açık lisanslı veya kamu malı kaynaklardan seçilir. Her sahnenin detay sayfasında kaynak, lisans bağlantısı ve atıf metni bulunur. Kullanıcı videoları yalnızca kendi tarayıcısında işlenir.",
  },
  {
    question: "Kayıtlarım nereye gidiyor?",
    answer:
      "Dublaj odasındaki kayıtlar oda açık kaldığı sürece sunucu belleğinde tutulur ve oda kapanınca silinir. Mimic Party ve AI Creator kayıtları ise cihazından ayrılmaz; tarayıcı oturumu bitince serbest bırakılır.",
  },
  {
    question: "MP4 olarak indirebilir miyim?",
    answer:
      "Şu anda kayıtlarını tek bir WAV ses dosyası olarak indirebilirsin. Video üzerine filigranlı MP4 render ve Pro kalite seçenekleri yakında eklenecek.",
  },
  {
    question: "Aynı odada kaç kişi oynayabilir?",
    answer:
      "Dublaj odaları 8 oyuncuya kadar açılır. Mimic Party ise tek cihazda 3–5 kişilik sırayla oynanan bir taklit oyunudur. Bağlantısı kopan oyuncular 30 saniye içinde rollerini kaybetmeden dönebilir.",
  },
  {
    question: "Mikrofonum çalışmıyor, ne yapmalıyım?",
    answer:
      "Sayfadaki mikrofon testini kullan. İzin verilmediyse adres çubuğundaki kilit simgesinden mikrofon iznini aç, doğru giriş cihazını seç ve sayfayı yenile. Chrome, Edge veya Firefox önerilir.",
  },
];

const tiers = [
  {
    name: "Ücretsiz",
    price: "0 TL",
    note: "Sonsuza kadar",
    description: "Arkadaşlarınla oynamak için gereken her şey.",
    features: [
      "Sınırsız oda kodu",
      "8 oyuncuya kadar dublaj odası",
      "Tüm açık lisanslı dub pack’ler",
      "Replik replik kayıt ve ortak izleme",
      "WAV ses indirme",
    ],
    cta: "Ücretsiz başla",
    href: "/tr/oda-kur",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "Yakında",
    note: "Creator planı",
    description: "Video render, daha uzun yüklemeler ve filigransız çıktı.",
    features: [
      "Filigransız MP4 render",
      "60 saniyeye kadar AI Creator",
      "Öncelikli render kuyruğu",
      "Özel dub pack oluşturma",
      "Gelişmiş mikrofon araçları",
    ],
    cta: "Yakında",
    href: null,
    highlighted: false,
  },
  {
    name: "Topluluk",
    price: "Özel",
    note: "Etkinlikler için",
    description: "Yayın, sınıf veya topluluk etkinlikleri için paket.",
    features: [
      "Etkinlik modu ve sunucu yönetimi",
      "Markalı oda sayfası",
      "Katılımcı yönetimi",
      "Toplu oturumlar",
      "Öncelikli destek",
    ],
    cta: "Topluluk odası kur",
    href: "/tr/oda-kur",
    highlighted: false,
  },
];

function FaqItem({ question, answer, name = "faq" }) {
  return (
    <details className="faq-item" name={name}>
      <summary>
        <span>{question}</span>
        <span className="faq-icon text-lg leading-none" aria-hidden="true">
          +
        </span>
      </summary>
      <p className="pb-4 pr-6 text-sm leading-7 text-muted">{answer}</p>
    </details>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-line">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_80%_0%,rgba(201,162,39,0.10),transparent_65%),radial-gradient(ellipse_45%_45%_at_0%_80%,rgba(127,158,143,0.045),transparent_70%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-12 lg:grid-cols-[0.88fr_1.12fr] lg:items-start lg:gap-12 lg:px-8 lg:pb-24 lg:pt-16">
            <div className="lg:sticky lg:top-24">
              <div className="inline-flex items-center gap-2 rounded-sm border border-brass/30 bg-brass/[0.06] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-brass">
                <span className="record-dot" />
                Arkadaşlarınla, aynı sahnede
              </div>

              <h1 className="mt-6 text-5xl font-bold leading-[1.02] tracking-[-0.05em] text-parchment sm:text-6xl xl:text-7xl">
                Sahneyi seç.
                <br />
                <span className="gold-text">Sesi sen ver.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-8 text-muted sm:text-lg">
                Dinle, taklit et, kaydet. Açık lisanslı sahnelerde arkadaşlarınla aynı repliğe
                ses vermek için hesap ya da kurulum gerekmez.
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <Link href="/tr/oda-kur" className="button-primary">
                  Ücretsiz oda kur
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <a href="#stage" className="button-secondary">
                  <PlayIcon className="h-4 w-4" />
                  Sahneyi dene
                </a>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3 text-xs text-dim">
                <span className="flex -space-x-2">
                  {[
                    ["R", "bg-brass text-ink"],
                    ["S", "bg-sage text-ink"],
                    ["D", "bg-[#b08a9a] text-ink"],
                  ].map(([letter, classes]) => (
                    <span
                      key={letter}
                      className={`grid h-8 w-8 place-items-center rounded-full border-2 border-ink text-[11px] font-bold ${classes}`}
                    >
                      {letter}
                    </span>
                  ))}
                </span>
                <span>Oda kodu yeter · 8 oyuncuya kadar · tarayıcıda çalışır</span>
              </div>

              <dl className="mt-8 grid max-w-lg grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-4">
                {[
                  ["0", "hesap"],
                  ["8", "oyuncu/oda"],
                  ["100%", "tarayıcı"],
                  ["CC", "lisanslı sahne"],
                ].map(([value, label]) => (
                  <div key={label} className="bg-panel/90 px-3 py-2.5">
                    <dt className="text-lg font-bold text-parchment">{value}</dt>
                    <dd className="mt-0.5 text-[10px] uppercase tracking-wider text-dim">{label}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-4 flex items-center gap-1.5 text-[11px] text-dim">
                <LockIcon className="h-3.5 w-3.5 text-brass-dim" />
                Mikrofon izni yalnızca kayıt düğmesine bastığında istenir.
              </p>
            </div>

            <div id="stage" className="scroll-mt-24">
              <DubStage scene={featured} />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-dim">
                <span>Canlı demo · {featured.title}</span>
                <span>{featured.film} · CC BY 3.0 · gerçek mikrofon kaydı</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-line bg-black/10">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-line px-5 lg:grid-cols-4 lg:px-8">
            {[
              [MicIcon, "Tarayıcıda kayıt", "Kurulum yok, eklenti yok"],
              [UsersIcon, "Arkadaşlarla", "Oda koduyla davet et"],
              [ShieldIcon, "Anonim oylama", "Mimic Party’de adlar gizli"],
              [FilmIcon, "Açık lisans", "Kaynak ve atıf kartlarda"],
            ].map(([Icon, title, description]) => (
              <div key={title} className="flex items-center gap-3 bg-ink px-3 py-4 sm:px-5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-brass/20 bg-brass/[0.05] text-brass">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs font-bold text-parchment">{title}</span>
                  <span className="mt-0.5 block text-[10px] text-dim">{description}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Nasıl oynanır?</p>
              <h2 className="display mt-2 text-3xl text-parchment sm:text-4xl">Beş adımda kendi sahnen.</h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-muted">
              Sahne seçmekten dublajı birlikte izlemeye kadar her şey tarayıcıda. Oda kodu dışında
              hiçbir şey paylaşman gerekmez.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.number} className="surface relative overflow-hidden p-4">
                  <span className="absolute -right-2 -top-3 font-mono text-5xl font-bold text-white/[0.035]">
                    {step.number}
                  </span>
                  <span className="grid h-9 w-9 place-items-center rounded-sm border border-brass/25 bg-brass/[0.06] text-brass">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="mt-4 text-sm font-bold text-parchment">{step.title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-muted">{step.description}</p>
                  {index < steps.length - 1 && (
                    <span className="absolute -right-2 top-1/2 hidden text-brass-dim lg:block" aria-hidden="true">
                      →
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section id="packs" className="scroll-mt-20 border-y border-line bg-black/15">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Yeni Dub Pack’ler</p>
                <h2 className="display mt-2 text-3xl text-parchment sm:text-4xl">Bugün neyi seslendiriyoruz?</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
                  Kısa, açık lisanslı sahneler. Her kartta replik sayısı, rol sayısı ve dil etiketi var.
                  Yeni paketler yayına hazırlandıkça burada görünecek.
                </p>
              </div>
              <Link href="/tr/sahneler" className="button-secondary min-h-9 px-3.5 text-xs">
                Tüm kataloğu gör
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-7">
              <DubPackGrid packs={dubPacks} />
            </div>

            <p className="mt-5 flex items-start gap-2 rounded-sm border border-line bg-ink/40 px-3 py-2 text-[11px] leading-5 text-dim">
              <ShieldIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass-dim" />
              Katalogda yalnızca açık lisanslı, kamu malı veya izinli medya yer alır. Kaynak, lisans ve
              atıf bilgisi her sahnenin detayında bulunur.
            </p>
          </div>
        </section>

        <section id="multiplayer" className="scroll-mt-20 mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">İki çok oyunculu mod</p>
              <h2 className="display mt-2 text-3xl text-parchment sm:text-4xl">Aynı sahne, iki farklı oyun.</h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-muted">
              İster replik replik dublaj yapın, ister absürt taklitlerle birbirinizi oylayın. İkisi de
              aynı tarayıcıda, aynı mikrofonla.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className="surface group relative overflow-hidden p-5 sm:p-7">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brass/[0.06] blur-3xl" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-sm border border-brass/30 bg-brass/[0.07] text-brass">
                    <UsersIcon className="h-5 w-5" />
                  </span>
                  <span className="rounded-sm border border-line px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-dim">
                    Oda kodu
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-bold text-parchment">Dublaj Odası</h3>
                <p className="mt-1.5 max-w-md text-sm leading-7 text-muted">
                  Bir sahne seç, oda kur ve kodu arkadaşlarına gönder. Kurucu rolleri dağıtır; herkes
                  kendi repliğini kaydeder. Hazır olunca dublajı birlikte oynatırsınız.
                </p>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    "8 oyuncuya kadar",
                    "Kurucu rol ataması",
                    "Replik replik kayıt",
                    "Senkron ortak izleme",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-muted">
                      <CheckIcon className="h-3.5 w-3.5 shrink-0 text-brass" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/tr/oda-kur" className="button-primary min-h-10 px-4 text-xs">
                    Oda kur
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Link>
                  <Link href="/tr/oda-kur" className="button-secondary min-h-10 px-4 text-xs">
                    Kodla katıl
                  </Link>
                </div>
              </div>
            </article>

            <article className="surface group relative overflow-hidden p-5 sm:p-7">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sage/[0.06] blur-3xl" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-sm border border-sage/30 bg-sage/[0.07] text-sage">
                    <GamepadIcon className="h-5 w-5" />
                  </span>
                  <span className="rounded-sm bg-brass px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink">
                    Yeni
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-bold text-parchment">Mimic Party</h3>
                <p className="mt-1.5 max-w-md text-sm leading-7 text-muted">
                  Absürt bir replik gelir, herkes sırayla en iyi taklidini yapar. Kayıtlar anonim
                  dinlenir ve oylanır. En çok oyu alan turu kazanır.
                </p>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    "3–5 oyuncu",
                    "Tek cihazda sırayla",
                    "Anonim dinleme",
                    "Canlı skorboard",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-muted">
                      <CheckIcon className="h-3.5 w-3.5 shrink-0 text-sage" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/tr/mimic" className="button-primary min-h-10 px-4 text-xs">
                    Partiyi başlat
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Link>
                  <a href="#mikrofon" className="button-secondary min-h-10 px-4 text-xs">
                    Mikrofonu test et
                  </a>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section id="ai-creator" className="scroll-mt-20 border-y border-line bg-black/15">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:px-8 lg:py-20">
            <div>
              <p className="eyebrow">AI Creator</p>
              <h2 className="display mt-2 text-3xl text-parchment sm:text-4xl">
                Kendi MP4’ünü yükle,
                <br />
                <span className="gold-text">sahneye dönüştür.</span>
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-muted">
                En fazla 60 saniyelik bir MP4 bırak. Demo hattı sesi ayırır, konuşma aralıklarını
                repliklere böler ve düzenlenebilir bir taslak hazırlar. Sonra aynı stüdyoda kaydedersin.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "Sürükle-bırak yükleme · max 95 MB",
                  "Otomatik replik taslağı ve zaman damgaları",
                  "Yerel işlem: dosya sunucuya gitmez",
                  "WAV ses indirme · MP4 render yakında",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs leading-5 text-muted">
                    <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="chip">
                  <UploadIcon className="h-3.5 w-3.5 text-brass" /> MP4
                </span>
                <span className="chip">
                  <ClockIcon className="h-3.5 w-3.5 text-brass" /> 60 sn
                </span>
                <span className="chip">
                  <WandIcon className="h-3.5 w-3.5 text-brass" /> Otomatik replik
                </span>
              </div>
            </div>
            <UploadStudio />
          </div>
        </section>

        <section id="mikrofon" className="scroll-mt-20 mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
            <div>
              <p className="eyebrow">Sorun giderme</p>
              <h2 className="display mt-2 text-3xl text-parchment sm:text-4xl">Mikrofon bir türlü duymuyor mu?</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
                En sık yaşanan üç sorunu ve çözümlerini aşağıda topladık. Sağdaki test ile mikrofonunun
                gerçekten ses aldığını saniyeler içinde görebilirsin.
              </p>

              <div className="mt-6 surface px-4 sm:px-5">
                <FaqItem
                  name="mic"
                  question="Tarayıcı hiç mikrofon izni istemedi"
                  answer="Adres çubuğundaki kilit simgesine tıkla, Site ayarları bölümünden Mikrofon iznini 'İzin ver' yap. Ardından sayfayı yenile ve kayıt düğmesine tekrar bas. İzin istemi yalnızca kayıt veya test düğmesine basıldığında açılır."
                />
                <FaqItem
                  name="mic"
                  question="Test çubuğu hareket etmiyor"
                  answer="Bilgisayarının ses ayarlarında doğru giriş cihazının seçili olduğundan emin ol. Kulaklık mikrofonu takılıysa tarayıcıda da onu seçmen gerekebilir. Sessize alınmış bir mikrofon veya kapalı bir fiziksel düğme en sık nedendir."
                />
                <FaqItem
                  name="mic"
                  question="Oynatma sessiz geliyor"
                  answer="Sahne videosu kayıt sırasında bilerek sessize alınır. Orijinali dinle düğmesine bastığında ses açılır. Cihaz sesini ve tarayıcı sekmesinin sessiz olmadığını kontrol et. Kulaklık kullanmak, hoparlörden mikrofona geri beslemeyi de önler."
                />
                <FaqItem
                  name="mic"
                  question="Kayıt çok kısa kesiliyor"
                  answer="Kayıt, repliğin süresi dolunca otomatik biter. Daha uzun bir replik için kayıt sırasında 'Kaydı bitir' düğmesini kullanabilirsin. Sekmeyi arka plana atarsan bazı tarayıcılar zamanlayıcıları yavaşlatır; kayıt sırasında sekmeyi açık tut."
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="surface p-5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-sm border border-brass/25 bg-brass/[0.06] text-brass">
                    <HeadphonesIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-parchment">Canlı mikrofon testi</p>
                    <p className="text-[11px] text-dim">Ses seviyesi ve dalga formu gerçek zamanlı.</p>
                  </div>
                </div>
                <div className="mt-4">
                  <MicTester />
                </div>
              </div>

              <div className="rounded-sm border border-line bg-black/20 p-4 text-[11px] leading-5 text-dim">
                <p className="flex items-center gap-1.5 font-semibold text-muted">
                  <LockIcon className="h-3.5 w-3.5 text-brass-dim" />
                  Gizlilik notu
                </p>
                <p className="mt-1.5">
                  Mikrofon akışı yalnızca kayıt ve test sırasında açılır. Mimic Party ve AI Creator
                  kayıtları cihazında kalır; dublaj odası kayıtları oda kapanınca sunucudan silinir.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-20 border-y border-line bg-black/15">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Fiyatlar</p>
                <h2 className="display mt-2 text-3xl text-parchment sm:text-4xl">Stüdyo senin, oda senin.</h2>
              </div>
              <p className="max-w-md text-sm leading-7 text-muted">
                Temel dublaj deneyimi tamamen ücretsiz. Profesyonel render ve ekip araçları hazır
                olduğunda Pro plan devreye girecek.
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {tiers.map((tier) => (
                <article
                  key={tier.name}
                  className={`surface relative flex flex-col p-5 sm:p-6 ${
                    tier.highlighted ? "border-brass/40 shadow-glow" : ""
                  }`}
                >
                  {tier.highlighted && (
                    <span className="absolute right-4 top-4 rounded-sm bg-brass px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink">
                      Popüler
                    </span>
                  )}
                  <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-dim">{tier.note}</p>
                  <h3 className="mt-2 text-xl font-bold text-parchment">{tier.name}</h3>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-brass">{tier.price}</p>
                  <p className="mt-2 min-h-10 text-xs leading-5 text-muted">{tier.description}</p>
                  <ul className="mt-4 flex-1 space-y-2">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs leading-5 text-muted">
                        <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {tier.href ? (
                    <Link
                      href={tier.href}
                      className={`mt-5 min-h-10 text-xs ${tier.highlighted ? "button-primary" : "button-secondary"}`}
                    >
                      {tier.cta}
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    <button type="button" disabled className="button-secondary mt-5 min-h-10 text-xs">
                      {tier.cta}
                    </button>
                  )}
                </article>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-dim">
              Fiyatlar temsilidir; ödeme altyapısı henüz aktif değil. Tüm temel özellikler şu anda ücretsiz.
            </p>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <div>
              <p className="eyebrow">SSS</p>
              <h2 className="display mt-2 text-3xl text-parchment sm:text-4xl">Aklında kalan sorular.</h2>
              <p className="mt-3 max-w-md text-sm leading-7 text-muted">
                Cevabını bulamadığın bir şey varsa mikrofon bölümündeki testi dene; çoğu sorun izin
                veya cihaz seçiminden kaynaklanıyor.
              </p>
              <a href="#mikrofon" className="button-secondary mt-4 min-h-9 px-3.5 text-xs">
                <HelpIcon className="h-4 w-4" />
                Sorun giderme
              </a>
            </div>
            <div className="surface px-4 sm:px-6">
              {faqs.map((faq) => (
                <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
            <div className="surface relative overflow-hidden p-6 sm:p-10">
              <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brass/10 blur-3xl" />
              <div className="relative flex flex-wrap items-center justify-between gap-6">
                <div>
                  <p className="eyebrow">Hazır mısın?</p>
                  <h2 className="display mt-2 text-3xl text-parchment sm:text-4xl">
                    Bir oda kodu kadar <span className="gold-text">yakın.</span>
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-7 text-muted">
                    Arkadaşlarını çağır, sahneyi seç ve mikrofonu aç. İlk dublajın birkaç dakika içinde
                    hazır olacak.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <Link href="/tr/oda-kur" className="button-primary">
                    Oda kur
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                  <Link href="/tr/mimic" className="button-secondary">
                    <GamepadIcon className="h-4 w-4" />
                    Mimic Party
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Brand />
              <p className="mt-3 max-w-xs text-xs leading-6 text-dim">
                Açık lisanslı sahneleri arkadaşlarınla yeniden seslendir. Tarayıcıda kayıt, oda koduyla
                ortak izleme ve taklit partisi.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2 py-1 text-[10px] text-dim">
                  <StarIcon className="h-3 w-3 text-brass" /> ARCH topluluğu
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2 py-1 text-[10px] text-dim">
                  <ShieldIcon className="h-3 w-3 text-brass" /> Açık lisans
                </span>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-dim">Oyna</p>
              <div className="mt-3 grid gap-2 text-xs text-muted">
                <Link href="/tr/oda-kur" className="transition hover:text-parchment">Dublaj odası</Link>
                <Link href="/tr/mimic" className="transition hover:text-parchment">Mimic Party</Link>
                <Link href="/tr/sahneler" className="transition hover:text-parchment">Dub pack’ler</Link>
                <a href="#stage" className="transition hover:text-parchment">Canlı sahne</a>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-dim">Üret</p>
              <div className="mt-3 grid gap-2 text-xs text-muted">
                <a href="#ai-creator" className="transition hover:text-parchment">AI Creator</a>
                <a href="#ai-creator" className="transition hover:text-parchment">Video yükle</a>
                <a href="#pricing" className="transition hover:text-parchment">Fiyatlar</a>
                <a href="#faq" className="transition hover:text-parchment">SSS</a>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-dim">Diller</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                <Link href="/?lang=tr" className="transition hover:text-parchment">Türkçe</Link>
                <Link href="/?lang=en" className="transition hover:text-parchment">English</Link>
                <Link href="/?lang=es" className="transition hover:text-parchment">Español</Link>
                <Link href="/?lang=pt" className="transition hover:text-parchment">Português</Link>
                <Link href="/?lang=ru" className="transition hover:text-parchment">Русский</Link>
              </div>
            </div>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-[11px] text-dim">
            <span>© {new Date().getFullYear()} Replik Kulübü · Bağımsız topluluk stüdyosu</span>
            <span className="flex flex-wrap items-center gap-3">
              <span>Medya atıfları sahne detaylarında</span>
              <span aria-hidden="true">·</span>
              <span>Instrument Sans ile dizildi</span>
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
