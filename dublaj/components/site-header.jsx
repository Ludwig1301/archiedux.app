import Link from "next/link";

const links = [
  { href: "/tr/oda-kur", label: "Oyna" },
  { href: "/tr/sahneler", label: "Sahneler" },
  { href: "/tr/sahne/tears-of-steel-opening", label: "Günün sahnesi" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <Link href="/" className="focus-ring flex items-center gap-2.5 rounded-lg">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-lilac text-lg font-black text-ink">
            R
          </span>
          <span className="text-sm font-extrabold tracking-[0.14em]">REPLİK KULÜBÜ</span>
        </Link>
        <nav aria-label="Ana menü" className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="focus-ring rounded-md text-sm text-zinc-300 transition hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="https://discord.com"
            target="_blank"
            rel="noreferrer"
            className="focus-ring hidden rounded-lg px-3 py-2 text-sm text-zinc-300 hover:text-white sm:inline-flex"
          >
            Discord
          </a>
          <Link href="/tr/oda-kur" className="button-primary min-h-10 px-4 text-sm">
            Oda kur
          </Link>
        </div>
      </div>
    </header>
  );
}
