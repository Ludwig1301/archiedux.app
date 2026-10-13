"use client";

export default function ScenePreview({ videoId, title, startAt = 0 }) {
  return (
    <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
      <iframe
        className="h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?start=${Math.floor(startAt)}&rel=0&playsinline=1`}
        title={title}
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
