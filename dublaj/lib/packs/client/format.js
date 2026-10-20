/** 75.25 → "1:15.2" ; withTenths=false → "1:15" */
export function fmtTime(sec, withTenths = true) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const whole = Math.floor(s);
  const base = `${m}:${String(whole).padStart(2, "0")}`;
  return withTenths ? `${base}.${Math.floor((s - whole) * 10)}` : base;
}

/** "1:15", "1:15.5", "75", "75.5", "1:02:03" → seconds (null if invalid). */
export function parseTime(input) {
  const s = input.trim().replace(",", ".");
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const parts = s.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  return parts.map(Number).reduce((acc, p) => acc * 60 + p, 0);
}

export const round2 = (n) => Math.round(n * 100) / 100;
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function youTubeId(url) {
  try {
    const u = new URL(url.trim());
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (/(^|\.)youtube(-nocookie)?\.com$/.test(u.hostname)) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

/** Reads ?t=1m15s / ?t=75 / &start=75 from a YouTube URL. */
export function youTubeStartParam(url) {
  try {
    const u = new URL(url.trim());
    const t = u.searchParams.get("t") ?? u.searchParams.get("start");
    if (!t) return null;
    if (/^\d+$/.test(t)) return Number(t);
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!m) return null;
    return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  } catch {
    return null;
  }
}
