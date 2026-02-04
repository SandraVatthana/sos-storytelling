/**
 * ANALYZE RELEVANCE WORKER
 * Cloudflare Worker pour analyser la pertinence des données enrichies via Claude API
 * SOS Storytelling 2026
 */

// Configuration CORS
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

export default {
    async fetch(request, env) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: corsHeaders
            });
        }

        try {
            const body = await request.json();
            const { enrichment_data, campaign_context, prospect } = body;

            // Validation
            if (!enrichment_data || !enrichment_data.raw) {
                return new Response(JSON.stringify({
                    error: 'Données d\'enrichissement requises'
                }), {
                    status: 400,
                    headers: corsHeaders
                });
            }

            // Analyser avec Claude
            const analysis = await analyzeWithClaude(enrichment_data, campaign_context, prospect, env);

            return new Response(JSON.stringify({
                success: true,
                analysis
            }), {
                headers: corsHeaders
            });

        } catch (error) {
            console.error('Analysis error:', error);
            return new Response(JSON.stringify({
                error: 'Erreur analyse',
                details: error.message
            }), {
                status: 500,
                headers: corsHeaders
            });
        }
    }
};

/**
 * Analyser la pertinence avec Claude API
 */
async function analyzeWithClaude(enrichmentData, campaignContext, prospect, env) {
    const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
        throw new Error('Clé API Anthropic non configurée');
    }

    // Construire le prompt d'analyse
    const prompt = buildAnalysisPrompt(enrichmentData, campaignContext, prospect);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 2000,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Claude API error:', errorText);
        throw new Error(`Erreur Claude: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    // Parser la réponse JSON de Claude
    return parseAnalysisResponse(content);
}

/**
 * Construire le prompt d'analyse de pertinence
 */
function buildAnalysisPrompt(enrichmentData, campaignContext, prospect) {
    const personInfo = enrichmentData.raw.person_info || [];
    const companyInfo = enrichmentData.raw.company_info || [];

    // Formater les infos
    const personInfoText = personInfo.length > 0
        ? personInfo.map(i => `- [${i.type}] ${i.summary} (${i.date})`).join('\n')
        : 'Aucune info trouvée sur la personne';

    const companyInfoText = companyInfo.length > 0
        ? companyInfo.map(i => `- [${i.type}] ${i.summary} (${i.date})`).join('\n')
        : 'Aucune info trouvée sur l\'entreprise';

    // Contexte campagne
    const campaignText = campaignContext ? `
CONTEXTE CAMPAGNE:
- Produit/Service: ${campaignContext.product_description || 'Non spécifié'}
- Proposition de valeur: ${campaignContext.value_proposition || 'Non spécifié'}
- Persona cible: ${campaignContext.target_persona || 'Non spécifié'}
- Points de douleur: ${(campaignContext.pain_points || []).join(', ') || 'Non spécifiés'}
- Ton: ${campaignContext.email_tone || 'Professionnel mais humain'}
    `.trim() : 'Aucun contexte campagne fourni';

    return `
Tu es un expert en prospection B2B personnalisée. Ton rôle est d'analyser les informations trouvées sur un prospect et de déterminer le MEILLEUR angle d'approche unique.

PROSPECT:
- Nom: ${prospect.full_name}
- Entreprise: ${prospect.company || 'Inconnue'}
- Poste: ${prospect.job_title || 'Inconnu'}
- Email: ${prospect.email || 'Inconnu'}

INFOS TROUVÉES SUR LA PERSONNE:
${personInfoText}

INFOS TROUVÉES SUR L'ENTREPRISE:
${companyInfoText}

${campaignText}

RÈGLES STRICTES:
1. UN SEUL ANGLE - Choisis l'info la plus récente et pertinente
2. HIÉRARCHIE : Post LinkedIn récent > Levée de fonds > Recrutement > Autre actualité
3. IGNORE les infos non exploitables (trop vagues, trop anciennes, non liées au contexte)
4. Score de confiance = pertinence de l'info × fraîcheur × possibilité de personnalisation

RÉPONDS EN JSON STRICT (pas de texte avant/après):
{
    "relevant_info": [
        {
            "info": "L'information brute",
            "why_relevant": "Pourquoi c'est pertinent pour notre offre",
            "how_to_use": "Comment l'utiliser dans l'accroche"
        }
    ],
    "ignored_info": [
        {
            "info": "L'information ignorée",
            "why_ignored": "Pourquoi on ne l'utilise pas"
        }
    ],
    "chosen_angle": "L'angle d'approche en 1 phrase claire et actionnable",
    "angle_reasoning": "Pourquoi cet angle est le plus fort (2-3 phrases max)",
    "hook_suggestion": "Une proposition d'accroche personnalisée basée sur l'angle choisi",
    "personalization_level": "high|medium|low|none",
    "confidence_score": 85
}

CRITÈRES NIVEAUX DE PERSONNALISATION:
- high (80-100): Post LinkedIn récent + pertinent, ou levée de fonds avec montant
- medium (50-79): Actualité entreprise exploitable, recrutement
- low (20-49): Info vague ou ancienne mais utilisable
- none (0-19): Aucune info pertinente trouvée

Si aucune info pertinente, retourne personalization_level: "none" et confidence_score: 10, avec chosen_angle suggérant une approche générique.
    `.trim();
}

/**
 * Parser la réponse JSON de Claude
 */
function parseAnalysisResponse(content) {
    try {
        // Essayer de trouver le JSON dans la réponse
        let jsonStr = content;

        // Si la réponse contient du texte avant/après le JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonStr);

        // Valider et nettoyer la structure
        return {
            relevant_info: Array.isArray(parsed.relevant_info) ? parsed.relevant_info : [],
            ignored_info: Array.isArray(parsed.ignored_info) ? parsed.ignored_info : [],
            chosen_angle: parsed.chosen_angle || 'Approche directe sans personnalisation',
            angle_reasoning: parsed.angle_reasoning || '',
            hook_suggestion: parsed.hook_suggestion || '',
            personalization_level: validateLevel(parsed.personalization_level),
            confidence_score: validateScore(parsed.confidence_score)
        };

    } catch (error) {
        console.error('Error parsing Claude response:', error, content);

        // Retourner une analyse par défaut
        return {
            relevant_info: [],
            ignored_info: [],
            chosen_angle: 'Approche directe - pas d\'info personnalisée disponible',
            angle_reasoning: 'Impossible de parser l\'analyse. Utiliser une approche générique.',
            hook_suggestion: '',
            personalization_level: 'none',
            confidence_score: 10
        };
    }
}

/**
 * Valider le niveau de personnalisation
 */
function validateLevel(level) {
    const validLevels = ['high', 'medium', 'low', 'none'];
    return validLevels.includes(level) ? level : 'none';
}

/**
 * Valider le score de confiance
 */
function validateScore(score) {
    const num = parseInt(score);
    if (isNaN(num)) return 50;
    return Math.max(0, Math.min(100, num));
}
