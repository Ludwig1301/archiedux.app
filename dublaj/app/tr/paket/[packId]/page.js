import { DubStage } from "../../../../components/packs/pack-stage.jsx";

export const metadata = { title: "Dublaj sahnesi" };

export default async function PackStagePage({ params }) {
  const { packId } = await params;
  return <DubStage packId={packId} />;
}
