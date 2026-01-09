// ========================================
// Bonnes Pratiques Aggregator - Main
// ========================================

import { config, validateConfig } from './config.js';
import { 
  getUnprocessedNewsletters, 
  updateNewsletterStatus,
  getBonnesPratiques 
} from './supabase-client.js';
import { extractRulesFromNewsletter } from './extractor.js';
import { processRule } from './deduplicator.js';

// ----------------------------------------
// Main Process
// ----------------------------------------

async function main() {
  console.log('');
  console.log('========================================');
  console.log('📩 Bonnes Pratiques Aggregator');
  console.log('========================================');
  console.log('');

  // Valider la config
  validateConfig();

  // Récupérer les newsletters non traitées
  console.log(`📥 Récupération des newsletters en attente...`);
  const newsletters = await getUnprocessedNewsletters(config.processing.batchSize);

  if (newsletters.length === 0) {
    console.log('✅ Aucune newsletter à traiter');
    return;
  }

  console.log(`📋 ${newsletters.length} newsletter(s) à traiter`);
  console.log('');

  // Stats
  let totalRulesExtracted = 0;
  let totalRulesCreated = 0;
  let totalRulesMerged = 0;
  let errors = 0;

  // Traiter chaque newsletter
  for (const newsletter of newsletters) {
    console.log(`----------------------------------------`);
    console.log(`📰 "${newsletter.subject || 'Sans sujet'}"`);
    console.log(`   Source: ${newsletter.source}`);
    console.log(`   Date: ${new Date(newsletter.captured_at).toLocaleDateString('fr-FR')}`);

    try {
      // Marquer comme "en cours"
      await updateNewsletterStatus(newsletter.id, 'processing');

      // Extraire les règles
      console.log(`   🤖 Extraction en cours...`);
      const extracted = await extractRulesFromNewsletter(newsletter);

      if (extracted.rules.length === 0) {
        console.log(`   ⚠️ Aucune règle trouvée`);
        await updateNewsletterStatus(newsletter.id, 'processed', extracted);
        continue;
      }

      console.log(`   ✅ ${extracted.rules.length} règle(s) extraite(s)`);
      totalRulesExtracted += extracted.rules.length;

      // Traiter chaque règle (dédoublonnage)
      for (const rule of extracted.rules) {
        console.log(`   → ${rule.category}: "${truncate(rule.rule, 50)}"`);
        
        const result = await processRule(rule);
        
        if (result.action === 'created') {
          totalRulesCreated++;
        } else {
          totalRulesMerged++;
        }
      }

      // Marquer comme traité
      await updateNewsletterStatus(newsletter.id, 'processed', extracted);

    } catch (error) {
      console.error(`   ❌ Erreur:`, error.message);
      await updateNewsletterStatus(newsletter.id, 'error', null, error.message);
      errors++;
    }
  }

  // Résumé
  console.log('');
  console.log('========================================');
  console.log('📊 RÉSUMÉ');
  console.log('========================================');
  console.log(`   Newsletters traitées: ${newsletters.length - errors}`);
  console.log(`   Erreurs: ${errors}`);
  console.log(`   Règles extraites: ${totalRulesExtracted}`);
  console.log(`   Nouvelles règles: ${totalRulesCreated}`);
  console.log(`   Règles fusionnées: ${totalRulesMerged}`);
  console.log('');
}

// ----------------------------------------
// Commandes CLI
// ----------------------------------------

async function showStats() {
  validateConfig();
  
  console.log('📊 Statistiques des bonnes pratiques\n');
  
  const categories = ['algorithme', 'format', 'timing', 'engagement', 'erreurs', 'copywriting', 'strategie'];
  
  for (const cat of categories) {
    const rules = await getBonnesPratiques(null, cat, 100);
    console.log(`${cat}: ${rules.length} règle(s)`);
  }
}

async function listRules(platform = null) {
  validateConfig();
  
  console.log(`📋 Bonnes pratiques${platform ? ` pour ${platform}` : ''}\n`);
  
  const rules = await getBonnesPratiques(platform, null, 20);
  
  for (const rule of rules) {
    console.log(`[${rule.confidence}] ${rule.category.toUpperCase()}`);
    console.log(`   ${rule.rule}`);
    console.log(`   Plateformes: ${rule.platforms.join(', ')}`);
    console.log('');
  }
}

// ----------------------------------------
// CLI Handler
// ----------------------------------------

const args = process.argv.slice(2);

if (args.includes('--stats')) {
  showStats().catch(console.error);
} else if (args.includes('--list')) {
  const platformIndex = args.indexOf('--platform');
  const platform = platformIndex !== -1 ? args[platformIndex + 1] : null;
  listRules(platform).catch(console.error);
} else {
  main().catch(console.error);
}

// ----------------------------------------
// Utilitaires
// ----------------------------------------

function truncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
