// ========================================
// Module d'extraction IA (Claude API)
// ========================================

import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
});

// ----------------------------------------
// Prompt d'extraction
// ----------------------------------------

const EXTRACTION_PROMPT = `Tu es un expert en stratégie de contenu sur les réseaux sociaux. 

Ta mission : extraire les RÈGLES ACTIONNABLES d'une newsletter sur le marketing digital / réseaux sociaux.

IMPORTANT - Ce que tu dois extraire :
- Les conseils CONCRETS et ACTIONNABLES (pas les généralités)
- Les règles sur les algorithmes (ce qui booste ou pénalise)
- Les formats qui fonctionnent (carrousels, hooks, structures)
- Les erreurs à éviter
- Les timings recommandés
- Les tactiques d'engagement

IMPORTANT - Ce que tu NE dois PAS extraire :
- Les anecdotes personnelles de l'auteur
- Les généralités vagues ("soyez authentique")
- Les promotions/pubs
- Le contenu non lié aux réseaux sociaux

Pour chaque règle extraite, tu dois fournir :
1. La règle reformulée EN TES PROPRES MOTS (ne copie jamais verbatim)
2. Un extrait court (max 10 mots) du texte original pour sourcer
3. La catégorie : algorithme | format | timing | engagement | erreurs | copywriting | strategie
4. Les plateformes concernées : linkedin | instagram | tiktok | twitter | facebook | youtube | general

Réponds UNIQUEMENT en JSON valide avec ce format :
{
  "rules": [
    {
      "rule": "La règle reformulée en tes mots",
      "originalExcerpt": "extrait court original",
      "category": "algorithme",
      "platforms": ["linkedin"]
    }
  ],
  "meta": {
    "totalRulesFound": 3,
    "mainTopics": ["algorithme LinkedIn", "engagement"]
  }
}

Si aucune règle actionnable n'est trouvée, retourne :
{
  "rules": [],
  "meta": {
    "totalRulesFound": 0,
    "reason": "Contenu sans conseil actionnable"
  }
}`;

// ----------------------------------------
// Fonction d'extraction
// ----------------------------------------

/**
 * Extrait les règles d'une newsletter via Claude
 */
export async function extractRulesFromNewsletter(newsletter) {
  const { source, subject, content } = newsletter;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}

---

SOURCE : ${source}
SUJET : ${subject || 'Sans sujet'}
DATE : ${newsletter.captured_at}

CONTENU DE LA NEWSLETTER :
${truncateContent(content, 8000)}

---

Extrais les règles actionnables de cette newsletter.`,
        },
      ],
    });

    // Parser la réponse JSON
    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Réponse non-JSON de Claude');
    }

    const extracted = JSON.parse(jsonMatch[0]);
    
    // Ajouter les métadonnées de source à chaque règle
    extracted.rules = extracted.rules.map(rule => ({
      ...rule,
      source: {
        name: source,
        date: newsletter.captured_at,
        excerpt: rule.originalExcerpt,
      },
    }));

    return extracted;

  } catch (error) {
    console.error(`❌ Erreur extraction pour "${subject}":`, error.message);
    throw error;
  }
}

// ----------------------------------------
// Utilitaires
// ----------------------------------------

/**
 * Tronque le contenu pour ne pas dépasser la limite de tokens
 */
function truncateContent(content, maxChars) {
  if (content.length <= maxChars) return content;
  
  // Garder le début et la fin
  const halfMax = Math.floor(maxChars / 2);
  return (
    content.substring(0, halfMax) +
    '\n\n[... contenu tronqué ...]\n\n' +
    content.substring(content.length - halfMax)
  );
}

/**
 * Génère un hash simple pour détecter les doublons
 */
export function generateRuleHash(ruleText) {
  // Normalise : minuscules, sans ponctuation, espaces simplifiés
  const normalized = ruleText
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëïîôùûüç\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Hash simple (pour prod, utiliser crypto.createHash)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
