/**
 * SOS Audit Agent - Cloudflare Worker
 * Analyse des profils réseaux sociaux et génération de stratégie
 */

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

// Handle OPTIONS preflight
function handleOptions() {
    return new Response(null, { status: 204, headers: corsHeaders });
}

// Error response helper
function errorResponse(message, status = 400) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: corsHeaders
    });
}

// Success response helper
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: corsHeaders
    });
}

// Main router
export default {
    async fetch(request, env, ctx) {
        if (request.method === 'OPTIONS') {
            return handleOptions();
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // Debug endpoint
            if (path === '/debug') {
                return jsonResponse({
                    status: 'ok',
                    config_check: {
                        supabase_url: env.supabase_url ? env.supabase_url.substring(0, 30) + '...' : 'NOT SET',
                        supabase_key: env.supabase_key ? `SET (${env.supabase_key.length} chars)` : 'NOT SET',
                        anthropic_key: env.anthropic_key ? `SET (${env.anthropic_key.length} chars)` : 'NOT SET',
                        apify_key: env.apify_key ? `SET (${env.apify_key.length} chars)` : 'NOT SET'
                    }
                });
            }

            // Health check
            if (path === '/health') {
                return jsonResponse({ status: 'healthy', service: 'sos-audit-agent' });
            }

            // Test endpoint - vérifie chaque étape
            if (path === '/test') {
                const results = { steps: [] };

                // Test 1: Supabase connection
                try {
                    const testQuery = await fetch(`${env.supabase_url}/rest/v1/audits?limit=1`, {
                        headers: {
                            'apikey': env.supabase_key,
                            'Authorization': `Bearer ${env.supabase_key}`
                        }
                    });
                    results.steps.push({ step: 'supabase', status: testQuery.ok ? 'OK' : 'FAIL', code: testQuery.status });
                } catch (e) {
                    results.steps.push({ step: 'supabase', status: 'ERROR', error: e.message });
                }

                // Test 2: Claude API
                try {
                    const claudeTest = await fetch('https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': env.anthropic_key,
                            'anthropic-version': '2023-06-01'
                        },
                        body: JSON.stringify({
                            model: 'claude-3-haiku-20240307',
                            max_tokens: 10,
                            messages: [{ role: 'user', content: 'Hi' }]
                        })
                    });
                    results.steps.push({ step: 'claude', status: claudeTest.ok ? 'OK' : 'FAIL', code: claudeTest.status });
                } catch (e) {
                    results.steps.push({ step: 'claude', status: 'ERROR', error: e.message });
                }

                // Test 3: Mock scraping
                results.steps.push({ step: 'mock_scrape', status: 'OK', note: 'Uses mock data if no Apify key' });

                return jsonResponse(results);
            }

            // Trace audit - debug endpoint qui simule le flow complet avec logs
            if (path === '/trace-audit') {
                const startTime = Date.now();
                const trace = [];

                try {
                    // Step 1: Mock scraping
                    trace.push({ step: 1, action: 'scrape', start: Date.now() - startTime });
                    const scrapedData = getMockProfileData('instagram', 'test_user');
                    trace.push({ step: 1, action: 'scrape', end: Date.now() - startTime, result: 'OK' });

                    // Step 2: Claude analyze avec le VRAI prompt
                    trace.push({ step: 2, action: 'analyze_start', start: Date.now() - startTime, model: 'claude-3-5-haiku-20241022' });

                    const auditResult = await analyzeProfile('instagram', scrapedData, { industry: 'Test' }, env);
                    trace.push({
                        step: 2,
                        action: 'analyze_end',
                        end: Date.now() - startTime,
                        hasError: !!auditResult?.error,
                        hasScore: !!auditResult?.diagnostic?.score,
                        preview: JSON.stringify(auditResult).substring(0, 300)
                    });

                    if (auditResult?.error) {
                        return jsonResponse({
                            success: false,
                            total_time_ms: Date.now() - startTime,
                            trace,
                            error: auditResult.error
                        });
                    }

                    // Step 3: Generate posts avec le VRAI prompt
                    trace.push({ step: 3, action: 'generate_posts_start', start: Date.now() - startTime });

                    const posts = await generateInitialPosts('instagram', scrapedData, { industry: 'Test' }, auditResult, env);
                    trace.push({
                        step: 3,
                        action: 'generate_posts_end',
                        end: Date.now() - startTime,
                        posts_count: posts?.length || 0
                    });

                    return jsonResponse({
                        success: true,
                        total_time_ms: Date.now() - startTime,
                        trace,
                        result_preview: {
                            score: auditResult?.diagnostic?.score,
                            strengths_count: auditResult?.diagnostic?.strengths?.length || 0,
                            posts_generated: posts?.length || 0
                        }
                    });

                } catch (error) {
                    trace.push({ error: error.message, time: Date.now() - startTime });
                    return jsonResponse({
                        success: false,
                        total_time_ms: Date.now() - startTime,
                        trace,
                        error: error.message
                    });
                }
            }

            // Run full audit synchronously (for debugging)
            if (path === '/run-full-audit' && request.method === 'POST') {
                const startTime = Date.now();
                const body = await request.json();
                const { platform, profile_url, user_id } = body;
                const trace = [];

                try {
                    // Create audit in DB
                    const auditId = crypto.randomUUID();
                    const username = extractUsername(profile_url || 'https://instagram.com/test', platform || 'instagram');

                    trace.push({ step: 'create', time: Date.now() - startTime });
                    const insertResult = await supabaseQuery(env, 'audits', 'POST', {
                        id: auditId,
                        user_id: user_id || '00000000-0000-0000-0000-000000000000',
                        platform: platform || 'instagram',
                        profile_url: profile_url || 'https://instagram.com/test',
                        profile_username: username,
                        status: 'scraping',
                        created_at: new Date().toISOString()
                    });
                    trace.push({ step: 'create_done', time: Date.now() - startTime, success: !insertResult.error, error: insertResult.error?.message });

                    if (insertResult.error) {
                        return jsonResponse({ success: false, trace, error: insertResult.error });
                    }

                    // Scrape
                    trace.push({ step: 'scrape', time: Date.now() - startTime });
                    const scrapedData = getMockProfileData(platform || 'instagram', username);
                    trace.push({ step: 'scrape_done', time: Date.now() - startTime });

                    // Update status to analyzing
                    trace.push({ step: 'update_analyzing', time: Date.now() - startTime });
                    const updateResult1 = await updateAuditStatus(auditId, 'analyzing', env, { scraped_data: scrapedData });
                    trace.push({ step: 'update_analyzing_done', time: Date.now() - startTime, result: updateResult1 });

                    // Analyze
                    trace.push({ step: 'analyze', time: Date.now() - startTime });
                    const auditResult = await analyzeProfile(platform || 'instagram', scrapedData, {}, env);
                    trace.push({ step: 'analyze_done', time: Date.now() - startTime, hasError: !!auditResult?.error, score: auditResult?.diagnostic?.score });

                    // Generate posts
                    trace.push({ step: 'generate', time: Date.now() - startTime });
                    const posts = await generateInitialPosts(platform || 'instagram', scrapedData, {}, auditResult, env);
                    trace.push({ step: 'generate_done', time: Date.now() - startTime, posts_count: posts?.length });

                    // Save posts
                    if (posts && posts.length > 0) {
                        trace.push({ step: 'save_posts', time: Date.now() - startTime });
                        for (const post of posts) {
                            await supabaseQuery(env, 'audit_generated_posts', 'POST', {
                                audit_id: auditId,
                                week_number: post.week,
                                post_type: post.type,
                                hook: post.hook,
                                content: post.content,
                                hashtags: post.hashtags,
                                visual_suggestion: post.visual_suggestion,
                                best_posting_time: post.best_posting_time
                            });
                        }
                        trace.push({ step: 'save_posts_done', time: Date.now() - startTime });
                    }

                    // Final update
                    trace.push({ step: 'final_update', time: Date.now() - startTime });
                    const finalUpdate = await updateAuditStatus(auditId, 'completed', env, {
                        audit_result: auditResult,
                        completed_at: new Date().toISOString()
                    });
                    trace.push({ step: 'final_update_done', time: Date.now() - startTime, result: finalUpdate });

                    return jsonResponse({
                        success: true,
                        audit_id: auditId,
                        total_time_ms: Date.now() - startTime,
                        trace
                    });

                } catch (error) {
                    trace.push({ step: 'error', time: Date.now() - startTime, message: error.message });
                    return jsonResponse({ success: false, trace, error: error.message });
                }
            }

            // Create audit
            if (path === '/audits/create' && request.method === 'POST') {
                return await createAudit(request, env, ctx);
            }

            // Get all audits for a user
            if (path.match(/^\/audits\/user\/[a-f0-9-]+$/) && request.method === 'GET') {
                const userId = path.split('/')[3];
                return await getUserAudits(userId, env);
            }

            // Get audit status/result
            if (path.match(/^\/audits\/[a-f0-9-]+$/) && request.method === 'GET') {
                const auditId = path.split('/')[2];
                return await getAudit(auditId, env);
            }

            // Generate more posts for an audit
            if (path.match(/^\/audits\/[a-f0-9-]+\/generate-more$/) && request.method === 'POST') {
                const auditId = path.split('/')[2];
                return await generateMorePosts(auditId, request, env);
            }

            return errorResponse('Route non trouvée', 404);

        } catch (error) {
            console.error('Worker error:', error);
            return errorResponse(`Erreur serveur: ${error.message}`, 500);
        }
    }
};

