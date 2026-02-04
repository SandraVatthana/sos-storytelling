/**
 * ENRICH PROSPECT WORKER
 * Cloudflare Worker pour enrichir les prospects via Perplexity API
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
            const { prospect, campaign } = body;

            // Validation
            if (!prospect || !prospect.full_name) {
                return new Response(JSON.stringify({
                    error: 'Prospect avec nom complet requis'
                }), {
                    status: 400,
                    headers: corsHeaders
                });
            }

            // Construire la requête Perplexity
            const enrichmentData = await enrichWithPerplexity(prospect, campaign, env);

            return new Response(JSON.stringify({
                success: true,
                data: enrichmentData
            }), {
                headers: corsHeaders
            });

        } catch (error) {
            console.error('Enrichment error:', error);
            return new Response(JSON.stringify({
                error: 'Erreur enrichissement',
                details: error.message
            }), {
                status: 500,
                headers: corsHeaders
            });
        }
    }
};

/**
 * Enrichir un prospect via Perplexity API
 */
async function enrichWithPerplexity(prospect, campaign, env) {
    const PERPLEXITY_API_KEY = env.PERPLEXITY_API_KEY;

    if (!PERPLEXITY_API_KEY) {
        throw new Error('Clé API Perplexity non configurée');
    }

    // Construire les recherches
    const personQuery = buildPersonQuery(prospect);
    const companyQuery = buildCompanyQuery(prospect);

    // Exécuter les deux recherches en parallèle
    const [personInfo, companyInfo] = await Promise.all([
        searchPerplexity(personQuery, PERPLEXITY_API_KEY),
        prospect.company ? searchPerplexity(companyQuery, PERPLEXITY_API_KEY) : Promise.resolve(null)
    ]);

    // Parser et structurer les résultats
    const structuredData = {
        raw: {
            person_info: parsePersonInfo(personInfo),
            company_info: parseCompanyInfo(companyInfo)
        },
        enriched_at: new Date().toISOString(),
        sources: {
            person: personInfo?.sources || [],
            company: companyInfo?.sources || []
        }
    };

    return structuredData;
}

/**
 * Construire la requête pour la personne
 */
function buildPersonQuery(prospect) {
    const parts = [];

    parts.push(`"${prospect.full_name}"`);

    if (prospect.company) {
        parts.push(`"${prospect.company}"`);
    }

    if (prospect.job_title) {
        parts.push(`${prospect.job_title}`);
    }

    // Requête optimisée pour LinkedIn et actualités pro
    return `
${parts.join(' ')}

Recherche les informations récentes (derniers 6 mois) sur cette personne :
1. Posts LinkedIn récents et leur contenu principal
2. Changements de poste ou promotions
3. Interventions en conférences ou podcasts
4. Publications ou articles écrits
5. Activités professionnelles notables

Pour chaque info trouvée, indique :
- Le type (linkedin_post, job_change, conference, article, etc.)
- La date approximative
- Un résumé bref (1-2 phrases)

Format: liste structurée avec type/date/résumé pour chaque item.
Si aucune info trouvée, indique "Aucune information récente trouvée".
    `.trim();
}

/**
 * Construire la requête pour l'entreprise
 */
function buildCompanyQuery(prospect) {
    return `
"${prospect.company}" entreprise actualités récentes

Recherche les informations récentes (derniers 6 mois) sur cette entreprise :
1. Levées de fonds (montant, investisseurs, date)
2. Recrutements massifs (combien de postes, quels départements)
3. Lancements de produits ou services
4. Acquisitions ou partenariats
5. Croissance ou expansion (nouveaux marchés, bureaux)
6. Actualités business importantes

Pour chaque info trouvée, indique :
- Le type (funding, hiring, product_launch, acquisition, partnership, expansion, news)
- La date approximative
- Un résumé bref avec les détails clés (montants, chiffres si disponibles)

Format: liste structurée avec type/date/résumé pour chaque item.
Si aucune info trouvée, indique "Aucune information récente trouvée".
    `.trim();
}

/**
 * Appeler l'API Perplexity
 */
async function searchPerplexity(query, apiKey) {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.1-sonar-large-128k-online',
            messages: [
                {
                    role: 'system',
                    content: 'Tu es un assistant de recherche spécialisé dans la veille business et professionnelle. Réponds de façon structurée et concise. Cite tes sources.'
                },
                {
                    role: 'user',
                    content: query
                }
            ],
            temperature: 0.2,
            max_tokens: 2000,
            return_citations: true,
            search_recency_filter: 'month'
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Perplexity API error:', errorText);
        throw new Error(`Erreur Perplexity: ${response.status}`);
    }

    const data = await response.json();

    return {
        content: data.choices?.[0]?.message?.content || '',
        sources: data.citations || []
    };
}

/**
 * Parser les infos de la personne
 */
