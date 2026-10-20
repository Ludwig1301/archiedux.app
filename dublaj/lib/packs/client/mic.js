"use client";

/** Raw microphone (no echo cancellation / AGC) for the cleanest takes. Headphones recommended. */
export async function openMic(engine) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Bu tarayıcı mikrofon kaydını desteklemiyor (HTTPS gerekli).");
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
  } catch (e) {
    const name = e.name;
    if (name === "NotAllowedError" || name === "SecurityError")
      throw new Error("Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesinden izin verip tekrar dene.");
    if (name === "NotFoundError") throw new Error("Mikrofon bulunamadı.");
    throw new Error("Mikrofon açılamadı: " + e.message);
  }
  const source = engine.ctx.createMediaStreamSource(stream);
  const analyser = engine.ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser); // not routed to speakers — no feedback
  const settings = stream.getAudioTracks()[0]?.getSettings();
  return {
    stream,
    analyser,
    inputLatency: typeof settings?.latency === "number" ? settings.latency : 0.01,
    close: () => {
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

export function pickMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  return "";
}

export function extFor(mime) {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "bin";
}
