import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://archiedux.com"),
  title: {
    default: "Replik Kulübü — Arkadaşlarınla dublaj stüdyosu",
    template: "%s · Replik Kulübü",
  },
  description:
    "Açık lisanslı sahneleri arkadaşlarınla yeniden seslendir. Oda kur, repliğini kaydet, taklit partisi başlat ve dublajı birlikte izle. Hesap gerekmez.",
  keywords: [
    "dublaj oyunu",
    "seslendirme oyunu",
    "arkadaşlarla dublaj",
    "mikrofon oyunu",
    "mimic party",
    "replik kulübü",
    "archiedux",
    "congress",
  ],
  openGraph: {
    title: "Replik Kulübü — Sahneyi seç, sesi sen ver",
    description:
      "Arkadaşlarınla aynı sahnede dublaj yap. Tarayıcıda mikrofon kaydı, replik replik stüdyo ve taklit partisi.",
    type: "website",
    locale: "tr_TR",
    siteName: "Replik Kulübü",
  },
  twitter: {
    card: "summary_large_image",
    title: "Replik Kulübü — Arkadaşlarınla dublaj stüdyosu",
    description: "Sahneyi seç, sesi sen ver. Oda kodu yeter; kurulum yok.",
  },
};

export const viewport = {
  themeColor: "#111113",
  colorScheme: "dark",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-ink text-parchment antialiased">{children}</body>
    </html>
  );
}
