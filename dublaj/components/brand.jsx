import Link from "next/link";

export function Seal({ className = "h-8 w-8" }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={`seal ${className}`}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="24" cy="24" r="17" stroke="currentColor" strokeWidth="0.9" opacity="0.55" />
      <path
        d="M24 11.5 L27.1 19.7 L35.5 19.7 L28.7 24.5 L31.3 32.6 L24 27.6 L16.7 32.6 L19.3 24.5 L12.5 19.7 L20.9 19.7 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function Brand({ href = "/", onClick, className = "" }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`focus-ring group inline-flex items-center gap-2.5 rounded-sm ${className}`}
      aria-label="Replik Kulübü ana sayfa"
    >
      <Seal className="h-8 w-8 shrink-0 transition-transform duration-300 group-hover:rotate-[12deg]" />
      <span className="flex items-baseline gap-1.5">
        <span className="wordmark text-[20px]">REPLİK</span>
        <span className="text-[9px] font-bold tracking-[0.3em] text-dim">KULÜBÜ</span>
      </span>
    </Link>
  );
}