/**
 * Create a new audit
 */
async function createAudit(request, env, ctx) {
    const body = await request.json();
    const { platform, profile_url, business_context, user_id, profile_data } = body;

    // Validation
    if (!platform || !profile_url || !user_id) {
        return errorResponse('platform, profile_url et user_id sont requis');
    }

    if (!['instagram', 'tiktok', 'linkedin'].includes(platform)) {
        return errorResponse('Platform doit être instagram, tiktok ou linkedin');
    }

    // Extract username from URL
    const username = extractUsername(profile_url, platform);
    if (!username) {
        return errorResponse('URL de profil invalide');
    }

    // Create audit record in Supabase
    const auditId = crypto.randomUUID();
    const auditData = {
        id: auditId,
        user_id,
        platform,
        profile_url,
        profile_username: username,
        business_context: business_context || {},
        status: 'scraping',
        created_at: new Date().toISOString()
    };

    const insertResult = await supabaseQuery(env, 'audits', 'POST', auditData);
    if (insertResult.error) {
        return errorResponse(`Erreur création audit: ${insertResult.error.message}`, 500);
    }

    // Start async processing with waitUntil to keep worker alive
    // Pass profile_data if provided by user
    ctx.waitUntil(processAuditAsync(auditId, platform, username, business_context, env, profile_data));

    return jsonResponse({
        success: true,
        audit_id: auditId,
        status: 'scraping',
        message: 'Audit démarré, scraping en cours...'
    });
}

