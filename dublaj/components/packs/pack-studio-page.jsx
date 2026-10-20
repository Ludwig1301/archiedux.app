"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/packs/client/api.js";
import { ProcessingView } from "./pack-processing.jsx";
import { Editor } from "./pack-editor.jsx";
import { AppHeader, Spinner, btn } from "./ui.jsx";

export function StudioPage({ packId }) {
  const [env, setEnv] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    api
      .get(packId)
      .then(setEnv)
      .catch((e) => setError(e.message));
  }, [packId]);

  useEffect(load, [load]);

  if (error)
    return (
      <>
        <AppHeader />
        <main className="packs-ui mx-auto max-w-xl flex-1 px-6 py-20 text-center">
          <h1 className="display text-3xl font-bold">Paket bulunamadı</h1>
          <p className="mt-2 text-muted">{error}</p>
          <Link href="/tr/paketler" className={btn("outline", "md", "mt-6")}>
            Paketlere dön
          </Link>
        </main>
      </>
    );

  if (!env)
    return (
      <>
        <AppHeader />
        <div className="grid flex-1 place-items-center text-muted">
          <Spinner size={22} />
        </div>
      </>
    );

  if (!env.pack || env.meta.status === "processing" || env.meta.status === "failed") {
    return (
      <>
        <AppHeader />
        <ProcessingView packId={packId} onDone={load} />
      </>
    );
  }

  return (
    <Editor
      key={env.meta.updatedAt}
      initialPack={env.pack}
      meta={env.meta}
      canEdit={env.canEdit}
      canPublish={env.canPublish}
    />
  );
}
