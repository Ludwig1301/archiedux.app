import RoomClient from "../../../../components/room-client.jsx";

export default async function RoomPage({ params }) {
  const { code } = await params;
  return <RoomClient code={code} />;
}
