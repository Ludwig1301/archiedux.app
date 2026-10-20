"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Brand from "./brand.jsx";
import {
  ChevronDownIcon,
  GamepadIcon,
  GlobeIcon,
  MenuIcon,
  SparklesIcon,
  UploadIcon,
  UsersIcon,
  XIcon,
} from "./icons.jsx";

const languages = [
  ["tr", "TR"],
  ["en", "EN"],
  ["es", "ES"],
  ["pt", "PT"],
  ["ru", "RU"],
];

const menus = {
  multiplayer: {
    label: "Çok Oyuncu",
    items: [
      {
        href: "/tr/oda-kur",
        title: "Dublaj Odası",
        description: "Oda koduyla arkadaşlarını çağır, rolleri paylaşın.",
        icon: UsersIcon,
      },
      {
        href: "/tr/mimic",
        title: "Mimic Party",
        description: "3–5 kişilik taklit partisi: kaydet, dinle, oyla.",
        icon: GamepadIcon,
        badge: "Yeni",
      },
    ],
  },
  create: {
    label: "Üret",
    items: [
      {
        href: "/#ai-creator",
        title: "AI Creator",
        description: "MP4 yükle, replikleri otomatik olarak stüdyoya al.",
        icon: SparklesIcon,
      },
      {
        href: "/#ai-creator",
        title: "Video Yükle",
        description: "Kendi sahneni 60 saniyeye kadar dublajla.",
        icon: UploadIcon,
      },
    ],
  },
};

export default function SiteHeader() {
  const [open, setOpen] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lang, setLang] = useState("tr");
  const [notice, setNotice] = useState("");
  const navRef = useRef(null);
  const noticeTimer = useRef(null);

  function showNotice(message) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 3600);
  }

  useEffect(() => {
    function onPointerDown(event) {
      if (navRef.current && !navRef.current.contains(event.target)) setOpen(null);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(null);
        setMobileOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  function toggleMenu(name) {
    setOpen((current) => (current === name ? null : name));
  }

  function handleLanguage(event) {
    const value = event.target.value;
    setLang("tr");
    if (value !== "tr") {
      showNotice("Diğer arayüz dilleri yakında. Şimdilik Türkçe devam ediyoruz.");
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-brass-dim/45 bg-ink/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
        <Brand />

        <nav ref={navRef} className="hidden items-center gap-6 lg:flex" aria-label="Ana menü">
          <Link href="/tr/oda-kur" className="nav-link">
            Oyna
          </Link>

          {Object.entries(menus).map(([key, menu]) => (
            <div key={key} className="relative">
              <button
                type="button"
                className="nav-link focus-ring"
                data-open={open === key}
                aria-expanded={open === key}
                aria-haspopup="true"
                onClick={() => toggleMenu(key)}
              >
                {menu.label}
                <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${open === key ? "rotate-180" : ""}`} />
              </button>
              {open === key && (
                <div className="dropdown-panel float-in" role="menu">
                  {menu.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.title}
                        href={item.href}
                        role="menuitem"
                        className="dropdown-item focus-ring"
                        onClick={() => setOpen(null)}
                      >
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-brass/20 bg-brass/[0.06] text-brass">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-semibold text-parchment">
                            {item.title}
                            {item.badge && (
                              <span className="rounded-sm bg-brass px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink">
                                {item.badge}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-dim">{item.description}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          <Link href="/#packs" className="nav-link">
            Dub Packs
          </Link>
          <Link href="/#pricing" className="nav-link">
            Fiyatlar
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <label className="hidden items-center gap-1.5 rounded-sm border border-line bg-panel/70 px-2.5 py-1.5 text-xs text-muted md:flex">
            <GlobeIcon className="h-3.5 w-3.5 text-brass" />
            <span className="sr-only">Dil seçimi</span>
            <select
              value={lang}
              onChange={handleLanguage}
              className="cursor-pointer bg-transparent pr-1 text-xs font-semibold uppercase tracking-wider text-muted outline-none"
              aria-label="Dil seçimi"
            >
              {languages.map(([value, label]) => (
                <option key={value} value={value} className="bg-panel text-parchment">
                  {label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => showNotice("Hesap sistemi yakında. Şimdilik misafir olarak oynayabilirsin.")}
            className="button-ghost hidden sm:inline-flex"
          >
            Giriş
          </button>

          <Link href="/tr/oda-kur" className="button-primary min-h-9 px-3.5 text-xs sm:text-sm">
            Oda kur
          </Link>

          <button
            type="button"
            className="focus-ring grid h-9 w-9 place-items-center rounded-sm border border-line text-muted lg:hidden"
            aria-label={mobileOpen ? "Menüyü kapat" : "Menüyü aç"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <XIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-panel px-5 py-4 lg:hidden">
          <div className="grid gap-1">
            <Link href="/tr/oda-kur" className="mobile-link" onClick={() => setMobileOpen(false)}>
              Oyna
            </Link>
            <Link href="/tr/oda-kur" className="mobile-link" onClick={() => setMobileOpen(false)}>
              Dublaj Odası
            </Link>
            <Link href="/tr/mimic" className="mobile-link" onClick={() => setMobileOpen(false)}>
              Mimic Party <span className="ml-2 rounded-sm bg-brass px-1.5 py-0.5 text-[9px] font-bold uppercase text-ink">Yeni</span>
            </Link>
            <Link href="/#ai-creator" className="mobile-link" onClick={() => setMobileOpen(false)}>
              AI Creator / Video Yükle
            </Link>
            <Link href="/#packs" className="mobile-link" onClick={() => setMobileOpen(false)}>
              Dub Packs
            </Link>
            <Link href="/#pricing" className="mobile-link" onClick={() => setMobileOpen(false)}>
              Fiyatlar
            </Link>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            {languages.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip ${value === "tr" ? "chip-active" : ""}`}
                onClick={() => {
                  if (value !== "tr") showNotice("Diğer arayüz dilleri yakında.");
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed bottom-5 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 border border-brass/35 bg-panel px-4 py-3 text-center text-sm text-parchment shadow-2xl">
          {notice}
        </div>
      )}
    </header>
  );
}
