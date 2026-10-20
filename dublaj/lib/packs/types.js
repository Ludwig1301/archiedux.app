// Shared types between server pipeline and browser studio.
// `DubPack` mirrors the pack.json schema exactly.

export const CATEGORIES = ["Türkçe Dizi", "Türkçe Meme", "Anime", "Topluluk"];

/** Stored next to pack.json in meta.json so pack.json keeps the exact schema. */

export const MAX_SEGMENT_SECONDS = 60;

export const CHARACTER_COLORS = [
  "#EF4444",
  "#3B82F6",
  "#F59E0B",
  "#10B981",
  "#EC4899",
  "#8B5CF6",
  "#06B6D4",
  "#F97316",
  "#84CC16",
  "#E11D48",
];

/** Recorded take timing used by both the in-browser mixer and the FFmpeg renderer. */

/** Window of a recorded take that is kept in the mix, relative to the line. */
export const TAKE_PAD_BEFORE = 0.15;
export const TAKE_PAD_AFTER = 0.6;

export function takeWindow(line, startAt, takeDuration) {
  const winStart = Math.max(0, line.startTime - TAKE_PAD_BEFORE);
  const winEnd = line.endTime + TAKE_PAD_AFTER;
  const trimStart = Math.max(0, winStart - startAt);
  const trimEnd = Math.min(takeDuration, winEnd - startAt);
  const length = Math.max(0, trimEnd - trimStart);
  const placeAt = startAt + trimStart; // timeline position of the kept audio
  return { trimStart, trimEnd, length, placeAt };
}