/**
 * Process audit asynchronously
 */
async function processAuditAsync(auditId, platform, username, businessContext, env, userProvidedData = null) {
    const startTime = Date.now();
    const logStep = (step) => console.log(`[${auditId}] ${step} at ${Date.now() - startTime}ms`);

    try {
        // Step 1: Get profile data (from user input or scraping)
        logStep('STEP1_START: get profile data');
        let scrapedData;

        if (userProvidedData && Object.keys(userProvidedData).length > 0) {
            // Use user-provided data
            logStep('Using user-provided profile data');
            scrapedData = buildProfileFromUserData(platform, username, userProvidedData);
        } else {
            // Try scraping
            scrapedData = await scrapeProfile(platform, username, env);
        }
        logStep('STEP1_END: profile data ready');

        if (!scrapedData || scrapedData.error) {
            await updateAuditStatus(auditId, 'failed', env, {
                error_message: scrapedData?.error || 'Échec du scraping'
            });
            return;
        }

        // Step 2: Update with scraped data + analyze
        logStep('STEP2_START: analyze');
        await updateAuditStatus(auditId, 'analyzing', env, {
            scraped_data: scrapedData
        });

        const auditResult = await analyzeProfile(platform, scrapedData, businessContext, env);
        logStep('STEP2_END: analyze done');

        if (!auditResult || auditResult.error) {
            await updateAuditStatus(auditId, 'failed', env, {
                error_message: 'Échec de l\'analyse IA'
            });
            return;
        }

        // Step 3: Generate posts
        logStep('STEP3_START: generate posts');
        const posts = await generateInitialPosts(platform, scrapedData, businessContext, auditResult, env);
        logStep(`STEP3_END: generated ${posts?.length || 0} posts`);

        // Step 4: Save posts to database
        if (posts && posts.length > 0) {
            logStep('STEP4_START: saving posts');
            for (const post of posts) {
                await supabaseQuery(env, 'audit_generated_posts', 'POST', {
                    audit_id: auditId,
                    week_number: post.week,
                    post_type: post.type,
                    hook: post.hook,
                    content: post.content,
                    hashtags: post.hashtags,
                    visual_suggestion: post.visual_suggestion,
                    best_posting_time: post.best_posting_time
                });
            }
            logStep('STEP4_END: posts saved');
        }

        // Step 5: GEO Analysis
        logStep('STEP5_START: GEO analysis');
        const geoAnalysis = analyzeGEO(scrapedData, scrapedData.recent_posts || []);
        logStep('STEP5_END: GEO analysis done');

        // Update final status with audit result + GEO
        const totalTime = Date.now() - startTime;
        await updateAuditStatus(auditId, 'completed', env, {
            audit_result: {
                ...auditResult,
                geo: geoAnalysis
            },
            completed_at: new Date().toISOString()
        });

        logStep(`COMPLETED in ${totalTime}ms`);

    } catch (error) {
        console.error(`[${auditId}] Audit failed at ${Date.now() - startTime}ms:`, error);
        await updateAuditStatus(auditId, 'failed', env, {
            error_message: error.message,
            failed_at_step: 'unknown',
            error_stack: error.stack?.substring(0, 500)
        });
    }
}

/**
 * Scrape profile using Apify (avec timeout court) ou mock data
 */
