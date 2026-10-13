import SiteHeader from "../../../components/site-header.jsx";
import RoomSetup from "../../../components/room-setup.jsx";

export default async function CreateRoomPage({ searchParams }) {
  const query = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[calc(100vh-72px)] max-w-4xl px-5 py-12 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-lilac">Arkadaşlarını çağır</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Bir oda aç, sahneyi paylaş.</h1>
        <p className="mt-4 max-w-2xl leading-7 text-zinc-400">
          Oda kodunu arkadaşlarına gönder. Hesap gerekmez; girdiğin ad yalnızca odada görünür.
        </p>
        <RoomSetup initialScene={query?.scene} />
        <p className="mt-6 text-xs leading-5 text-zinc-500">
          Kayıtlar geçicidir ve oda çalışırken sunucu belleğinde tutulur. Oda kapanınca tüm ses kayıtları silinir.
        </p>
      </main>
    </>
  );
}
