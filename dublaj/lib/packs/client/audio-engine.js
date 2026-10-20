"use client";

/**
 * Sample-accurate playback for the dub stage.
 *
 * Everything audible is scheduled on one AudioContext clock (background, reference
 * vocals, recorded takes). The muted <video> just follows that clock and is nudged
 * back whenever it drifts more than ~120 ms.
 */

const SYNC_TOLERANCE = 0.12;

export class AudioEngine {
  ctx;
  master;
  cache = new Map();
  current = null;

  static instance = null;
  static get() {
    if (!AudioEngine.instance) AudioEngine.instance = new AudioEngine();
    return AudioEngine.instance;
  }

  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx({ latencyHint: "interactive" });
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
  }

  async resume() {
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  /** Seconds between scheduling a sound and it reaching the speakers. */
  get outputLatency() {
    const c = this.ctx;
    return (c.outputLatency || 0) + (c.baseLatency || 0);
  }

  loadUrl(url) {
    let p = this.cache.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`Ses dosyası yüklenemedi: ${url}`);
          return r.arrayBuffer();
        })
        .then((ab) => this.ctx.decodeAudioData(ab));
      p.catch(() => this.cache.delete(url));
      this.cache.set(url, p);
    }
    return p;
  }

  async decodeBlob(blob) {
    return this.ctx.decodeAudioData(await blob.arrayBuffer());
  }

  get isPlaying() {
    return this.current !== null;
  }

  stop() {
    this.current?.stop();
  }

  async play(opts) {
    this.stop();
    await this.resume();
    const { from, to, video } = opts;

    if (video) {
      video.muted = true;
      video.pause();
      await seek(video, from);
    }

    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.08;
    const sources = [];

    for (const layer of opts.layers) {
      const offset = layer.offset ?? 0;
      const length = layer.duration ?? layer.buffer.duration - offset;
      const segStart = layer.at;
      const segEnd = layer.at + length;
      const start = Math.max(segStart, from);
      const end = Math.min(segEnd, to);
      if (end - start <= 0.005) continue;
      const src = ctx.createBufferSource();
      src.buffer = layer.buffer;
      const g = ctx.createGain();
      g.gain.value = layer.gain ?? 1;
      src.connect(g).connect(this.master);
      src.start(t0 + (start - from), offset + (start - segStart), end - start);
      sources.push(src);
    }

    let raf = 0;
    let finished = false;
    let resolveDone;
    const done = new Promise((r) => (resolveDone = r));

    const finish = (reason) => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
        s.disconnect();
      }
      if (video) video.pause();
      if (this.current === playback) this.current = null;
      opts.onEnd?.(reason);
      resolveDone(reason);
    };

    const playback = { t0, from, to, stop: () => finish("stopped"), done };
    this.current = playback;

    let videoStarted = false;
    const tick = () => {
      if (finished) return;
      // What the listener hears right now, on the timeline.
      const heard = from + (ctx.currentTime - t0 - this.outputLatency);
      if (video && heard >= from && !videoStarted) {
        videoStarted = true;
        video.play().catch(() => undefined);
      }
      if (video && videoStarted && !video.paused) {
        if (Math.abs(video.currentTime - heard) > SYNC_TOLERANCE) video.currentTime = Math.max(0, heard);
      }
      opts.onTick?.(Math.max(from, Math.min(to, heard)));
      if (ctx.currentTime - t0 >= to - from + this.outputLatency) {
        finish("ended");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return playback;
  }
}

function seek(video, t) {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - t) < 0.02 && video.readyState >= 2) return resolve();
    const done = () => {
      video.removeEventListener("seeked", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 1500);
    video.addEventListener("seeked", done);
    video.currentTime = t;
  });
}

/** Downsamples a buffer to min/max peak pairs for waveform drawing. */
export function computePeaks(buffer, buckets) {
  const out = new Float32Array(buckets * 2);
  const chans = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const size = Math.max(1, Math.floor(buffer.length / buckets));
  for (let b = 0; b < buckets; b++) {
    let min = 0;
    let max = 0;
    const start = b * size;
    const end = Math.min(buffer.length, start + size);
    for (let i = start; i < end; i += 4) {
      let v = 0;
      for (const c of chans) v += c[i];
      v /= chans.length;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    out[b * 2] = min;
    out[b * 2 + 1] = max;
  }
  return out;
}
