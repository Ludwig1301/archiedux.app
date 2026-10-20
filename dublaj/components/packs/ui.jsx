"use client";

import { forwardRef } from "react";
import SiteHeader from "../site-header.jsx";

// Dub Pack ekranlarının ortak parçaları. Görünüm globals.css'teki
// .button-primary / .button-secondary dilini izler (pirinç vurgular, 4px köşe).
const VARIANTS = {
  primary:
    "border border-brass-bright bg-[linear-gradient(135deg,#f0d05c_0%,#c9a227_55%,#a8871e_100%)] text-[#17130a] font-bold shadow-[0_8px_24px_rgba(201,162,39,0.16)] hover:brightness-110",
  listen: "border border-sage/35 bg-sage/10 text-sage-bright hover:bg-sage/20",
  ghost: "border border-transparent text-muted hover:text-parchment hover:bg-white/[0.045] hover:border-white/[0.08]",
  outline: "border border-[#33333a] bg-panel/80 text-parchment hover:border-brass-dim hover:bg-[#1c1c21]",
  danger: "border border-transparent text-red-400 hover:bg-rust/15",
  rec: "border border-rust/70 bg-rust text-white font-bold hover:bg-[#a62a2a]",
};
const SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-sm",
  md: "h-10 px-4 text-sm gap-2 rounded-sm",
  lg: "h-12 px-5 text-sm gap-2 rounded-sm",
};

export function btn(variant = "outline", size = "md", extra = "") {
  return `inline-flex items-center justify-center font-semibold whitespace-nowrap transition focus-ring disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export const Button = forwardRef(function Button(
  { variant = "outline", size = "md", className = "", type = "button", ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={btn(variant, size, className)} {...rest} />;
});

export function IconButton({ label, children, className = "", ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`focus-ring inline-grid size-8 place-items-center rounded-sm text-muted hover:bg-white/[0.05] hover:text-parchment disabled:pointer-events-none disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Sitenin üst menüsü + (varsa) sayfaya özel eylem çubuğu. */
export function AppHeader({ children }) {
  return (
    <>
      <SiteHeader />
      {children && (
        <div className="packs-ui border-b border-line bg-panel/70">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2 px-5 py-2.5 lg:px-8">
            {children}
          </div>
        </div>
      )}
    </>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-parchment">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-dim">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full h-10 rounded-sm border border-line bg-black/40 px-3 text-sm text-parchment placeholder:text-[#5d5d66] outline-none transition focus:border-brass-dim focus:ring-[3px] focus:ring-brass/10";

export function Spinner({ size = 16 }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

export function Notice({ tone = "info", children }) {
  const tones = {
    info: "border-sage/30 bg-sage/[0.07] text-sage-bright",
    error: "border-rust/40 bg-rust/10 text-red-300",
    warn: "border-brass/30 bg-brass/[0.06] text-brass-bright",
  };
  return <div className={`rounded-sm border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}
