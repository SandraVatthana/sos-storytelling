// ========================================
// Test d'extraction - Bonnes Pratiques
// ========================================

import { config, validateConfig } from './config.js';
import { extractRulesFromNewsletter, generateRuleHash } from './extractor.js';

// Newsletter de test (exemple fictif)
const TEST_NEWSLETTER = {
  id: 'test-001',
  source: 'Nina Ramen (test)',
  subject: 'Les 5 erreurs qui tuent tes posts LinkedIn',
  captured_at: new Date().toISOString(),
  content: `
Salut !

Cette semaine, j'ai analysé 200 posts LinkedIn qui ont fait un flop total.
Voici ce que j'ai découvert :

1. MODIFIER TON POST APRÈS PUBLICATION
C'est LA pire erreur. LinkedIn reset complètement l'algorithme quand tu modifies.
Même une faute de frappe corrigée = retour à zéro en termes de distribution.
Attends au MINIMUM 24h avant de toucher à quoi que ce soit.

2. METTRE UN LIEN DANS LE POST
On en a parlé 100 fois mais je vois encore des gens le faire.
Le lien dans le post = -40% de reach en moyenne.
Mets-le en commentaire, toujours.

3. NE PAS RÉPONDRE AUX COMMENTAIRES
L'algo surveille ton engagement dans la première heure.
Si tu postes et tu disparais, LinkedIn comprend que tu t'en fiches.
Règle : reste dispo 1h après publication pour répondre à TOUS les commentaires.

4. POSTER LE WEEKEND
Sauf si ton audience est B2C, le weekend c'est mort.
Meilleurs jours : mardi, mercredi, jeudi.
Meilleure heure : 8h-9h ou 17h-18h.

5. FAIRE DES POSTS TROP LONGS SANS STRUCTURE
Un pavé de texte = scroll immédiat.
Structure avec des sauts de ligne.
Max 1300 caractères pour un post standard.
Pour un carrousel, vise 8-12 slides.

Voilà ! Tu fais ces erreurs ? Dis-moi en commentaire 👇

À mardi,
Nina

PS: Mon nouveau programme "LinkedIn Boost" ouvre ses portes la semaine prochaine !
`,
};

async function runTest() {
  console.log('🧪 Test d\'extraction\n');
  console.log('========================================');
  console.log(`Source: ${TEST_NEWSLETTER.source}`);
  console.log(`Sujet: ${TEST_NEWSLETTER.subject}`);
  console.log('========================================\n');

  validateConfig();

  try {
    console.log('🤖 Extraction en cours...\n');
    const result = await extractRulesFromNewsletter(TEST_NEWSLETTER);

    console.log('📋 RÉSULTAT:\n');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n----------------------------------------');
    console.log('📊 RÈGLES EXTRAITES:\n');

    for (const rule of result.rules) {
      const hash = generateRuleHash(rule.rule);
      console.log(`[${rule.category}] ${rule.platforms.join(', ')}`);
      console.log(`   "${rule.rule}"`);
      console.log(`   Source: "${rule.source.excerpt}"`);
      console.log(`   Hash: ${hash}`);
      console.log('');
    }

    console.log(`✅ ${result.rules.length} règle(s) extraite(s)`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

runTest();