async function scrapeProfile(platform, username, env) {
    const apifyKey = env.apify_key;

    // Pour l'instant, utiliser mock data pour éviter les timeouts Apify
    // TODO: Réactiver Apify quand le scraping sera plus fiable
    console.log(`[Scrape] Using mock data for ${platform}/${username}`);
    return getMockProfileData(platform, username);

    /* COMMENTÉ - Apify prend trop de temps et cause des timeouts
    if (!apifyKey) {
        console.log('No Apify key, using mock data');
        return getMockProfileData(platform, username);
    }

    try {
        let actorId, input;

        switch (platform) {
            case 'instagram':
                actorId = 'apify/instagram-profile-scraper';
                input = {
                    usernames: [username],
                    resultsLimit: 12
                };
                break;

            case 'tiktok':
                actorId = 'clockworks/tiktok-scraper';
                input = {
                    profiles: [username],
                    resultsPerPage: 12
                };
                break;

            case 'linkedin':
                actorId = 'anchor/linkedin-profile-scraper';
                input = {
                    profileUrls: [`https://www.linkedin.com/in/${username}`]
                };
                break;

            default:
                return { error: 'Platform non supportée' };
        }

        // Run Apify actor
        const runResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });

        if (!runResponse.ok) {
            console.error('Apify run failed:', await runResponse.text());
            return getMockProfileData(platform, username);
        }

        const runData = await runResponse.json();
        const runId = runData.data.id;

        // Wait for completion (poll)
        let status = 'RUNNING';
        let attempts = 0;
        const maxAttempts = 30; // 30 * 2s = 60s max

        while (status === 'RUNNING' && attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000));

            const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`);
            const statusData = await statusResponse.json();
            status = statusData.data.status;
            attempts++;
        }

        if (status !== 'SUCCEEDED') {
            console.error('Apify run did not succeed:', status);
            return getMockProfileData(platform, username);
        }

        // Get results
        const resultsResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyKey}`);
        const results = await resultsResponse.json();

        if (!results || results.length === 0) {
            return getMockProfileData(platform, username);
        }

        return normalizeScrapedData(platform, results);

    } catch (error) {
        console.error('Scraping error:', error);
        return getMockProfileData(platform, username);
    }
    */
}

/**
 * Normalize scraped data to common format
 */
function normalizeScrapedData(platform, rawData) {
    const profile = rawData[0] || {};

    return {
        platform,
        username: profile.username || profile.profileName || '',
        display_name: profile.fullName || profile.name || profile.displayName || '',
        bio: profile.biography || profile.bio || profile.description || '',
        followers: profile.followersCount || profile.followers || profile.followerCount || 0,
        following: profile.followingCount || profile.following || profile.followsCount || 0,
        posts_count: profile.postsCount || profile.videoCount || profile.postCount || 0,
        engagement_rate: calculateEngagementRate(profile),
        recent_posts: extractRecentPosts(platform, rawData),
        profile_pic: profile.profilePicUrl || profile.profilePictureUrl || profile.avatar || '',
        is_verified: profile.isVerified || profile.verified || false,
        external_url: profile.externalUrl || profile.website || ''
    };
}

/**
 * Calculate engagement rate
 */
function calculateEngagementRate(profile) {
    const followers = profile.followersCount || profile.followers || 1;
    const avgLikes = profile.avgLikes || profile.averageLikes || 0;
    const avgComments = profile.avgComments || profile.averageComments || 0;

    if (avgLikes === 0) return 0;
    return ((avgLikes + avgComments) / followers * 100).toFixed(2);
}

/**
 * Extract recent posts from scraped data
 */
function extractRecentPosts(platform, rawData) {
    const posts = [];
    const items = rawData.slice(0, 12);

    for (const item of items) {
        if (item.caption || item.text || item.description) {
            posts.push({
                caption: item.caption || item.text || item.description || '',
                likes: item.likesCount || item.likes || item.diggCount || 0,
                comments: item.commentsCount || item.comments || item.commentCount || 0,
                shares: item.sharesCount || item.shares || item.shareCount || 0,
                views: item.videoViewCount || item.views || item.playCount || 0,
                posted_at: item.timestamp || item.createTime || item.postedAt || ''
            });
        }
    }

    return posts;
}

/**
 * Build profile data from user-provided info
 */
function buildProfileFromUserData(platform, username, userData) {
    return {
        platform,
        username,
        display_name: userData.display_name || username,
        headline: userData.headline || '',
        bio: userData.bio || userData.headline || '',
        followers: userData.followers || 0,
        following: userData.following || 0,
        posts_count: userData.posts_count || 0,
        engagement_rate: userData.engagement_rate || 0,
        recent_posts: userData.recent_posts || [],
        profile_pic: userData.profile_pic || '',
        is_verified: userData.is_verified || false,
        external_url: userData.external_url || '',
        is_user_provided: true
    };
}

/**
 * Mock profile data for testing
 */
function getMockProfileData(platform, username) {
    return {
        platform,
        username,
        display_name: username,
        bio: 'Bio non disponible (profil privé ou scraping désactivé)',
        followers: 0,
        following: 0,
        posts_count: 0,
        engagement_rate: 0,
        recent_posts: [],
        profile_pic: '',
        is_verified: false,
        external_url: '',
        is_mock: true
    };
}

/**
 * Analyze profile with Claude
 */
