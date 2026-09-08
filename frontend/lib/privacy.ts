export type Consent = { analytics: boolean; ads: boolean; whatsapp: boolean; research: boolean; answered: boolean };
export const NO_CONSENT: Consent = { analytics: false, ads: false, whatsapp: false, research: false, answered: false };
const KEY = 'cove.public-consent.v1';
export function readConsent(): Consent {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object' && 'version' in raw && raw.version === 1 && 'expires' in raw && typeof raw.expires === 'number' && raw.expires > Date.now() && 'value' in raw) {
      const v = raw.value as Partial<Consent>;
      return { analytics: v.analytics === true, ads: v.ads === true, whatsapp: false, research: false, answered: v.answered === true };
    }
  } catch { /* Storage can be unavailable or invalid. Fail closed. */ }
  return { ...NO_CONSENT };
}
export function saveConsent(consent: Consent) {
  try { localStorage.setItem(KEY, JSON.stringify({ version: 1, expires: Date.now() + 180 * 86400000, value: { ...consent, whatsapp: false, research: false } })); } catch { /* In-memory preferences still work. */ }
}
export const MARKETING_PATHS = ['/', '/cara-kerja', '/pricing'];
export function validPixelId(id: string) { return /^[0-9]{5,25}$/.test(id); }
export function trackingAllowed(path: string, consent: Consent, config: { enabled: boolean; verified: boolean; pixelId: string }) {
  return MARKETING_PATHS.includes(path) && consent.answered && consent.ads && config.enabled && config.verified && validPixelId(config.pixelId);
}
/** No SDK or browser Purchase dispatch exists. Production verification is server-only. */
