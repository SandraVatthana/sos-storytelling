// ========================================
// API pour SOS Storytelling
// Récupère les bonnes pratiques formatées
// ========================================

import { config, validateConfig } from './config.js';
import { getBonnesPratiques, supabase } from './supabase-client.js';

// ----------------------------------------
// Fonctions d'API pour SOS
// ----------------------------------------

/**
 * Récupère les bonnes pratiques contextuelles pour SOS
 * @param {string} platform - La plateforme (linkedin, instagram, etc.)
 * @param {string} contentType - Type de contenu (post, carrousel, story, etc.)
 * @param {number} limit - Nombre max de tips
 */
export async function getTipsForSOS(platform, contentType = null, limit = 5) {
  // Mapping type de contenu → catégories pertinentes
  const categoryMapping = {
    'post': ['algorithme', 'timing', 'engagement', 'copywriting'],
    'carrousel': ['format', 'copywriting', 'engagement'],
    'story': ['format', 'engagement'],
    'video': ['format', 'algorithme'],
    'default': ['algorithme', 'engagement', 'erreurs'],
  };

  const categories = categoryMapping[contentType] || categoryMapping['default'];

  // Récupérer les règles pertinentes
  let query = supabase
    .from('v_bonnes_pratiques_actives')
    .select('*')
    .contains('platforms', [platform])
    .in('category', categories)
    .order('confidence', { ascending: true }) // consensus d'abord
    .limit(limit);

  const { data, error } = await query;
  if (error) throw error;

  // Formater pour l'affichage dans SOS
  return (data || []).map(rule => ({
    id: rule.id,
    tip: rule.rule,
    category: rule.category,
    confidence: rule.confidence,
    icon: getCategoryIcon(rule.category),
    freshness: rule.freshness,
  }));
}

/**
 * Récupère les erreurs à éviter
 */
export async function getErrorsToAvoid(platform, limit = 3) {
  const { data, error } = await supabase
    .from('v_bonnes_pratiques_actives')
    .select('*')
    .contains('platforms', [platform])
    .eq('category', 'erreurs')
    .limit(limit);

  if (error) throw error;

  return (data || []).map(rule => ({
    id: rule.id,
    warning: rule.rule,
    confidence: rule.confidence,
  }));
}

/**
 * Incrémente le compteur d'usage d'une règle
 */
export async function trackRuleUsage(ruleId) {
  await supabase.rpc('increment_usage_count', { rule_id: ruleId });
}

// ----------------------------------------
// Helpers
// ----------------------------------------

function getCategoryIcon(category) {
  const icons = {
    'algorithme': '🤖',
    'format': '📐',
    'timing': '⏰',
    'engagement': '💬',
    'erreurs': '⚠️',
    'copywriting': '✍️',
    'strategie': '🎯',
  };
  return icons[category] || '💡';
}

// ----------------------------------------
// Export pour intégration directe
// ----------------------------------------

/**
 * Génère le HTML/JSX pour l'encart "Bonnes Pratiques" dans SOS
 */
export function renderTipsWidget(tips) {
  if (!tips || tips.length === 0) {
    return null;
  }

  return {
    title: '💡 Bonnes pratiques du moment',
    tips: tips.map(tip => ({
      icon: tip.icon,
      text: tip.tip,
      badge: tip.confidence === 'consensus' ? '✓ Vérifié' : null,
    })),
  };
}

// ----------------------------------------
// Test direct
// ----------------------------------------

if (process.argv[1].endsWith('api-sos.js')) {
  validateConfig();
  
  console.log('🧪 Test API SOS\n');
  
  getTipsForSOS('linkedin', 'post', 5)
    .then(tips => {
      console.log('Tips pour un post LinkedIn:\n');
      tips.forEach(tip => {
        console.log(`${tip.icon} [${tip.category}] ${tip.tip}`);
      });
    })
    .catch(console.error);
}
