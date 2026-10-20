// Uygulamanın ana site altında yayınlandığı yol (archiedux.com/dublaj).
// next.config.mjs bu değeri kullanır; fetch/<video src> gibi Next'in otomatik
// ön ek eklemediği adresler de buradan üretilir.
export const BASE_PATH = "/dublaj";

/** "/api/packs" → "/dublaj/api/packs" */
export function withBase(path) {
  return `${BASE_PATH}${path}`;
}