async function analyzeProfile(platform, scrapedData, businessContext, env) {
    const anthropicKey = env.anthropic_key;
    if (!anthropicKey) {
        console.error('analyzeProfile: No anthropic_key configured');
        return { error: 'Clé Anthropic non configurée' };
    }

    const prompt = buildAnalysisPrompt(platform, scrapedData, businessContext);
    console.log(`analyzeProfile: Sending prompt (${prompt.length} chars) to Claude...`);

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': anthropicKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-haiku-20241022',
                max_tokens: 4000,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        console.log(`analyzeProfile: Claude responded with status ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Claude API error:', errorText);
            return { error: `Claude API error: ${response.status}`, detail: errorText.substring(0, 200) };
        }

        const result = await response.json();
        const content = result.content[0].text;
        console.log(`analyzeProfile: Got response (${content.length} chars)`);

        // Parse JSON from response
        try {
            const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
            }
            return JSON.parse(content);
        } catch (e) {
            console.log('analyzeProfile: Could not parse JSON, returning structured fallback');
            // Return as structured text if not JSON
            return {
                raw_analysis: content,
                diagnostic: {
                    strengths: [],
                    improvements: [],
                    score: 50
                },
                strategy: {
                    weeks: []
                }
            };
        }
    } catch (error) {
        console.error('analyzeProfile exception:', error);
        return { error: error.message };
    }
}

/**
 * Build analysis prompt for Claude
 */
function buildAnalysisPrompt(platform, scrapedData, businessContext) {
    const platformName = {
        instagram: 'Instagram',
        tiktok: 'TikTok',
        linkedin: 'LinkedIn'
    }[platform];

    // Build profile description based on available data
    const hasUserData = scrapedData.is_user_provided;
    const headline = scrapedData.headline || '';
    const bio = scrapedData.bio || '';
    const followers = scrapedData.followers || 0;
    const postsCount = scrapedData.posts_count || 0;
    const website = scrapedData.external_url || '';

    // LinkedIn-specific handling
    const isLinkedIn = platform === 'linkedin';
    const connectionsLabel = isLinkedIn ? 'Connexions' : 'Abonnés';

    return `Tu es un expert en stratégie social media et personal branding. Analyse ce profil ${platformName} et fournis un diagnostic complet + une stratégie sur 4 semaines.

## DONNÉES DU PROFIL
- Plateforme: ${platformName}
- Username: ${scrapedData.username}
${headline ? `- Titre/Headline: ${headline}` : ''}
- Bio/À propos: ${bio || 'Non renseignée'}
- ${connectionsLabel}: ${followers}
- Publications: ${postsCount}
${website ? `- Site web: ${website}` : ''}

## DERNIERS POSTS
${scrapedData.recent_posts.slice(0, 6).map((p, i) => `
Post ${i + 1}:
- Caption: ${p.caption?.substring(0, 200) || 'N/A'}...
- Likes: ${p.likes} | Commentaires: ${p.comments}
`).join('\n')}

## CONTEXTE BUSINESS
${businessContext ? `
- Secteur: ${businessContext.industry || 'Non spécifié'}
- Cible: ${businessContext.target_audience || 'Non spécifié'}
- Objectif: ${businessContext.goal || 'Croissance générale'}
- Ton souhaité: ${businessContext.tone || 'Professionnel'}
` : 'Non fourni'}

## FORMAT DE RÉPONSE (JSON)
Réponds UNIQUEMENT avec un JSON valide dans ce format:

\`\`\`json
{
  "diagnostic": {
    "score": 65,
    "score_breakdown": {
      "bio_profile": { "score": 7, "max": 10, "comment": "..." },
      "content_quality": { "score": 6, "max": 10, "comment": "..." },
      "engagement": { "score": 5, "max": 10, "comment": "..." },
      "consistency": { "score": 4, "max": 10, "comment": "..." },
      "branding": { "score": 6, "max": 10, "comment": "..." },
      "growth_potential": { "score": 7, "max": 10, "comment": "..." }
    },
    "strengths": [
      "Point fort 1",
      "Point fort 2",
      "Point fort 3"
    ],
    "improvements": [
      {
        "issue": "Problème identifié",
        "recommendation": "Solution concrète",
        "priority": "high"
      }
    ],
    "quick_wins": [
      "Action rapide 1",
      "Action rapide 2",
      "Action rapide 3"
    ]
  },
  "strategy": {
    "positioning": "Description du positionnement recommandé",
    "content_pillars": ["Pilier 1", "Pilier 2", "Pilier 3"],
    "posting_frequency": "X posts par semaine",
    "best_times": ["Lundi 18h", "Mercredi 12h", "Vendredi 9h"],
    "weeks": [
      {
        "week": 1,
        "theme": "Thème de la semaine",
        "objectives": ["Objectif 1", "Objectif 2"],
        "content_ideas": [
          {
            "type": "carousel",
            "topic": "Sujet du post",
            "hook": "Accroche captivante"
          }
        ]
      }
    ]
  },
  "bio_suggestion": "Nouvelle bio optimisée de 150 caractères max",
  "hashtag_strategy": {
    "primary": ["#hashtag1", "#hashtag2"],
    "secondary": ["#hashtag3", "#hashtag4"],
    "niche": ["#hashtag5", "#hashtag6"]
  }
}
\`\`\`

Sois précis, actionnable et adapté à ${platformName}.`;
}

/**
 * Generate initial posts
 */
async function generateInitialPosts(platform, scrapedData, businessContext, auditResult, env) {
    const anthropicKey = env.anthropic_key;
    if (!anthropicKey) return [];

    const prompt = buildPostsPrompt(platform, scrapedData, businessContext, auditResult);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 2000,
            messages: [{
                role: 'user',
                content: prompt
            }]
        })
    });

    if (!response.ok) {
        console.error('Claude API error for posts:', await response.text());
        return [];
    }

    const result = await response.json();
    const content = result.content[0].text;
    console.log('Posts response:', content.substring(0, 200));

    try {
        // Essayer plusieurs méthodes de parsing
        let jsonContent = content;

        // 1. Chercher un bloc ```json
        const jsonBlockMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonBlockMatch) {
            jsonContent = jsonBlockMatch[1];
        }

        // 2. Chercher un objet JSON brut
        const jsonObjMatch = content.match(/\{[\s\S]*"posts"[\s\S]*\}/);
        if (!jsonBlockMatch && jsonObjMatch) {
            jsonContent = jsonObjMatch[0];
        }

        const parsed = JSON.parse(jsonContent);
        console.log('Parsed posts count:', parsed.posts?.length || 0);
        return parsed.posts || [];
    } catch (e) {
        console.error('Failed to parse posts JSON:', e.message, 'Content:', content.substring(0, 300));
        return [];
    }
}