function parsePersonInfo(perplexityResult) {
    if (!perplexityResult || !perplexityResult.content) {
        return [];
    }

    const content = perplexityResult.content;
    const infos = [];

    // Patterns pour extraire les infos structurées
    const patterns = [
        { type: 'linkedin_post', regex: /(?:linkedin|post|publication).*?:?\s*([^.\n]+(?:\.[^.\n]+)?)/gi },
        { type: 'job_change', regex: /(?:nouveau poste|promotion|nommé|rejoint|devient).*?:?\s*([^.\n]+(?:\.[^.\n]+)?)/gi },
        { type: 'conference', regex: /(?:conférence|intervention|keynote|speaker).*?:?\s*([^.\n]+(?:\.[^.\n]+)?)/gi },
        { type: 'article', regex: /(?:article|publication|écrit|publié).*?:?\s*([^.\n]+(?:\.[^.\n]+)?)/gi }
    ];

    // Essayer d'extraire les infos avec les patterns
    for (const { type, regex } of patterns) {
        let match;
        while ((match = regex.exec(content)) !== null) {
            infos.push({
                type,
                date: extractDate(content, match.index) || 'Récent',
                summary: cleanSummary(match[1])
            });
        }
    }

    // Si pas d'infos structurées, découper le contenu en paragraphes
    if (infos.length === 0 && content.length > 50) {
        const lines = content.split('\n').filter(l => l.trim().length > 20);
        for (const line of lines.slice(0, 5)) {
            if (!line.toLowerCase().includes('aucune information')) {
                infos.push({
                    type: 'info',
                    date: 'Récent',
                    summary: cleanSummary(line)
                });
            }
        }
    }

    return infos;
}

/**
 * Parser les infos de l'entreprise
 */
function parseCompanyInfo(perplexityResult) {
    if (!perplexityResult || !perplexityResult.content) {
        return [];
    }

    const content = perplexityResult.content;
    const infos = [];

    // Patterns spécifiques entreprise
    const patterns = [
        { type: 'funding', regex: /(?:levée|lève|financ|million|investiss).*?:?\s*([^.\n]+(?:\.[^.\n]+)?)/gi },
        { type: 'hiring', regex: /(?:recrut|embauche|poste|équipe).*?:?\s*([^.\n]+(?:\.[^.\n]+)?)/gi },
        { type: 'product_launch', regex: /(?:lance|lancement|nouveau produit|nouvelle solution).*?:?\s*([^.\n]+(?:\.[^.\n]+)?)/gi },
        { type: 'acquisition', regex: /(?:acqui|rachat|fusion).*?:?\s*([^.\n]+(?:\.[^.\n]+)?)/gi },
        { type: 'partnership', regex: /(?:partenariat|alliance|collaboration avec).*?:?\s*([^.\n]+(?:\.[^.\n]+)?)/gi },
        { type: 'expansion', regex: /(?:expansion|nouveau marché|ouvre|croissance).*?:?\s*([^.\n]+(?:\.[^.\n]+)?)/gi },
        { type: 'news', regex: /(?:annonce|actualité|nouveau).*?:?\s*([^.\n]+(?:\.[^.\n]+)?)/gi }
    ];

    for (const { type, regex } of patterns) {
        let match;
        while ((match = regex.exec(content)) !== null) {
            // Éviter les doublons
            const summary = cleanSummary(match[1]);
            if (!infos.some(i => i.summary === summary)) {
                infos.push({
                    type,
                    date: extractDate(content, match.index) || 'Récent',
                    summary
                });
            }
        }
    }

    // Fallback
    if (infos.length === 0 && content.length > 50) {
        const lines = content.split('\n').filter(l => l.trim().length > 20);
        for (const line of lines.slice(0, 5)) {
            if (!line.toLowerCase().includes('aucune information')) {
                infos.push({
                    type: 'news',
                    date: 'Récent',
                    summary: cleanSummary(line)
                });
            }
        }
    }

    return infos;
}

/**
 * Extraire une date approximative du contexte
 */
function extractDate(text, position) {
    // Chercher une date proche de la position
    const contextStart = Math.max(0, position - 100);
    const contextEnd = Math.min(text.length, position + 100);
    const context = text.substring(contextStart, contextEnd);

    // Patterns de date
    const datePatterns = [
        /il y a (\d+) (?:jour|semaine|mois)/i,
        /(\d{1,2})\s*(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s*(\d{4})?/i,
        /(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s*(\d{4})/i,
        /(\d{4})/
    ];

    for (const pattern of datePatterns) {
        const match = context.match(pattern);
        if (match) {
            return match[0];
        }
    }

    return null;
}

/**
 * Nettoyer un résumé
 */
function cleanSummary(text) {
    return text
        .replace(/^\s*[-•*]\s*/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 300);
}
