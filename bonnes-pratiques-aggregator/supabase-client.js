// ========================================
// Module Supabase
// ========================================

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

// ----------------------------------------
// Newsletters
// ----------------------------------------

/**
 * Récupère les newsletters en attente de traitement
 */
export async function getUnprocessedNewsletters(limit = 5) {
  const { data, error } = await supabase
    .from('newsletter_raw')
    .select('*')
    .eq('status', 'raw')
    .order('captured_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Met à jour le statut d'une newsletter
 */
export async function updateNewsletterStatus(id, status, extractedRules = null, errorMessage = null) {
  const update = { status };
  if (extractedRules) update.extracted_rules = extractedRules;
  if (errorMessage) update.error_message = errorMessage;

  const { error } = await supabase
    .from('newsletter_raw')
    .update(update)
    .eq('id', id);

  if (error) throw error;
}

// ----------------------------------------
// Bonnes Pratiques
// ----------------------------------------

/**
 * Cherche une règle similaire existante par hash
 */
export async function findSimilarRule(ruleHash) {
  const { data, error } = await supabase
    .from('bonnes_pratiques')
    .select('*')
    .eq('rule_hash', ruleHash)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

/**
 * Crée une nouvelle bonne pratique
 */
export async function createBonnePratique(rule) {
  const { data, error } = await supabase
    .from('bonnes_pratiques')
    .insert({
      rule: rule.rule,
      rule_hash: rule.ruleHash,
      category: rule.category,
      platforms: rule.platforms,
      confidence: rule.confidence || 'tendance',
      sources: rule.sources,
      last_verified: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Met à jour une bonne pratique existante (ajoute une source)
 */
export async function updateBonnePratique(id, newSource, newConfidence = null) {
  // Récupérer l'existant
  const { data: existing, error: fetchError } = await supabase
    .from('bonnes_pratiques')
    .select('sources, confidence')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  // Ajouter la nouvelle source
  const updatedSources = [...(existing.sources || []), newSource];
  
  // Si plusieurs sources concordent, passer en "consensus"
  const updatedConfidence = updatedSources.length >= 2 ? 'consensus' : (newConfidence || existing.confidence);

  const { error } = await supabase
    .from('bonnes_pratiques')
    .update({
      sources: updatedSources,
      confidence: updatedConfidence,
      last_verified: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Récupère les bonnes pratiques actives pour une plateforme
 */
export async function getBonnesPratiques(platform = null, category = null, limit = 10) {
  let query = supabase
    .from('v_bonnes_pratiques_actives')
    .select('*')
    .limit(limit);

  if (platform) {
    query = query.contains('platforms', [platform]);
  }
  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
