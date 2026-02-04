/**
 * GENERATE SMART EMAIL WORKER
 * Cloudflare Worker pour générer des emails personnalisés via Claude API
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
            const { prospect, analysis, campaign_context, email_template } = body;

            // Validation
            if (!prospect || !analysis) {
                return new Response(JSON.stringify({
                    error: 'Prospect et analyse requis'
                }), {
                    status: 400,
                    headers: corsHeaders
                });
            }

            // Générer l'email avec Claude
            const email = await generateEmailWithClaude(
                prospect,
                analysis,
                campaign_context,
                email_template,
                env
            );

            return new Response(JSON.stringify({
                success: true,
                email
            }), {
                headers: corsHeaders
            });

        } catch (error) {
            console.error('Email generation error:', error);
            return new Response(JSON.stringify({
                error: 'Erreur génération email',
                details: error.message
            }), {
                status: 500,
                headers: corsHeaders
            });
        }
    }
};

/**
 * Générer un email personnalisé avec Claude API
 */
async function generateEmailWithClaude(prospect, analysis, campaignContext, emailTemplate, env) {
    const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
        throw new Error('Clé API Anthropic non configurée');
    }

    const prompt = buildEmailPrompt(prospect, analysis, campaignContext, emailTemplate);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1500,
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

    return parseEmailResponse(content, prospect, analysis);
}

/**
 * Construire le prompt de génération d'email
 */
function buildEmailPrompt(prospect, analysis, campaignContext, emailTemplate) {
    // Extraire le prénom
    const firstName = extractFirstName(prospect.full_name);

    // Contexte campagne
    const campaignText = campaignContext ? `
PRODUIT/SERVICE:
${campaignContext.product_description || 'Non spécifié'}

PROPOSITION DE VALEUR:
${campaignContext.value_proposition || 'Non spécifié'}

POINTS DE DOULEUR CIBLÉS:
${(campaignContext.pain_points || []).join(', ') || 'Non spécifiés'}

TON SOUHAITÉ:
${campaignContext.email_tone || 'Professionnel mais humain. Direct. Pas corporate.'}
    `.trim() : '';

    // Template existant si fourni
    const templateText = emailTemplate ? `
TEMPLATE DE BASE (à personnaliser):
Objet: ${emailTemplate.subject || ''}
Corps:
${emailTemplate.body || ''}
    `.trim() : '';

    return `
Tu es un expert en cold email B2B. Tu dois écrire UN email de prospection ultra-personnalisé.

PROSPECT:
- Nom: ${prospect.full_name}
- Prénom: ${firstName}
- Entreprise: ${prospect.company || 'Inconnue'}
- Poste: ${prospect.job_title || 'Inconnu'}

ANGLE CHOISI (utilise UNIQUEMENT cet angle):
${analysis.chosen_angle}

RAISON DE CET ANGLE:
${analysis.angle_reasoning || ''}

SUGGESTION D'ACCROCHE:
${analysis.hook_suggestion || ''}

NIVEAU DE PERSONNALISATION ATTENDU: ${analysis.personalization_level}

${campaignText}

${templateText}

RÈGLES ABSOLUES:
1. L'ACCROCHE (première phrase) doit être 100% personnalisée basée sur l'angle choisi
2. MAXIMUM 5-6 lignes pour le corps de l'email
3. UNE SEULE QUESTION à la fin (pas de proposition de call direct)
4. Ton: naturel, pas de "j'espère que vous allez bien", pas de "je me permets"
5. Pas de liste à puces dans l'email
6. Objet court (5-8 mots max) qui reprend l'angle ou interpelle

STRUCTURE ATTENDUE:
- Ligne 1: Accroche personnalisée (référence directe à l'angle)
- Ligne 2-3: Transition vers le besoin/problème
- Ligne 4-5: Proposition de valeur (1-2 phrases max)
- Ligne 6: Question ouverte qui invite à la réponse

RÉPONDS EN JSON STRICT:
{
    "subject": "L'objet de l'email",
    "body": "Le corps de l'email complet",
    "personalization_used": "L'élément de personnalisation utilisé",
    "estimated_reply_probability": "high|medium|low"
}

SI NIVEAU NONE: Écris un email générique mais professionnel, avec une accroche basée sur le secteur/poste.
    `.trim();
}

/**
 * Parser la réponse email de Claude
 */
function parseEmailResponse(content, prospect, analysis) {
    try {
        // Extraire le JSON
        let jsonStr = content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonStr);

        // Valider et nettoyer
        return {
            subject: cleanEmailText(parsed.subject || `Question pour ${extractFirstName(prospect.full_name)}`),
            body: cleanEmailText(parsed.body || ''),
            personalization_used: parsed.personalization_used || analysis.chosen_angle,
            estimated_reply_probability: validateProbability(parsed.estimated_reply_probability),
            generated_at: new Date().toISOString(),
            angle_used: analysis.chosen_angle,
            personalization_level: analysis.personalization_level
        };

    } catch (error) {
        console.error('Error parsing email response:', error);

        // Générer un email de fallback
        return generateFallbackEmail(prospect, analysis);
    }
}

/**
 * Extraire le prénom
 */
function extractFirstName(fullName) {
    if (!fullName) return '';
    return fullName.split(' ')[0];
}

/**
 * Nettoyer le texte de l'email
 */
function cleanEmailText(text) {
    return text
        .replace(/\\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Valider la probabilité de réponse
 */
function validateProbability(prob) {
    const valid = ['high', 'medium', 'low'];
    return valid.includes(prob) ? prob : 'medium';
}

/**
 * Générer un email de fallback
 */
function generateFallbackEmail(prospect, analysis) {
    const firstName = extractFirstName(prospect.full_name);
    const company = prospect.company || 'votre entreprise';

    let subject, body;

    if (analysis.personalization_level === 'none') {
        subject = `Question rapide, ${firstName}`;
        body = `${firstName},

Je travaille avec des ${prospect.job_title || 'responsables'} dans le secteur de ${company}.

Un défi que j'entends souvent : structurer la croissance sans sacrifier la qualité.

Est-ce un sujet chez vous en ce moment ?

Cordialement`;
    } else {
        subject = `À propos de ${company}`;
        body = `${firstName},

${analysis.hook_suggestion || `J'ai vu l'actualité récente de ${company}.`}

C'est souvent le signe que les enjeux de formation/structuration deviennent prioritaires.

Comment gérez-vous ça actuellement ?

Cordialement`;
    }

    return {
        subject,
        body,
        personalization_used: analysis.chosen_angle,
        estimated_reply_probability: analysis.personalization_level === 'none' ? 'low' : 'medium',
        generated_at: new Date().toISOString(),
        angle_used: analysis.chosen_angle,
        personalization_level: analysis.personalization_level,
        is_fallback: true
    };
}
