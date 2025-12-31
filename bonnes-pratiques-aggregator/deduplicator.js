// ========================================
// Module de dédoublonnage
// ========================================

import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { findSimilarRule, createBonnePratique, updateBonnePratique } from './supabase-client.js';
import { generateRuleHash } from './extractor.js';

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
});

// ----------------------------------------
// Dédoublonnage intelligent
// ----------------------------------------

/**
 * Traite une règle extraite : dédoublonne ou crée
 */
export async function processRule(rule) {
  const ruleHash = generateRuleHash(rule.rule);
  
  // 1. Chercher par hash exact
  const existingByHash = await findSimilarRule(ruleHash);
  
  if (existingByHash) {
    console.log(`  ↳ Règle existante trouvée (hash), ajout source`);
    await updateBonnePratique(existingByHash.id, rule.source);
    return { action: 'merged', id: existingByHash.id };
  }
  
  // 2. Pas de doublon exact → créer
  console.log(`  ↳ Nouvelle règle, création`);
  const created = await createBonnePratique({
    rule: rule.rule,
    ruleHash: ruleHash,
    category: rule.category,
    platforms: rule.platforms,
    confidence: 'tendance',
    sources: [rule.source],
  });
  
  return { action: 'created', id: created.id };
}

// ----------------------------------------
// Vérification de similarité sémantique (optionnel, plus lent)
// ----------------------------------------

/**
 * Vérifie si deux règles sont sémantiquement similaires via Claude
 * À utiliser avec parcimonie (coûteux en API calls)
 */
export async function checkSemanticSimilarity(rule1, rule2) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: `Ces deux règles disent-elles la même chose ?

RÈGLE 1: ${rule1}

RÈGLE 2: ${rule2}

Réponds UNIQUEMENT par JSON: {"similar": true/false, "confidence": 0.0-1.0}`,
      },
    ],
  });

  try {
    const response = JSON.parse(message.content[0].text);
    return response.similar && response.confidence > 0.8;
  } catch {
    return false;
  }
}

// ----------------------------------------
// Fusion de règles similaires
// ----------------------------------------

/**
 * Fusionne deux règles en une seule (reformulation)
 */
export async function mergeRules(rule1, rule2) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `Fusionne ces deux règles similaires en UNE SEULE règle concise et claire.

RÈGLE 1: ${rule1}
RÈGLE 2: ${rule2}

Réponds UNIQUEMENT par JSON: {"mergedRule": "la règle fusionnée"}`,
      },
    ],
  });

  try {
    const response = JSON.parse(message.content[0].text);
    return response.mergedRule;
  } catch {
    return rule1; // Fallback sur la première règle
  }
}

// ----------------------------------------
// Nettoyage périodique
// ----------------------------------------

/**
 * Identifie les règles potentiellement obsolètes
 */
export async function flagOutdatedRules(daysOld = 90) {
  // À implémenter : marquer is_active = false pour les vieilles règles
  // sans vérification récente
  console.log(`⏰ Vérification des règles de plus de ${daysOld} jours...`);
}
