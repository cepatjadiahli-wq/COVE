import {safePath, type PlanId} from './journey';

const PENDING_EMAIL_KEY = 'cove_pending_auth_email';

export function pendingAuthEmail(): string {
  try { return sessionStorage.getItem(PENDING_EMAIL_KEY) || ''; } catch { return ''; }
}

export function rememberAuthEmail(email: string) {
  try {
    if (email) sessionStorage.setItem(PENDING_EMAIL_KEY, email.trim());
    else sessionStorage.removeItem(PENDING_EMAIL_KEY);
  } catch { /* The form still works when browser storage is unavailable. */ }
}

export function authQuery(plan: PlanId | null, returnTo?: string | null): string {
  const query = new URLSearchParams();
  if (plan) query.set('plan', plan);
  const target = safePath(returnTo, '');
  if (target) query.set('returnTo', target);
  return query.size ? '?' + query.toString() : '';
}

export function authErrorMessage(error: unknown): string {
  const {code, status, message} = (error || {}) as {code?: string; status?: number; message?: string};
  if (code === 'invalid_credentials') return 'Email atau kata sandi belum cocok. Periksa kembali, atau pilih Lupa kata sandi.';
  if (code === 'email_not_confirmed') return 'Email belum diverifikasi. Buka email dari COVE atau kirim ulang tautannya.';
  if (code === 'email_address_not_authorized') return 'Pengiriman email untuk alamat ini belum tersedia. Hubungi pengelola COVE.';
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'Periksa kembali alamat email dan isian Anda.';
  if (code === 'weak_password') return 'Gunakan kata sandi yang lebih kuat, minimal 8 karakter.';
  if (code === 'user_already_exists') return 'Pendaftaran belum dapat dilanjutkan. Coba masuk atau pulihkan kata sandi Anda.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || status === 429) return 'Terlalu banyak permintaan. Tunggu beberapa saat sebelum mencoba lagi.';
  if (code === 'otp_expired' || code === 'session_not_found') return 'Tautan sudah tidak berlaku. Minta tautan baru untuk melanjutkan.';
  if (code === 'APP_SESSION_LOAD_FAILED') return 'Sesi masuk sudah diproses, tetapi data akun belum dapat dimuat. Coba muat akun lagi.';
  if (error instanceof TypeError || /fetch|network/i.test(message || '')) return 'Koneksi belum berhasil. Periksa internet Anda lalu coba lagi.';
  if (status && status >= 500) return 'Layanan akun sedang mengalami kendala. Silakan coba lagi sebentar.';
  return 'Permintaan belum berhasil. Silakan coba lagi atau hubungi bantuan COVE.';
}
