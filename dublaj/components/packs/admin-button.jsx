"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { getAdminToken, setAdminToken } from "../../lib/packs/client/api.js";
import { Button, inputClass } from "./ui.jsx";

/** Lets a site admin paste DUBPACK_ADMIN_TOKEN once; it is stored in this browser only. */
export function AdminButton() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [active, setActive] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const t = getAdminToken();
    setValue(t);
    setActive(Boolean(t));
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="packs-ui relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`grid size-9 place-items-center rounded-sm hover:bg-panel-2 ${active ? "text-sage-bright" : "text-dim hover:text-parchment"}`}
        aria-label="Yönetici anahtarı"
        title="Yönetici anahtarı"
      >
        <KeyRound size={17} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-sm bg-panel p-4 border border-line shadow-2xl shadow-black/50">
          <p className="text-sm font-semibold">Yönetici anahtarı</p>
          <p className="mt-1 text-xs text-muted">
            Sunucudaki DUBPACK_ADMIN_TOKEN ile tüm paketleri düzenleyip yayınlayabilirsin. Sadece bu tarayıcıda saklanır.
          </p>
          <input
            type="password"
            className={`${inputClass} mt-3`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="DUBPACK_ADMIN_TOKEN"
          />
          <div className="mt-3 flex justify-end gap-2">
            {active && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAdminToken("");
                  setValue("");
                  setActive(false);
                  setOpen(false);
                }}
              >
                Çıkış
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setAdminToken(value.trim());
                setActive(Boolean(value.trim()));
                setOpen(false);
                location.reload();
              }}
            >
              Kaydet
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
