// ========================================
// Configuration
// ========================================

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  processing: {
    batchSize: parseInt(process.env.BATCH_SIZE) || 5,
    logLevel: process.env.LOG_LEVEL || 'info',
  },
};

// Validation
export function validateConfig() {
  const missing = [];
  
  if (!config.supabase.url) missing.push('SUPABASE_URL');
  if (!config.supabase.anonKey) missing.push('SUPABASE_ANON_KEY');
  if (!config.anthropic.apiKey) missing.push('ANTHROPIC_API_KEY');
  
  if (missing.length > 0) {
    console.error('❌ Variables manquantes dans .env:', missing.join(', '));
    process.exit(1);
  }
  
  console.log('✅ Configuration validée');
}