/**
 * Analyze GEO (Generative Engine Optimization) - How AI sees this profile
 */
function analyzeGEO(profile, posts) {
    const scores = {
        usernameSearchable: { score: 0, max: 20, status: 'bad', label: 'Username recherchable' },
        bioKeywords: { score: 0, max: 20, status: 'bad', label: 'Bio avec mots-clés métier' },
        contentCitationnable: { score: 0, max: 20, status: 'bad', label: 'Contenu citationnable' },
        crossPlatformConsistency: { score: 0, max: 20, status: 'neutral', label: 'Cohérence cross-plateforme' },
        perceivedAuthority: { score: 0, max: 20, status: 'bad', label: 'Autorité perçue' }
    };

    // 1. Username recherchable (pas de chiffres random, pas trop de underscores)
    const username = profile.username || '';
    if (!/\d{3,}/.test(username) && (username.match(/_/g) || []).length <= 1) {
        scores.usernameSearchable.score = 18;
        scores.usernameSearchable.status = 'good';
    } else if ((username.match(/_/g) || []).length <= 2) {
        scores.usernameSearchable.score = 12;
        scores.usernameSearchable.status = 'neutral';
    } else {
        scores.usernameSearchable.score = 5;
    }

    // 2. Bio avec mots-clés métier (check both bio and headline for LinkedIn)
    const bio = (profile.bio || '').toLowerCase();
    const headline = (profile.headline || '').toLowerCase();
    const textToAnalyze = bio + ' ' + headline;
    const keywords = ['coach', 'experte', 'expert', 'formatrice', 'formateur', 'consultante', 'consultant',
                      'fondatrice', 'fondateur', 'ceo', 'entrepreneur', 'spécialiste', 'mentor',
                      'créatrice', 'créateur', 'auteure', 'auteur', 'conférencière', 'conférencier',
                      'thérapeute', 'psychologue', 'nutritionniste', 'photographe', 'designer',
                      'storytelling', 'visibilité', 'branding', 'marketing', 'stratégie', 'développement',
                      'accompagnement', 'transformation', 'leadership', 'innovation', 'digital'];
    const foundKeywords = keywords.filter(k => textToAnalyze.includes(k));
    scores.bioKeywords.score = Math.min(20, foundKeywords.length * 5);
    if (scores.bioKeywords.score >= 14) {
        scores.bioKeywords.status = 'good';
    } else if (scores.bioKeywords.score >= 7) {
        scores.bioKeywords.status = 'neutral';
    }

    // 3. Contenu citationnable (posts avec conseils, listes, expertise)
    const citablePatterns = ['conseil', 'astuce', 'erreur', 'étape', 'secret', 'méthode', 'comment', 'pourquoi',
                             'voici', 'découvre', 'apprends', 'guide', 'tuto', 'tips', 'hack'];
    let citableCount = 0;
    const recentPosts = posts || profile.recent_posts || [];
    recentPosts.forEach(post => {
        const caption = (post.caption || post.content || '').toLowerCase();
        if (citablePatterns.some(p => caption.includes(p))) {
            citableCount++;
        }
    });
    scores.contentCitationnable.score = Math.min(20, citableCount * 4);
    if (scores.contentCitationnable.score >= 16) {
        scores.contentCitationnable.status = 'good';
    } else if (scores.contentCitationnable.score >= 8) {
        scores.contentCitationnable.status = 'neutral';
    }

    // 4. Cross-platform (non vérifié pour l'instant - nécessite d'autres profils)
    scores.crossPlatformConsistency.score = 0;
    scores.crossPlatformConsistency.status = 'neutral';

    // 5. Autorité perçue (followers/connections + platform-specific thresholds)
    const followers = profile.followers || profile.followersCount || 0;
    const isLinkedIn = profile.platform === 'linkedin';

    // LinkedIn has different scale (500+ is already good for a professional)
    if (isLinkedIn) {
        if (followers >= 5000) {
            scores.perceivedAuthority.score = 20;
            scores.perceivedAuthority.status = 'good';
        } else if (followers >= 1000) {
            scores.perceivedAuthority.score = 17;
            scores.perceivedAuthority.status = 'good';
        } else if (followers >= 500) {
            scores.perceivedAuthority.score = 14;
            scores.perceivedAuthority.status = 'good';
        } else if (followers >= 200) {
            scores.perceivedAuthority.score = 10;
            scores.perceivedAuthority.status = 'neutral';
        } else {
            scores.perceivedAuthority.score = 5;
        }
    } else {
        // Instagram/TikTok scale
        if (followers >= 10000) {
            scores.perceivedAuthority.score = 20;
            scores.perceivedAuthority.status = 'good';
        } else if (followers >= 5000) {
            scores.perceivedAuthority.score = 15;
            scores.perceivedAuthority.status = 'good';
        } else if (followers >= 1000) {
            scores.perceivedAuthority.score = 10;
            scores.perceivedAuthority.status = 'neutral';
        } else if (followers >= 500) {
            scores.perceivedAuthority.score = 5;
            scores.perceivedAuthority.status = 'neutral';
        } else {
            scores.perceivedAuthority.score = 2;
        }
    }

    // Calculate total (excluding cross-platform which is not verified)
    const totalScore = scores.usernameSearchable.score +
                       scores.bioKeywords.score +
                       scores.contentCitationnable.score +
                       scores.perceivedAuthority.score;

    // Max is 80 (4 criteria x 20, excluding cross-platform)
    const normalizedScore = Math.round((totalScore / 80) * 100);

    // Generate tip based on lowest scores
    let tip = '';
    if (scores.bioKeywords.score < 10) {
        tip = "Ajoute des mots-clés métier dans ta bio : 'coach business', 'experte en [domaine]', 'fondatrice de [entreprise]'";
    } else if (scores.contentCitationnable.score < 10) {
        tip = "Crée du contenu avec des conseils concrets que les IA pourront citer : listes, méthodes, étapes...";
    } else if (scores.perceivedAuthority.score < 10) {
        tip = "Augmente ta preuve sociale : témoignages clients, résultats, collaborations...";
    } else if (scores.usernameSearchable.score < 15) {
        tip = "Simplifie ton username : évite les chiffres et les underscores multiples pour être plus facilement trouvable.";
    } else {
        tip = "Continue comme ça ! Publie régulièrement du contenu d'expertise pour renforcer ta visibilité IA.";
    }

    return {
        totalScore: normalizedScore,
        criteria: [
            scores.usernameSearchable,
            scores.bioKeywords,
            scores.contentCitationnable,
            scores.crossPlatformConsistency,
            scores.perceivedAuthority
        ],
        tip
    };
}

