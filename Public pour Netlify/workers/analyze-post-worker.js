/**
 * ANALYZE POST WORKER - Version Screenshot
 * Cloudflare Worker pour extraire les données d'un post via capture d'écran
 * SOS Storytelling 2026
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

export default {
    async fetch(request, env) {
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
            const { image, platform } = await request.json();

            if (!image) {
                return new Response(JSON.stringify({
                    error: 'Capture d\'écran requise'
                }), {
                    status: 400,
                    headers: corsHeaders
                });
            }

            // Analyser l'image avec Claude Vision
            const extractedData = await extractPostData(image, platform, env);

            return new Response(JSON.stringify({
                success: true,
                data: extractedData
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

async function extractPostData(imageBase64, platform, env) {
    const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
        throw new Error('Clé API Anthropic non configurée');
    }

    // Nettoyer le base64 si nécessaire
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // Déterminer le type d'image
    let mediaType = 'image/png';
    if (imageBase64.startsWith('data:image/jpeg')) {
        mediaType = 'image/jpeg';
    } else if (imageBase64.startsWith('data:image/webp')) {
        mediaType = 'image/webp';
    }

    const prompt = `Tu es un expert en analyse de posts sur les réseaux sociaux.

Analyse cette capture d'écran d'un post ${platform || 'réseau social'} et extrais TOUTES les informations visibles.

IMPORTANT : Extrais les données EXACTES visibles sur l'image. Ne devine pas, n'invente pas.

Retourne UNIQUEMENT un JSON valide avec cette structure :

{
    "platform": "<linkedin|instagram|twitter|facebook|threads|tiktok|autre>",
    "content": "<Le texte complet du post, tel qu'il apparaît>",
    "author": "<Nom de l'auteur si visible>",
    "date": "<Date de publication si visible, format YYYY-MM-DD si possible>",
    "stats": {
        "views": <nombre de vues/impressions si visible, sinon null>,
        "likes": <nombre de likes/réactions si visible, sinon null>,
        "comments": <nombre de commentaires si visible, sinon null>,
        "reposts": <nombre de reposts/partages si visible, sinon null>,
        "clicks": <nombre de clics si visible, sinon null>
    },
    "has_image": <true si le post contient une image/visuel, false sinon>,
    "has_video": <true si le post contient une vidéo, false sinon>,
    "has_carousel": <true si c'est un carrousel, false sinon>,
    "has_link": <true si le post contient un lien externe, false sinon>,
    "hashtags": ["<liste des hashtags visibles>"],
    "confidence": "<high|medium|low - ta confiance dans l'extraction>"
}

RÈGLES :
1. Si une stat n'est pas visible, mets null (pas 0)
2. Pour les vues LinkedIn, cherche "impressions" ou l'icône œil
3. Convertis les abréviations : "1.2K" = 1200, "5K" = 5000, etc.
4. Le contenu doit être le texte EXACT du post
5. Réponds UNIQUEMENT avec le JSON, sans texte avant ou après`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mediaType,
                                data: base64Data
                            }
                        },
                        {
                            type: 'text',
                            text: prompt
                        }
                    ]
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
    const responseText = data.content?.[0]?.text || '';

    // Parser le JSON
    return parseExtractedData(responseText);
}

function parseExtractedData(content) {
    try {
        let jsonStr = content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonStr);

        // Valider et nettoyer la structure
        return {
            platform: parsed.platform || 'autre',
            content: parsed.content || '',
            author: parsed.author || null,
            date: parsed.date || null,
            stats: {
                views: parsed.stats?.views ?? null,
                likes: parsed.stats?.likes ?? null,
                comments: parsed.stats?.comments ?? null,
                reposts: parsed.stats?.reposts ?? null,
                clicks: parsed.stats?.clicks ?? null
            },
            has_image: !!parsed.has_image,
            has_video: !!parsed.has_video,
            has_carousel: !!parsed.has_carousel,
            has_link: !!parsed.has_link,
            hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
            confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium'
        };

    } catch (error) {
        console.error('Error parsing extracted data:', error, content);
        throw new Error('Impossible d\'extraire les données de l\'image');
    }
}
