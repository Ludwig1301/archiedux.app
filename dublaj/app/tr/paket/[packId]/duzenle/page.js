import { StudioPage } from "../../../../../components/packs/pack-studio-page.jsx";

export const metadata = { title: "Paket stüdyosu" };

export default async function PackStudioPage({ params }) {
  const { packId } = await params;
  return <StudioPage packId={packId} />;
}
