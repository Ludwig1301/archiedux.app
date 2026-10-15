export const AVATAR_CHOICES = ["🎙️", "🎬", "🦊", "🐼", "🐸", "🐙", "👽", "🤖", "🐯", "🦁"];

// Tarayıcı sekmesi kapanana kadar sabit kalan istemci kimliği. Bu sayede
// bağlantı kısa süre kopup geri geldiğinde oyuncu rolünü kaybetmez.
export function getClientId() {
  if (typeof window === "undefined") return "";
  let id = window.sessionStorage.getItem("replikClientId");
  if (!id) {
    const random = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    id = random.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    window.sessionStorage.setItem("replikClientId", id);
  }
  return id;
}
