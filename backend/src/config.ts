import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.PORT || 3001),
  env: process.env.NODE_ENV || 'development',
  isProduction,
  
  // Supabase Auth & PostgreSQL
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  databaseUrl: process.env.DATABASE_URL || (isProduction ? '' : 'postgresql://postgres:postgres@localhost:5432/cove'),
  
  // Mayar SaaS Billing
  mayarApiKey: process.env.MAYAR_API_KEY || (isProduction ? '' : 'myr_dev_key_unconfigured'),
  mayarWebhookSecret: process.env.MAYAR_WEBHOOK_SECRET || (isProduction ? '' : 'myr_whsec_dev_local_secret'),
  
  // Frontend Origin CORS
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  asOfDate: '2026-09-08'
};

export function validateConfig() {
  if (config.isProduction) {
    const required = [
      { key: 'DATABASE_URL', val: config.databaseUrl },
      { key: 'MAYAR_WEBHOOK_SECRET', val: config.mayarWebhookSecret },
      { key: 'SUPABASE_URL', val: config.supabaseUrl }
    ];
    for (const item of required) {
      if (!item.val) {
        throw new Error(`CRITICAL SECURITY ERROR: Required environment variable ${item.key} is missing in production.`);
      }
    }
  }
}