/**
 * Build posts generation prompt
 */
function buildPostsPrompt(platform, scrapedData, businessContext, auditResult) {
    const platformName = {
        instagram: 'Instagram',
        tiktok: 'TikTok',
        linkedin: 'LinkedIn'
    }[platform];

    const strategy = auditResult.strategy || {};

    return `Génère 4 posts ${platformName} pour ${scrapedData.username}. Secteur: ${businessContext?.industry || 'Général'}.

Réponds UNIQUEMENT avec ce JSON (pas de texte avant ou après):

{"posts":[{"week":1,"type":"carousel","hook":"Accroche 1","content":"Contenu post 1","hashtags":["#tag1"],"visual_suggestion":"Visuel 1","best_posting_time":"Lundi 18h"},{"week":2,"type":"reel","hook":"Accroche 2","content":"Contenu post 2","hashtags":["#tag2"],"visual_suggestion":"Visuel 2","best_posting_time":"Mercredi 12h"},{"week":3,"type":"carousel","hook":"Accroche 3","content":"Contenu post 3","hashtags":["#tag3"],"visual_suggestion":"Visuel 3","best_posting_time":"Vendredi 9h"},{"week":4,"type":"post","hook":"Accroche 4","content":"Contenu post 4","hashtags":["#tag4"],"visual_suggestion":"Visuel 4","best_posting_time":"Dimanche 20h"}]}

Remplace les valeurs par du contenu pertinent. Sois créatif et adapté à ${platformName}.`;
}

/**
 * Get audit by ID
 */
async function getAudit(auditId, env) {
    // Get audit
    const auditResult = await supabaseQuery(env, `audits?id=eq.${auditId}`, 'GET');

    if (auditResult.error || !auditResult.data || auditResult.data.length === 0) {
        return errorResponse('Audit non trouvé', 404);
    }

    const audit = auditResult.data[0];

    // Get posts if completed
    let posts = [];
    if (audit.status === 'completed') {
        const postsResult = await supabaseQuery(env, `audit_generated_posts?audit_id=eq.${auditId}&order=week_number.asc`, 'GET');
        if (postsResult.data) {
            posts = postsResult.data;
        }
    }

    // Retourne au format attendu par le frontend
    return jsonResponse({
        success: true,
        audit: {
            ...audit,
            posts
        }
    });
}

