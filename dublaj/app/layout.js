import "./globals.css";

export const metadata = {
  title: "Replik Kulübü — Arkadaşlarınla seslendir",
  description:
    "Lisansı açık kısa sahneleri arkadaşlarınla yeniden seslendir. Oda kur, rolünü seç ve birlikte izle.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
