/**
 * Script de génération de clés API pour SOS Storytelling
 *
 * Usage:
 *   node generate-api-key.js <user_id> [options]
 *
 * Options:
 *   --name "Nom de la clé"     Nom pour identifier la clé (défaut: "Ma clé API")
 *   --env live|test            Environnement (défaut: live)
 *   --limit 1000               Limite mensuelle de requêtes (défaut: 1000)
 *
 * Exemple:
 *   node generate-api-key.js 550e8400-e29b-41d4-a716-446655440000 --name "Production" --limit 5000
 */

const crypto = require('crypto');

// Configuration
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_SERVICE_KEY = 'your-service-role-key'; // Service role pour bypass RLS

/**
 * Génère une clé API sécurisée
 * @param {string} env - 'live' ou 'test'
 * @returns {object} { fullKey, prefix, hash }
 */
function generateAPIKey(env = 'live') {
  // Générer 32 bytes aléatoires (256 bits)
  const randomBytes = crypto.randomBytes(32);
  const keyBody = randomBytes.toString('base64url'); // URL-safe base64

  // Préfixe selon l'environnement
  const prefix = env === 'test' ? 'sk_test_' : 'sk_live_';

  // Clé complète
  const fullKey = `${prefix}${keyBody}`;

  // Préfixe visible (pour identification dans l'UI)
  const visiblePrefix = `${prefix}${keyBody.substring(0, 4)}`;

  // Hash SHA-256 pour stockage sécurisé
  const hash = crypto.createHash('sha256').update(fullKey).digest('hex');

  return {
    fullKey,
    prefix: visiblePrefix,
    hash
  };
}

/**
 * Insère la clé dans Supabase
 */
async function insertKeyToSupabase(userId, keyData, options) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/api_keys`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      user_id: userId,
      key_prefix: keyData.prefix,
      key_hash: keyData.hash,
      name: options.name || 'Ma clé API',
      rate_limit_monthly: options.limit || 1000,
      permissions: {
        generate: true,
        voices: true,
        usage: true
      },
      is_active: true
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur Supabase: ${error}`);
  }

  return response.json();
}

/**
 * Parse les arguments de ligne de commande
 */
function parseArgs(args) {
  const options = {
    name: 'Ma clé API',
    env: 'live',
    limit: 1000
  };

  const userId = args[0];

  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--name':
        options.name = value;
        break;
      case '--env':
        options.env = value === 'test' ? 'test' : 'live';
        break;
      case '--limit':
        options.limit = parseInt(value) || 1000;
        break;
    }
  }

  return { userId, options };
}

/**
 * Affiche l'aide
 */
function showHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     SOS Storytelling - Générateur de clés API                ║
╚══════════════════════════════════════════════════════════════╝

Usage:
  node generate-api-key.js <user_id> [options]

Options:
  --name "Nom"     Nom pour identifier la clé (défaut: "Ma clé API")
  --env live|test  Environnement (défaut: live)
  --limit 1000     Limite mensuelle de requêtes (défaut: 1000)

Exemples:
  node generate-api-key.js 550e8400-e29b-41d4-a716-446655440000
  node generate-api-key.js abc123 --name "Production" --env live --limit 5000
  node generate-api-key.js abc123 --name "Dev" --env test --limit 100
`);
}

/**
 * Mode démo (sans Supabase)
 */
function generateDemo() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     Mode Démonstration - Génération locale                   ║
╚══════════════════════════════════════════════════════════════╝
`);

  const liveKey = generateAPIKey('live');
  const testKey = generateAPIKey('test');

  console.log('🔐 Clé LIVE générée:');
  console.log('─'.repeat(60));
  console.log(`  Clé complète : ${liveKey.fullKey}`);
  console.log(`  Préfixe      : ${liveKey.prefix}...`);
  console.log(`  Hash SHA-256 : ${liveKey.hash}`);
  console.log();

  console.log('🧪 Clé TEST générée:');
  console.log('─'.repeat(60));
  console.log(`  Clé complète : ${testKey.fullKey}`);
  console.log(`  Préfixe      : ${testKey.prefix}...`);
  console.log(`  Hash SHA-256 : ${testKey.hash}`);
  console.log();

  console.log('📋 SQL pour insérer manuellement dans Supabase:');
  console.log('─'.repeat(60));
  console.log(`
INSERT INTO api_keys (user_id, key_prefix, key_hash, name, rate_limit_monthly)
VALUES (
  'VOTRE_USER_ID_ICI',
  '${liveKey.prefix}',
  '${liveKey.hash}',
  'Production',
  1000
);
`);

  console.log('⚠️  IMPORTANT: Sauvegardez la clé complète maintenant !');
  console.log('   Elle ne pourra plus être récupérée une fois perdue.');
  console.log();
}

// Point d'entrée principal
async function main() {
  const args = process.argv.slice(2);

  // Aide
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    generateDemo();
    return;
  }

  // Mode démo
  if (args[0] === '--demo') {
    generateDemo();
    return;
  }

  // Génération réelle
  const { userId, options } = parseArgs(args);

  if (!userId) {
    console.error('❌ Erreur: user_id requis');
    showHelp();
    process.exit(1);
  }

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     Génération de clé API pour SOS Storytelling              ║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log('📝 Configuration:');
  console.log(`   User ID     : ${userId}`);
  console.log(`   Nom         : ${options.name}`);
  console.log(`   Environnement: ${options.env}`);
  console.log(`   Limite      : ${options.limit} requêtes/mois`);
  console.log();

  // Générer la clé
  const keyData = generateAPIKey(options.env);

  console.log('🔐 Clé générée:');
  console.log('─'.repeat(60));
  console.log(`  Clé complète : ${keyData.fullKey}`);
  console.log(`  Préfixe      : ${keyData.prefix}...`);
  console.log(`  Hash         : ${keyData.hash}`);
  console.log();

  // Vérifier si Supabase est configuré
  if (SUPABASE_URL === 'https://your-project.supabase.co') {
    console.log('⚠️  Supabase non configuré - mode local uniquement');
    console.log();
    console.log('📋 Pour configurer Supabase, modifiez les constantes:');
    console.log('   SUPABASE_URL et SUPABASE_SERVICE_KEY');
    console.log();
    console.log('📋 SQL pour insertion manuelle:');
    console.log('─'.repeat(60));
    console.log(`
INSERT INTO api_keys (user_id, key_prefix, key_hash, name, rate_limit_monthly)
VALUES (
  '${userId}',
  '${keyData.prefix}',
  '${keyData.hash}',
  '${options.name}',
  ${options.limit}
);
`);
  } else {
    // Insérer dans Supabase
    try {
      console.log('📤 Insertion dans Supabase...');
      const result = await insertKeyToSupabase(userId, keyData, options);
      console.log('✅ Clé enregistrée avec succès !');
      console.log(`   ID: ${result[0]?.id}`);
    } catch (error) {
      console.error('❌ Erreur:', error.message);
      console.log();
      console.log('📋 SQL de secours pour insertion manuelle:');
      console.log(`
INSERT INTO api_keys (user_id, key_prefix, key_hash, name, rate_limit_monthly)
VALUES (
  '${userId}',
  '${keyData.prefix}',
  '${keyData.hash}',
  '${options.name}',
  ${options.limit}
);
`);
    }
  }

  console.log();
  console.log('═'.repeat(60));
  console.log('⚠️  IMPORTANT: Copiez et sauvegardez la clé complète maintenant !');
  console.log('   Elle ne pourra plus être récupérée une fois perdue.');
  console.log('═'.repeat(60));
}

main().catch(console.error);