/**
 * Get all audits for a user
 */
async function getUserAudits(userId, env) {
    const auditsResult = await supabaseQuery(
        env,
        `audits?user_id=eq.${userId}&order=created_at.desc&limit=20`,
        'GET'
    );

    if (auditsResult.error) {
        return errorResponse('Erreur récupération audits', 500);
    }

    const audits = auditsResult.data || [];

    // Retourner un résumé de chaque audit (sans les données complètes pour alléger)
    const auditsSummary = audits.map(audit => ({
        id: audit.id,
        platform: audit.platform,
        profile_username: audit.profile_username,
        profile_url: audit.profile_url,
        status: audit.status,
        score: audit.audit_result?.diagnostic?.score || null,
        created_at: audit.created_at,
        completed_at: audit.completed_at
    }));

    return jsonResponse({
        success: true,
        audits: auditsSummary,
        total: audits.length
    });
}

/**
 * Generate more posts for an audit
 */
async function generateMorePosts(auditId, request, env) {
    const body = await request.json();
    const { post_type, topic } = body;

    // Get audit
    const auditResult = await supabaseQuery(env, `audits?id=eq.${auditId}`, 'GET');

    if (auditResult.error || !auditResult.data || auditResult.data.length === 0) {
        return errorResponse('Audit non trouvé', 404);
    }

    const audit = auditResult.data[0];
    if (audit.status !== 'completed') {
        return errorResponse('Audit non terminé', 400);
    }

    // Generate new post with Claude
    const anthropicKey = env.anthropic_key;
    if (!anthropicKey) {
        return errorResponse('Clé Anthropic non configurée', 500);
    }

    const prompt = `Génère 1 nouveau post ${post_type || 'engageant'} pour ${audit.platform}.

Contexte:
- Username: ${audit.profile_username}
- Secteur: ${audit.business_context?.industry || 'Général'}
- Sujet demandé: ${topic || 'Au choix basé sur la stratégie'}

Réponds uniquement avec un JSON:
\`\`\`json
{
  "hook": "Accroche",
  "content": "Contenu complet",
  "hashtags": ["#tag1", "#tag2"],
  "visual_suggestion": "Description visuel"
}
\`\`\``;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!response.ok) {
        return errorResponse('Erreur génération', 500);
    }

    const result = await response.json();
    const content = result.content[0].text;

    try {
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
        const post = JSON.parse(jsonMatch ? jsonMatch[1] : content);

        // Save to database
        const savedPost = await supabaseQuery(env, 'audit_generated_posts', 'POST', {
            audit_id: auditId,
            week_number: 5, // Additional posts
            post_type: post_type || 'custom',
            hook: post.hook,
            content: post.content,
            hashtags: post.hashtags,
            visual_suggestion: post.visual_suggestion
        });

        return jsonResponse({
            success: true,
            post: {
                ...post,
                id: savedPost.data?.[0]?.id
            }
        });

    } catch (e) {
        return errorResponse('Erreur parsing post', 500);
    }
}

/**
 * Update audit status
 */
async function updateAuditStatus(auditId, status, env, additionalData = {}) {
    const updateData = {
        status,
        ...additionalData
    };

    return await supabaseQuery(env, `audits?id=eq.${auditId}`, 'PATCH', updateData);
}

/**
 * Supabase query helper
 */
async function supabaseQuery(env, endpoint, method = 'GET', body = null) {
    const url = `${env.supabase_url}/rest/v1/${endpoint}`;

    const headers = {
        'apikey': env.supabase_key,
        'Authorization': `Bearer ${env.supabase_key}`,
        'Content-Type': 'application/json'
    };

    if (method === 'POST') {
        headers['Prefer'] = 'return=representation';
    }

    const options = {
        method,
        headers
    };

    if (body && (method === 'POST' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);

        // PATCH returns 204 No Content on success
        if (response.status === 204) {
            return { data: [], success: true };
        }

        const text = await response.text();
        if (!text) {
            return { data: [], success: response.ok };
        }

        const data = JSON.parse(text);

        if (!response.ok) {
            return { error: data };
        }

        return { data: Array.isArray(data) ? data : [data] };
    } catch (error) {
        return { error: { message: error.message } };
    }
}

/**
 * Extract username from profile URL
 */
function extractUsername(url, platform) {
    try {
        const urlObj = new URL(url);
        let path = urlObj.pathname.replace(/^\/|\/$/g, '');

        switch (platform) {
            case 'instagram':
                // instagram.com/username or instagram.com/username/
                return path.split('/')[0];

            case 'tiktok':
                // tiktok.com/@username
                if (path.startsWith('@')) {
                    return path.substring(1).split('/')[0];
                }
                return path.split('/')[0];

            case 'linkedin':
                // linkedin.com/in/username
                if (path.startsWith('in/')) {
                    return path.substring(3).split('/')[0];
                }
                return path.split('/')[0];

            default:
                return null;
        }
    } catch (e) {
        // Try to extract from raw string
        const match = url.match(/(?:@)?([a-zA-Z0-9._-]+)/);
        return match ? match[1] : null;
    }
}
