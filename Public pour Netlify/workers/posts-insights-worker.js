/**
 * POSTS INSIGHTS WORKER
 * Cloudflare Worker pour générer des insights IA sur les performances des posts
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
            const { posts } = await request.json();

            if (!posts || !Array.isArray(posts) || posts.length < 3) {
                return new Response(JSON.stringify({
                    error: 'Au moins 3 posts requis pour générer des insights'
                }), {
                    status: 400,
                    headers: corsHeaders
                });
            }

            const insights = await generateInsights(posts, env);

            return new Response(JSON.stringify({
                success: true,
                insights
            }), {
                headers: corsHeaders
            });

        } catch (error) {
            console.error('Insights error:', error);
            return new Response(JSON.stringify({
                error: 'Erreur génération insights',
                details: error.message
            }), {
                status: 500,
                headers: corsHeaders
            });
        }
    }
};

async function generateInsights(posts, env) {
    const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
        throw new Error('Clé API Anthropic non configurée');
    }

    // Préparer les données pour l'analyse
    const postsData = posts.map((p, i) => ({
        index: i + 1,
        platform: p.platform,
        date: p.date,
        content_preview: p.content?.substring(0, 300) || 'N/A',
        views: p.views,
        likes: p.likes,
        comments: p.comments,
        reposts: p.reposts,
        engagement_rate: p.engagement_rate ? p.engagement_rate.toFixed(2) + '%' : 'N/A',
        has_image: p.has_image,
        has_video: p.has_video,
        format: p.format
    }));

    // Calculer quelques stats
    const avgEngagement = posts.filter(p => p.engagement_rate).reduce((sum, p) => sum + p.engagement_rate, 0) / posts.filter(p => p.engagement_rate).length || 0;
    const topPosts = [...posts].sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0)).slice(0, 3);
    const flopPosts = [...posts].sort((a, b) => (a.engagement_rate || 0) - (b.engagement_rate || 0)).slice(0, 3);

    const prompt = `Tu es un expert en stratégie de contenu sur les réseaux sociaux. Analyse ces données de performance et génère des insights actionnables.

## DONNÉES DES POSTS (${posts.length} posts)

${JSON.stringify(postsData, null, 2)}

## STATS CALCULÉES

- Engagement moyen : ${avgEngagement.toFixed(2)}%
- Top 3 posts (meilleur engagement) : Posts #${topPosts.map((p, i) => posts.indexOf(p) + 1).join(', #')}
- Flop 3 posts (pire engagement) : Posts #${flopPosts.map((p, i) => posts.indexOf(p) + 1).join(', #')}

## TA MISSION

Analyse ces données et retourne UNIQUEMENT un JSON valide avec cette structure :

{
    "summary": "<Résumé en 2-3 phrases de la performance globale. Sois direct et honnête.>",

    "what_works": [
        "<Point 1 : ce qui fonctionne bien, avec exemple concret de post si possible>",
        "<Point 2>",
        "<Point 3 si pertinent>"
    ],

    "what_doesnt_work": [
        "<Point 1 : ce qui ne fonctionne pas, avec exemple concret>",
        "<Point 2 si pertinent>"
    ],

    "recommendations": [
        "<Recommandation 1 : action concrète et spécifique>",
        "<Recommandation 2>",
        "<Recommandation 3>"
    ],

    "best_time": "<Analyse des dates/jours qui semblent mieux performer, ou 'Pas assez de données' si insuffisant>",

    "content_ideas": [
        "<Idée 1 basée sur ce qui a bien marché>",
        "<Idée 2>",
        "<Idée 3>"
    ],

    "platform_insights": {
        "<plateforme>": "<Insight spécifique pour cette plateforme si plusieurs plateformes>"
    }
}

## RÈGLES

1. Sois HONNÊTE et DIRECT. Pas de flatterie.
2. Base-toi sur les DONNÉES réelles, pas sur des généralités.
3. Cite des exemples spécifiques (Post #X a bien marché parce que...).
4. Les recommandations doivent être ACTIONNABLES et SPÉCIFIQUES.
5. Si les données sont insuffisantes pour certaines analyses, dis-le.
6. Compare les posts entre eux pour identifier les patterns.

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2500,
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
    const responseText = data.content?.[0]?.text || '';

    return parseInsightsResponse(responseText);
}

function parseInsightsResponse(content) {
    try {
        let jsonStr = content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonStr);

        return {
            summary: parsed.summary || 'Analyse terminée',
            what_works: Array.isArray(parsed.what_works) ? parsed.what_works : [],
            what_doesnt_work: Array.isArray(parsed.what_doesnt_work) ? parsed.what_doesnt_work : [],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            best_time: parsed.best_time || null,
            content_ideas: Array.isArray(parsed.content_ideas) ? parsed.content_ideas : [],
            platform_insights: parsed.platform_insights || {}
        };

    } catch (error) {
        console.error('Error parsing insights response:', error, content);
        throw new Error('Impossible de parser les insights');
    }
}
