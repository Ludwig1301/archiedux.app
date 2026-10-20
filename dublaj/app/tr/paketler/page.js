import { Suspense } from "react";
import { Library } from "../../../components/packs/pack-library.jsx";

export const metadata = {
  title: "Dub Pack’ler",
  description:
    "Türk dizileri ve internet memelerinden kısa sahneler. YouTube linki ya da MP4 ile kendi paketini oluştur, karakterleri seslendir, MP4 olarak indir.",
};

export default function PacksPage() {
  return (
    <Suspense fallback={null}>
      <Library />
    </Suspense>
  );
}
