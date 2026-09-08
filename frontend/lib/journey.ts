/** Frontend routing contract. This is not authentication or an entitlement verifier. */
export const PLANS = {
  pilot: { name: 'Paid Pilot', price: 7500000, projects: 1, period: '45 hari', description: 'Mulai dari satu proyek dengan baseline yang disepakati.' },
  core: { name: 'Core', price: 4900000, projects: 3, period: 'Bulanan', description: 'Kontrol komersial untuk tim dan proyek aktif Anda.' },
  scale: { name: 'Scale', price: 9900000, projects: 10, period: 'Bulanan', description: 'Pandangan portofolio untuk operasi yang berkembang.' },
  enterprise: { name: 'Enterprise', price: 25000000, projects: null, period: 'Kontrak tahunan', description: 'Kebutuhan multi-entitas dan implementasi khusus.' },
} as const;
export type PlanId = keyof typeof PLANS;
export function parsePlan(value: string | null): PlanId | null {
  return value && Object.hasOwn(PLANS, value) ? value as PlanId : null;
}
export type Journey = {
  enabled: boolean; signedIn: boolean; companyComplete: boolean;
  status: 'none' | 'pending' | 'verifying' | 'active' | 'failed' | 'expired';
  activePlan: PlanId | null; intent: PlanId | null; invited: boolean; firstProject: boolean;
};
export const INITIAL_JOURNEY: Journey = { enabled: true, signedIn: false, companyComplete: false, status: 'none', activePlan: null, intent: null, invited: false, firstProject: false };
export function safePath(value?: string | null, fallback = '/dashboard') {
  if (!value || /[\\\u0000-\u0020%#]/.test(value) || !/^\/(dashboard|projects|actions|invoices|reports|billing|onboarding|checkout|support|settings|invitation)(\/|\?|$)/.test(value)) return fallback;
  return value;
}
export function intentQuery(plan: PlanId | null) { return plan ? '?plan=' + plan : ''; }
export function afterAccess(account: Journey, plan: PlanId | null, returnTo?: string | null): string {
  if (account.invited) return '/invitation';
  if (!account.signedIn) return '/signup' + intentQuery(plan);
  if (!account.companyComplete) return '/onboarding' + intentQuery(plan);
  if (account.status === 'active') {
    if (plan && plan !== account.activePlan) return '/billing?change=' + plan;
    if (plan && plan === account.activePlan) return '/billing';
    if (!account.firstProject) return '/onboarding/project';
    return safePath(returnTo, '/dashboard');
  }
  if (account.status === 'pending' || account.status === 'verifying') return '/billing/status';
  return plan ? '/checkout' + intentQuery(plan) : '/pricing';
}
export function canSetupProject(account: Journey) { return account.enabled && account.signedIn && account.companyComplete && account.status === 'active' && !account.invited; }
export function canReviewCheckout(account: Journey) { return account.enabled && account.signedIn && account.companyComplete && !account.invited && !['active', 'pending', 'verifying'].includes(account.status); }
export function projectLimit(plan: PlanId | null) { return plan ? PLANS[plan].projects : null; }
