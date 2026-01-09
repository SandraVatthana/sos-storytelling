// cloudflare-worker-v5.js - Avec API REST Enterprise + Lemon Squeezy Webhooks + Brevo
// Variables d'environnement requises:
// - ANTHROPIC_API_KEY
// - PERPLEXITY_API_KEY
// - SUPABASE_URL
// - SUPABASE_SERVICE_KEY (service_role pour le worker)
// - LEMONSQUEEZY_WEBHOOK_SECRET (pour vérifier les signatures des webhooks)
// - BREVO_API_KEY (pour ajouter les contacts à Brevo)

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
      "Access-Control-Max-Age": "86400"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // ============ LEMON SQUEEZY WEBHOOKS ============
    if (url.pathname === '/webhook/lemonsqueezy' && request.method === 'POST') {
      return handleLemonSqueezyWebhook(request, env, corsHeaders);
    }

    // ============ BREVO - Ajouter un contact (pour le frontend) ============
    if (url.pathname === '/api/brevo/contact' && request.method === 'POST') {
      return handleBrevoContact(request, env, corsHeaders);
    }

    // ============ ADMIN API ============
    if (url.pathname.startsWith('/api/admin/')) {
      return handleAdminAPI(request, env, corsHeaders);
    }

    // ============ API REST ENTERPRISE (/api/v1/*) ============
    if (url.pathname.startsWith('/api/v1/')) {
      return handleAPIRequest(request, env, corsHeaders);
    }

    // ============ ROUTES EXISTANTES (Frontend App) ============
    return handleFrontendRequest(request, env, corsHeaders);
  }
};

// ============================================================
// LEMON SQUEEZY WEBHOOKS
// ============================================================

async function handleLemonSqueezyWebhook(request, env, corsHeaders) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('X-Signature');

    // Vérifier la signature (HMAC SHA256)
    if (env.LEMONSQUEEZY_WEBHOOK_SECRET) {
      const isValid = await verifyLemonSqueezySignature(rawBody, signature, env.LEMONSQUEEZY_WEBHOOK_SECRET);
      if (!isValid) {
        console.error('Invalid Lemon Squeezy webhook signature');
        return jsonResponse({ error: 'Invalid signature' }, 401, corsHeaders);
      }
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.meta?.event_name;
    const customData = payload.meta?.custom_data || {};

    console.log(`🍋 Lemon Squeezy webhook: ${eventType}`);

    // Extraire les données importantes
    const data = payload.data?.attributes || {};
    const subscriptionData = {
      lemon_subscription_id: payload.data?.id,
      lemon_customer_id: data.customer_id,
      lemon_order_id: data.order_id,
      lemon_product_id: data.product_id,
      lemon_variant_id: data.variant_id,
      status: data.status,
      user_email: data.user_email,
      user_name: data.user_name,
      plan_name: data.product_name || data.variant_name,
      renews_at: data.renews_at,
      ends_at: data.ends_at,
      trial_ends_at: data.trial_ends_at,
      created_at: data.created_at,
      updated_at: data.updated_at
    };

    // Traiter selon le type d'événement
    switch (eventType) {
      case 'subscription_created':
        await handleSubscriptionCreated(subscriptionData, customData, env);
        break;

      case 'subscription_updated':
        await handleSubscriptionUpdated(subscriptionData, env);
        break;

      case 'subscription_cancelled':
        await handleSubscriptionCancelled(subscriptionData, env);
        break;

      case 'subscription_resumed':
        await handleSubscriptionResumed(subscriptionData, env);
        break;

      case 'subscription_expired':
        await handleSubscriptionExpired(subscriptionData, env);
        break;

      case 'subscription_paused':
        await handleSubscriptionPaused(subscriptionData, env);
        break;

      case 'subscription_unpaused':
        await handleSubscriptionUnpaused(subscriptionData, env);
        break;

      case 'subscription_payment_success':
        await handlePaymentSuccess(subscriptionData, data, env);
        break;

      case 'subscription_payment_failed':
        await handlePaymentFailed(subscriptionData, data, env);
        break;

      case 'order_created':
        // Pour les achats one-time si besoin
        console.log('Order created:', payload.data?.id);
        break;

      default:
        console.log(`Unhandled event: ${eventType}`);
    }

    return jsonResponse({ received: true, event: eventType }, 200, corsHeaders);

  } catch (error) {
    console.error('Webhook error:', error);
    return jsonResponse({ error: 'Webhook processing failed', message: error.message }, 500, corsHeaders);
  }
}

// Vérifier la signature HMAC du webhook
async function verifyLemonSqueezySignature(payload, signature, secret) {
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === expectedSignature;
}

// ============ HANDLERS PAR TYPE D'ÉVÉNEMENT ============

async function handleSubscriptionCreated(subData, customData, env) {
  console.log('✅ Nouvelle souscription:', subData.user_email, subData.plan_name);

  // Déterminer le plan à partir du nom du produit
  const plan = determinePlanFromProduct(subData.plan_name);

  // Créer ou mettre à jour l'utilisateur dans Supabase
  const userData = {
    email: subData.user_email?.toLowerCase(),
    name: subData.user_name,
    plan: plan,
    lemon_customer_id: subData.lemon_customer_id,
    lemon_subscription_id: subData.lemon_subscription_id,
    subscription_status: subData.status,
    trial_ends_at: subData.trial_ends_at,
    subscription_renews_at: subData.renews_at
  };

  await upsertUser(userData, env);

  // Ajouter le contact à Brevo avec le tag du plan
  await addContactToBrevo(subData.user_email, subData.user_name, plan, env);

  // Logger l'événement
  await logSubscriptionEvent('subscription_created', subData, env);
}

async function handleSubscriptionUpdated(subData, env) {
  console.log('🔄 Souscription mise à jour:', subData.user_email, subData.status);

  const plan = determinePlanFromProduct(subData.plan_name);

  await updateUserSubscription({
    email: subData.user_email?.toLowerCase(),
    plan: plan,
    subscription_status: subData.status,
    subscription_renews_at: subData.renews_at,
    trial_ends_at: subData.trial_ends_at
  }, env);

  await logSubscriptionEvent('subscription_updated', subData, env);
}

async function handleSubscriptionCancelled(subData, env) {
  console.log('❌ Souscription annulée:', subData.user_email);

  await updateUserSubscription({
    email: subData.user_email?.toLowerCase(),
    subscription_status: 'cancelled',
    subscription_ends_at: subData.ends_at
  }, env);

  await logSubscriptionEvent('subscription_cancelled', subData, env);
}

async function handleSubscriptionResumed(subData, env) {
  console.log('▶️ Souscription reprise:', subData.user_email);

  await updateUserSubscription({
    email: subData.user_email?.toLowerCase(),
    subscription_status: 'active',
    subscription_renews_at: subData.renews_at
  }, env);

  await logSubscriptionEvent('subscription_resumed', subData, env);
}

async function handleSubscriptionExpired(subData, env) {
  console.log('⏰ Souscription expirée:', subData.user_email);

  await updateUserSubscription({
    email: subData.user_email?.toLowerCase(),
    plan: 'free',
    subscription_status: 'expired'
  }, env);

  await logSubscriptionEvent('subscription_expired', subData, env);
}

async function handleSubscriptionPaused(subData, env) {
  console.log('⏸️ Souscription en pause:', subData.user_email);

  await updateUserSubscription({
    email: subData.user_email?.toLowerCase(),
    subscription_status: 'paused'
  }, env);

  await logSubscriptionEvent('subscription_paused', subData, env);
}

async function handleSubscriptionUnpaused(subData, env) {
  console.log('▶️ Souscription déspausée:', subData.user_email);

  await updateUserSubscription({
    email: subData.user_email?.toLowerCase(),
    subscription_status: 'active'
  }, env);

  await logSubscriptionEvent('subscription_unpaused', subData, env);
}

async function handlePaymentSuccess(subData, paymentData, env) {
  console.log('💰 Paiement réussi:', subData.user_email);

  await updateUserSubscription({
    email: subData.user_email?.toLowerCase(),
    subscription_status: 'active',
    last_payment_at: new Date().toISOString()
  }, env);

  await logSubscriptionEvent('payment_success', { ...subData, amount: paymentData.subtotal }, env);
}

async function handlePaymentFailed(subData, paymentData, env) {
  console.log('💳 Paiement échoué:', subData.user_email);

  await updateUserSubscription({
    email: subData.user_email?.toLowerCase(),
    subscription_status: 'past_due'
  }, env);

  await logSubscriptionEvent('payment_failed', subData, env);
}

// ============ HELPERS SUPABASE ============

function determinePlanFromProduct(productName) {
  if (!productName) return 'free';
  const name = productName.toLowerCase();

  if (name.includes('scale')) return 'agency_scale';
  if (name.includes('starter') || name.includes('agence')) return 'agency_starter';
  if (name.includes('solo')) return 'solo';
  if (name.includes('enterprise')) return 'enterprise';

  return 'solo'; // Défaut
}

async function upsertUser(userData, env) {
  try {
    // Chercher si l'utilisateur existe
    const searchResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(userData.email)}`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
        }
      }
    );

    const existingUsers = await searchResponse.json();

    if (existingUsers && existingUsers.length > 0) {
      // Mettre à jour l'utilisateur existant
      await fetch(
        `${env.SUPABASE_URL}/rest/v1/users?id=eq.${existingUsers[0].id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            ...userData,
            updated_at: new Date().toISOString()
          })
        }
      );
      console.log('👤 Utilisateur mis à jour:', userData.email);
    } else {
      // Créer un nouvel utilisateur
      await fetch(
        `${env.SUPABASE_URL}/rest/v1/users`,
        {
          method: 'POST',
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            ...userData,
            created_at: new Date().toISOString()
          })
        }
      );
      console.log('👤 Nouvel utilisateur créé:', userData.email);
    }
  } catch (error) {
    console.error('Erreur upsert user:', error);
  }
}

async function updateUserSubscription(updateData, env) {
  try {
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(updateData.email)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          ...updateData,
          updated_at: new Date().toISOString()
        })
      }
    );
  } catch (error) {
    console.error('Erreur update subscription:', error);
  }
}

async function logSubscriptionEvent(eventType, eventData, env) {
  try {
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/subscription_events`,
      {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          event_type: eventType,
          email: eventData.user_email?.toLowerCase(),
          lemon_subscription_id: eventData.lemon_subscription_id,
          plan_name: eventData.plan_name,
          status: eventData.status,
          event_data: eventData,
          created_at: new Date().toISOString()
        })
      }
    );
  } catch (error) {
    console.error('Erreur log event:', error);
  }
}

// ============================================================
// API REST ENTERPRISE
// ============================================================

async function handleAPIRequest(request, env, corsHeaders) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/v1', '');

  // 1. Vérifier API Key
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) {
    return jsonResponse({ error: 'API key required', code: 'MISSING_API_KEY' }, 401, corsHeaders);
  }

  const keyData = await validateAPIKey(apiKey, env);
  if (!keyData) {
    return jsonResponse({ error: 'Invalid API key', code: 'INVALID_API_KEY' }, 401, corsHeaders);
  }

  if (!keyData.is_active) {
    return jsonResponse({ error: 'API key is deactivated', code: 'DEACTIVATED_API_KEY' }, 403, corsHeaders);
  }

  // 2. Vérifier rate limit
  const monthlyUsage = await getMonthlyUsage(keyData.id, env);
  if (monthlyUsage >= keyData.rate_limit_monthly) {
    return jsonResponse({
      error: 'Monthly rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      limit: keyData.rate_limit_monthly,
      used: monthlyUsage,
      resets_at: getMonthEndDate()
    }, 429, corsHeaders);
  }

  // 3. Router vers le bon endpoint
  let response;
  let tokensUsed = { input: 0, output: 0 };
  let requestMetadata = {};

  try {
    switch (true) {
      // POST /api/v1/generate - Générer du contenu
      case path === '/generate' && request.method === 'POST':
        if (!keyData.permissions?.generate) {
          return jsonResponse({ error: 'Permission denied for generate', code: 'PERMISSION_DENIED' }, 403, corsHeaders);
        }
        const generateResult = await handleAPIGenerate(request, env, keyData);
        response = generateResult.response;
        tokensUsed = generateResult.tokens;
        requestMetadata = generateResult.metadata;
        break;

      // GET /api/v1/voices - Lister les profils de voix
      case path === '/voices' && request.method === 'GET':
        if (!keyData.permissions?.voices) {
          return jsonResponse({ error: 'Permission denied for voices', code: 'PERMISSION_DENIED' }, 403, corsHeaders);
        }
        response = await handleAPIListVoices(env, keyData);
        break;

      // GET /api/v1/voices/:id - Détail d'un profil de voix
      case path.match(/^\/voices\/[\w-]+$/) && request.method === 'GET':
        if (!keyData.permissions?.voices) {
          return jsonResponse({ error: 'Permission denied for voices', code: 'PERMISSION_DENIED' }, 403, corsHeaders);
        }
        const voiceId = path.split('/')[2];
        response = await handleAPIGetVoice(voiceId, env, keyData);
        break;

      // GET /api/v1/usage - Stats d'utilisation
      case path === '/usage' && request.method === 'GET':
        response = await handleAPIGetUsage(url, env, keyData);
        break;

      // GET /api/v1/structures - Lister les structures disponibles
      case path === '/structures' && request.method === 'GET':
        response = handleAPIListStructures(corsHeaders);
        break;

      // GET /api/v1/platforms - Lister les plateformes disponibles
      case path === '/platforms' && request.method === 'GET':
        response = handleAPIListPlatforms(corsHeaders);
        break;

      default:
        response = jsonResponse({ error: 'Endpoint not found', code: 'NOT_FOUND' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('API Error:', error);
    response = jsonResponse({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: error.message
    }, 500, corsHeaders);
  }

  // 4. Logger l'usage (async, ne bloque pas la réponse)
  const latencyMs = Date.now() - startTime;
  logAPIUsage(keyData.id, path, request.method, response.status, tokensUsed, latencyMs, requestMetadata, env);

  // 5. Mettre à jour last_used_at
  updateLastUsed(keyData.id, env);

  // Ajouter les headers de rate limit
  const responseWithHeaders = new Response(response.body, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers),
      ...corsHeaders,
      'X-RateLimit-Limit': keyData.rate_limit_monthly.toString(),
      'X-RateLimit-Remaining': Math.max(0, keyData.rate_limit_monthly - monthlyUsage - 1).toString(),
      'X-RateLimit-Reset': getMonthEndDate()
    }
  });

  return responseWithHeaders;
}

// ============ API GENERATE ============
async function handleAPIGenerate(request, env, keyData) {
  const body = await request.json();

  // Validation des paramètres
  const { idea, structure, format, platform, voiceProfileId, temperature, maxTokens } = body;

  if (!idea || typeof idea !== 'string' || idea.trim().length < 3) {
    return {
      response: jsonResponse({
        error: 'Parameter "idea" is required and must be at least 3 characters',
        code: 'INVALID_PARAMETER'
      }, 400),
      tokens: { input: 0, output: 0 },
      metadata: {}
    };
  }

  // Charger le profil de voix si spécifié
  let voiceContext = "";
  if (voiceProfileId) {
    const voiceProfile = await getVoiceProfile(voiceProfileId, keyData.user_id, env);
    if (voiceProfile) {
      voiceContext = buildVoiceContext(voiceProfile.profile_data);
    }
  }

  // Construire le prompt système
  const systemPrompt = buildAPISystemPrompt(structure, format, platform, voiceContext);
  const userPrompt = buildAPIUserPrompt(idea, structure, format, platform);

  // Appeler Claude
  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens || 2000,
      temperature: temperature || 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  if (!claudeResponse.ok) {
    const errorData = await claudeResponse.text();
    console.error("Claude API Error:", claudeResponse.status, errorData);
    return {
      response: jsonResponse({
        error: 'AI generation failed',
        code: 'AI_ERROR',
        details: claudeResponse.status
      }, 502),
      tokens: { input: 0, output: 0 },
      metadata: {}
    };
  }

  const data = await claudeResponse.json();

  return {
    response: jsonResponse({
      success: true,
      content: data.content[0].text,
      usage: {
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0
      },
      metadata: {
        structure: structure || 'default',
        format: format || 'post',
        platform: platform || 'linkedin',
        voice_profile_id: voiceProfileId || null,
        model: 'claude-sonnet-4-20250514'
      }
    }, 200),
    tokens: {
      input: data.usage?.input_tokens || 0,
      output: data.usage?.output_tokens || 0
    },
    metadata: { structure, format, platform }
  };
}

// ============ API LIST VOICES ============
async function handleAPIListVoices(env, keyData) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/voice_profiles?user_id=eq.${keyData.user_id}&select=id,name,is_default,created_at,updated_at`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const profiles = await response.json();

  return jsonResponse({
    success: true,
    voices: profiles.map(p => ({
      id: p.id,
      name: p.name,
      is_default: p.is_default,
      created_at: p.created_at,
      updated_at: p.updated_at
    })),
    count: profiles.length
  }, 200);
}

// ============ API GET VOICE ============
async function handleAPIGetVoice(voiceId, env, keyData) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/voice_profiles?id=eq.${voiceId}&user_id=eq.${keyData.user_id}`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const profiles = await response.json();

  if (!profiles || profiles.length === 0) {
    return jsonResponse({
      error: 'Voice profile not found',
      code: 'NOT_FOUND'
    }, 404);
  }

  const profile = profiles[0];

  return jsonResponse({
    success: true,
    voice: {
      id: profile.id,
      name: profile.name,
      is_default: profile.is_default,
      profile_data: profile.profile_data,
      created_at: profile.created_at,
      updated_at: profile.updated_at
    }
  }, 200);
}

// ============ API GET USAGE ============
async function handleAPIGetUsage(url, env, keyData) {
  const period = url.searchParams.get('period') || 'month'; // month, week, day

  let dateFilter;
  switch (period) {
    case 'day':
      dateFilter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'week':
      dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'month':
    default:
      dateFilter = new Date(new Date().setDate(1)).toISOString().split('T')[0];
  }

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/api_usage?api_key_id=eq.${keyData.id}&created_at=gte.${dateFilter}&select=endpoint,status_code,tokens_input,tokens_output,latency_ms,created_at`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const usageData = await response.json();

  // Agréger les stats
  const stats = {
    total_requests: usageData.length,
    successful_requests: usageData.filter(u => u.status_code >= 200 && u.status_code < 300).length,
    failed_requests: usageData.filter(u => u.status_code >= 400).length,
    total_tokens_input: usageData.reduce((sum, u) => sum + (u.tokens_input || 0), 0),
    total_tokens_output: usageData.reduce((sum, u) => sum + (u.tokens_output || 0), 0),
    avg_latency_ms: usageData.length > 0
      ? Math.round(usageData.reduce((sum, u) => sum + (u.latency_ms || 0), 0) / usageData.length)
      : 0,
    by_endpoint: {}
  };

  // Stats par endpoint
  usageData.forEach(u => {
    if (!stats.by_endpoint[u.endpoint]) {
      stats.by_endpoint[u.endpoint] = { requests: 0, tokens: 0 };
    }
    stats.by_endpoint[u.endpoint].requests++;
    stats.by_endpoint[u.endpoint].tokens += (u.tokens_input || 0) + (u.tokens_output || 0);
  });

  return jsonResponse({
    success: true,
    period,
    rate_limit: {
      monthly_limit: keyData.rate_limit_monthly,
      used_this_month: await getMonthlyUsage(keyData.id, env),
      resets_at: getMonthEndDate()
    },
    stats
  }, 200);
}

// ============ API LIST STRUCTURES ============
function handleAPIListStructures(corsHeaders) {
  const structures = [
    { id: 'aida', name: 'AIDA', description: 'Attention - Intérêt - Désir - Action' },
    { id: 'pas', name: 'PAS', description: 'Problème - Agitation - Solution' },
    { id: 'storytelling', name: 'Storytelling', description: 'Récit narratif avec arc dramatique' },
    { id: 'hook', name: 'Hook + Value', description: 'Accroche puissante + Valeur ajoutée' },
    { id: 'liste', name: 'Liste', description: 'Format liste numérotée' },
    { id: 'avant-apres', name: 'Avant/Après', description: 'Transformation et résultats' },
    { id: 'contrarian', name: 'Contrarian', description: 'Opinion à contre-courant' },
    { id: 'how-to', name: 'How-To', description: 'Tutoriel étape par étape' },
    { id: 'personal', name: 'Personal Story', description: 'Histoire personnelle authentique' },
    { id: 'data', name: 'Data-Driven', description: 'Basé sur des statistiques et faits' }
  ];

  return jsonResponse({ success: true, structures }, 200, corsHeaders);
}

// ============ API LIST PLATFORMS ============
function handleAPIListPlatforms(corsHeaders) {
  const platforms = [
    { id: 'linkedin', name: 'LinkedIn', max_chars: 3000, emoji_friendly: true, hashtags: true },
    { id: 'instagram', name: 'Instagram', max_chars: 2200, emoji_friendly: true, hashtags: true },
    { id: 'twitter', name: 'Twitter/X', max_chars: 280, emoji_friendly: true, hashtags: true },
    { id: 'threads', name: 'Threads', max_chars: 500, emoji_friendly: true, hashtags: false },
    { id: 'tiktok', name: 'TikTok', max_chars: 2200, emoji_friendly: true, hashtags: true },
    { id: 'facebook', name: 'Facebook', max_chars: 63206, emoji_friendly: true, hashtags: false }
  ];

  return jsonResponse({ success: true, platforms }, 200, corsHeaders);
}

// ============================================================
// FRONTEND REQUEST (Code existant)
// ============================================================

async function handleFrontendRequest(request, env, corsHeaders) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    const body = await request.json();

    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({
        error: "Messages manquants ou invalides"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Détecter si on doit utiliser Perplexity (pour TRENDS, Planning, recherche web)
    const usePerplexity = body.usePerplexity === true;

    const userProfile = body.userProfile || null;
    let profileContext = "";
    let voiceContext = "";

    if (userProfile && userProfile.nom) {
      profileContext = `

PROFIL DE L'UTILISATEUR :
- Prénom : ${userProfile.nom}
- Domaine : ${userProfile.domaine || "Non renseigné"}
- Piliers de contenu : ${userProfile.piliers && userProfile.piliers.length > 0 ? userProfile.piliers.join(", ") : "Non renseignés"}
- Style : ${userProfile.style || "Non renseigné"}
- Plateformes : ${userProfile.plateformes && userProfile.plateformes.length > 0 ? userProfile.plateformes.join(", ") : "Non renseignées"}
- Objectif : ${userProfile.objectif || "Non renseigné"}
`;

      // Ajouter le profil de voix si disponible
      if (userProfile.voiceProfile) {
        const vp = userProfile.voiceProfile;
        voiceContext = `

=== PROFIL DE VOIX DE L'UTILISATEUR (TRÈS IMPORTANT) ===
L'utilisateur a un style d'écriture unique que tu DOIS reproduire :

- Ton général : ${vp.ton || "Non défini"}
- Longueur des phrases : ${vp.longueurPhrases || "Non définie"}
- Expressions récurrentes : ${vp.expressions || "Non définies"}
- Ponctuation & émojis : ${vp.ponctuation || "Non définie"}
- Style narratif : ${vp.styleNarratif || "Non défini"}
- Vocabulaire : ${vp.vocabulaire || "Non défini"}
- Signature unique : ${vp.signature || "Non définie"}

CONSEILS POUR REPRODUIRE CETTE VOIX :
${vp.conseils || "Adopter un style naturel et authentique"}

⚠️ INSTRUCTION CRITIQUE : Tu DOIS écrire EXACTEMENT comme cette personne écrirait.
Imite son ton, ses expressions, sa ponctuation. Le contenu doit "sonner" comme si l'utilisateur l'avait écrit lui-même.
`;
        profileContext += voiceContext;
      }
    }

    // ==================== PERPLEXITY (TRENDS, Planning, Recherche) ====================
    if (usePerplexity) {
      if (!env.PERPLEXITY_API_KEY) {
        return new Response(JSON.stringify({
          error: "Clé API Perplexity non configurée"
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      const perplexitySystemPrompt = `Tu es Tithot, une experte en tendances réseaux sociaux et stratégie de contenu.

MISSION : Tu analyses les VRAIES tendances actuelles du web pour proposer des idées de contenu pertinentes et à jour.

${profileContext}

STYLE DE RÉPONSE :
- Utilise des données récentes et des sources fiables
- Propose des angles originaux basés sur l'actualité
- Adapte tes suggestions au profil de l'utilisateur
- Sois concise et actionnable
- Utilise des émojis pour structurer

FORMAT : Réponds TOUJOURS en JSON valide quand demandé.`;

      try {
        const response = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.PERPLEXITY_API_KEY}`
          },
          body: JSON.stringify({
            model: "llama-3.1-sonar-small-128k-online",
            messages: [
              { role: "system", content: perplexitySystemPrompt },
              ...body.messages
            ],
            max_tokens: 2000,
            temperature: 0.7
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error("Erreur API Perplexity:", response.status, errorData);
          // Fallback vers Claude si Perplexity échoue
          console.log("Fallback vers Claude...");
        } else {
          const data = await response.json();

          // Adapter le format de réponse pour être compatible avec le frontend
          const adaptedResponse = {
            content: [{
              text: data.choices?.[0]?.message?.content || "Pas de réponse"
            }],
            citations: data.citations || [],
            model: "perplexity"
          };

          return new Response(JSON.stringify(adaptedResponse), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      } catch (perplexityError) {
        console.error("Erreur Perplexity, fallback vers Claude:", perplexityError);
        // Continue vers Claude en cas d'erreur
      }
    }

    // ==================== CLAUDE (Génération de contenu ou fallback) ====================
    const systemPrompt = `Tu es Tithot 🎨, une coach créative passionnée et bienveillante spécialisée en personal branding et création de contenu sur les réseaux sociaux.

PERSONNALITÉ :
- Énergique et enthousiaste, tu transmets ta passion avec des émojis bien placés
- Bienveillante mais directe : tu vas droit au but avec des conseils actionnables
- Tu parles comme une vraie personne, pas comme un robot
- Tu utilises le "tu" et tu crées une vraie connexion
- Tu ponctues tes réponses d'encouragements sincères

STYLE DE RÉPONSE :
- Commence toujours par une accroche engageante ou une question rhétorique
- Structure avec des titres (## et ###) pour aérer
- Donne des exemples concrets et applicables immédiatement
- Utilise des listes à puces pour les étapes pratiques
- Termine par un call-to-action motivant ou une question pour engager

FORMAT :
- Utilise ## pour les grandes sections (avec emoji)
- Utilise ### pour les sous-parties
- Mets en **gras** les points clés
- Aère ton texte, pas de pavés indigestes
- Maximum 400 mots, va à l'essentiel
${profileContext}
Tu accompagnes des créateurs de contenu dans leur voyage vers l'authenticité et l'impact. Chaque réponse doit donner envie d'agir !`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages: body.messages
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Erreur API Claude:", response.status, errorData);
      return new Response(JSON.stringify({
        error: `Erreur API: ${response.status}`,
        details: errorData
      }), {
        status: response.status,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("Erreur dans le worker:", error);
    return new Response(JSON.stringify({
      error: "Erreur serveur",
      message: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ============================================================
// HELPERS
// ============================================================

function jsonResponse(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

async function validateAPIKey(key, env) {
  // Hash la clé avec SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/api_keys?key_hash=eq.${hashHex}&select=*`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const keys = await response.json();
  return keys[0] || null;
}

async function getMonthlyUsage(keyId, env) {
  const monthStart = new Date(new Date().setDate(1)).toISOString().split('T')[0];

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/api_usage?api_key_id=eq.${keyId}&created_at=gte.${monthStart}&select=id`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'count=exact'
      }
    }
  );

  const count = response.headers.get('content-range');
  if (count) {
    const match = count.match(/\/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
  return 0;
}

async function logAPIUsage(keyId, endpoint, method, statusCode, tokens, latencyMs, metadata, env) {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/api_usage`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        api_key_id: keyId,
        endpoint: endpoint,
        method: method,
        status_code: statusCode,
        tokens_input: tokens.input || 0,
        tokens_output: tokens.output || 0,
        latency_ms: latencyMs,
        request_metadata: metadata
      })
    });
  } catch (error) {
    console.error('Failed to log API usage:', error);
  }
}

async function updateLastUsed(keyId, env) {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/api_keys?id=eq.${keyId}`, {
      method: 'PATCH',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        last_used_at: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Failed to update last_used_at:', error);
  }
}

async function getVoiceProfile(voiceId, userId, env) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/voice_profiles?id=eq.${voiceId}&user_id=eq.${userId}`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const profiles = await response.json();
  return profiles[0] || null;
}

function buildVoiceContext(profileData) {
  if (!profileData) return "";

  return `

=== PROFIL DE VOIX (IMPORTANT) ===
Tu DOIS écrire comme cette personne :
- Ton : ${profileData.ton || "Non défini"}
- Longueur phrases : ${profileData.longueurPhrases || "Variable"}
- Expressions favorites : ${profileData.expressions || "Aucune spécifiée"}
- Ponctuation/émojis : ${profileData.ponctuation || "Standard"}
- Style narratif : ${profileData.styleNarratif || "Direct"}
- Vocabulaire : ${profileData.vocabulaire || "Courant"}
- Signature : ${profileData.signature || "Aucune"}

⚠️ Le contenu doit sonner comme si l'utilisateur l'avait écrit lui-même.
`;
}

function buildAPISystemPrompt(structure, format, platform, voiceContext) {
  const structureGuides = {
    aida: "Structure AIDA: Attention (accroche choc) → Intérêt (problème identifié) → Désir (solution et bénéfices) → Action (CTA clair)",
    pas: "Structure PAS: Problème (identifier la douleur) → Agitation (amplifier l'urgence) → Solution (présenter la réponse)",
    storytelling: "Structure Storytelling: Situation initiale → Élément perturbateur → Quête/Obstacles → Résolution → Leçon",
    hook: "Structure Hook + Value: Accroche ultra-percutante → Développement de valeur → Conclusion mémorable",
    liste: "Structure Liste: Introduction accrocheuse → Points numérotés (3-7) → Conclusion avec CTA",
    'avant-apres': "Structure Avant/Après: Situation problématique → Transformation → Résultat concret",
    contrarian: "Structure Contrarian: Opinion controversée → Arguments contre-intuitifs → Conclusion provocante",
    'how-to': "Structure How-To: Promesse → Étapes claires et numérotées → Résultat attendu",
    personal: "Structure Personal Story: Contexte personnel → Moment clé → Apprentissage → Application universelle",
    data: "Structure Data-Driven: Statistique choc → Analyse → Implications → Action"
  };

  const platformGuides = {
    linkedin: "LinkedIn: Ton professionnel mais humain, sauts de ligne fréquents, 1-3 hashtags max en fin de post, longueur 800-1500 caractères idéale",
    instagram: "Instagram: Ton casual et visuel, émojis autorisés, hashtags 5-15 en fin ou commentaire, format carré-compatible",
    twitter: "Twitter/X: Ultra-concis (280 chars max), percutant, thread si nécessaire, 1-2 hashtags max",
    threads: "Threads: Conversationnel, format thread fluide, pas de hashtags, ton authentique",
    tiktok: "TikTok: Script oral/caption, hooks dans les 3 premières secondes, trending sounds references OK",
    facebook: "Facebook: Ton familier, storytelling apprécié, questions pour engagement, peu de hashtags"
  };

  return `Tu es un expert en création de contenu pour réseaux sociaux.

STRUCTURE À UTILISER : ${structureGuides[structure] || structureGuides.hook}

PLATEFORME : ${platformGuides[platform] || platformGuides.linkedin}

FORMAT : ${format === 'carousel' ? 'Carousel (slides séparées par ---)' : format === 'thread' ? 'Thread (tweets séparés par ---)' : 'Post unique'}

${voiceContext}

RÈGLES :
- Contenu prêt à publier, pas de métacommentaires
- Adapte le ton et la longueur à la plateforme
- Utilise des sauts de ligne pour aérer
- Inclus un CTA quand pertinent
- Pas de hashtags sauf si demandé explicitement pour Instagram/LinkedIn`;
}

function buildAPIUserPrompt(idea, structure, format, platform) {
  return `Crée un contenu ${format || 'post'} pour ${platform || 'LinkedIn'} sur le sujet suivant :

"${idea}"

${structure ? `Utilise la structure ${structure.toUpperCase()}.` : ''}

Génère le contenu final, prêt à être publié.`;
}

function getMonthEndDate() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}

// ============================================================
// BREVO INTEGRATION
// ============================================================

async function handleBrevoContact(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { email, name, source } = body;

    if (!email) {
      return jsonResponse({ error: 'Email required' }, 400, corsHeaders);
    }

    await addContactToBrevo(email, name, source || 'trial', env);

    return jsonResponse({ success: true, message: 'Contact added to Brevo' }, 200, corsHeaders);
  } catch (error) {
    console.error('Brevo contact error:', error);
    return jsonResponse({ error: 'Failed to add contact', message: error.message }, 500, corsHeaders);
  }
}

async function addContactToBrevo(email, name, plan, env) {
  if (!env.BREVO_API_KEY) {
    console.log('⚠️ BREVO_API_KEY non configurée, skip ajout contact');
    return;
  }

  try {
    // Mapper le plan interne vers le format Brevo
    const brevoPlan = mapPlanToBrevo(plan);

    // Préparer les attributs selon la config Brevo
    const attributes = {
      PRENOM: name ? name.split(' ')[0] : '',
      PLAN: brevoPlan
    };

    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': env.BREVO_API_KEY
      },
      body: JSON.stringify({
        email: email.toLowerCase(),
        attributes: attributes,
        listIds: [3], // Liste SOS Storytelling = ID 3
        updateEnabled: true // Met à jour si le contact existe déjà
      })
    });

    if (response.ok) {
      console.log('✅ Contact ajouté à Brevo:', email, '- Plan:', brevoPlan);
    } else {
      const errorData = await response.json();
      // Code 'duplicate_parameter' signifie que le contact existe déjà (pas une vraie erreur)
      if (errorData.code !== 'duplicate_parameter') {
        console.error('❌ Erreur Brevo:', errorData);
      } else {
        console.log('ℹ️ Contact déjà existant dans Brevo:', email);
      }
    }
  } catch (error) {
    console.error('Erreur ajout Brevo:', error);
  }
}

function mapPlanToBrevo(plan) {
  // Mapper les plans internes vers les valeurs Brevo
  const mapping = {
    'free': 'free',
    'trial': 'free',
    'solo': 'solo',
    'agency_starter': 'agence',
    'agency_scale': 'agency_plus',
    'enterprise': 'agency_plus'
  };
  return mapping[plan] || 'free';
}

// ============================================================
// ADMIN API
// ============================================================

async function handleAdminAPI(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/admin', '');

  // Vérifier l'authentification admin (via header Authorization avec le service key)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');

  // Pour l'admin, on vérifie que c'est bien un admin dans Supabase
  const isAdmin = await verifyAdminToken(token, env);
  if (!isAdmin) {
    return jsonResponse({ error: 'Admin access required' }, 403, corsHeaders);
  }

  try {
    switch (true) {
      // GET /api/admin/stats - Statistiques globales
      case path === '/stats' && request.method === 'GET':
        return await handleAdminStats(env, corsHeaders);

      // GET /api/admin/users - Liste des utilisateurs
      case path === '/users' && request.method === 'GET':
        return await handleAdminListUsers(url, env, corsHeaders);

      // GET /api/admin/users/:email - Détail d'un utilisateur
      case path.match(/^\/users\/[^/]+$/) && request.method === 'GET':
        const email = decodeURIComponent(path.split('/')[2]);
        return await handleAdminGetUser(email, env, corsHeaders);

      // PATCH /api/admin/users/:email - Modifier un utilisateur
      case path.match(/^\/users\/[^/]+$/) && request.method === 'PATCH':
        const emailToUpdate = decodeURIComponent(path.split('/')[2]);
        return await handleAdminUpdateUser(emailToUpdate, request, env, corsHeaders);

      // GET /api/admin/events - Événements récents
      case path === '/events' && request.method === 'GET':
        return await handleAdminListEvents(url, env, corsHeaders);

      // GET /api/admin/revenue - Stats de revenus
      case path === '/revenue' && request.method === 'GET':
        return await handleAdminRevenue(url, env, corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Admin API Error:', error);
    return jsonResponse({ error: 'Internal error', message: error.message }, 500, corsHeaders);
  }
}

async function verifyAdminToken(token, env) {
  try {
    // Vérifier le token Supabase et récupérer l'utilisateur
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': env.SUPABASE_SERVICE_KEY
      }
    });

    if (!response.ok) return false;

    const user = await response.json();

    // Vérifier si l'email est dans la liste des admins
    // Tu peux aussi ajouter une colonne 'is_admin' dans ta table users
    const adminEmails = ['sandra@myinnerquest.fr', 'admin@myinnerquest.fr'];

    return adminEmails.includes(user.email?.toLowerCase());
  } catch (error) {
    console.error('Admin verification error:', error);
    return false;
  }
}

async function handleAdminStats(env, corsHeaders) {
  // Récupérer les stats globales
  const [usersResponse, eventsResponse] = await Promise.all([
    fetch(`${env.SUPABASE_URL}/rest/v1/users?select=id,plan,subscription_status,trial_ends_at,created_at`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }),
    fetch(`${env.SUPABASE_URL}/rest/v1/subscription_events?select=event_type,created_at&order=created_at.desc&limit=100`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    })
  ]);

  const users = await usersResponse.json();
  const events = await eventsResponse.json();

  const now = new Date();
  const stats = {
    total_users: users.length,
    users_by_plan: {},
    users_by_status: {},
    trials_active: 0,
    trials_expiring_soon: 0, // Dans les 3 prochains jours
    new_users_today: 0,
    new_users_this_week: 0,
    new_users_this_month: 0,
    recent_events: events.slice(0, 20)
  };

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  users.forEach(user => {
    // Par plan
    stats.users_by_plan[user.plan || 'free'] = (stats.users_by_plan[user.plan || 'free'] || 0) + 1;

    // Par status
    stats.users_by_status[user.subscription_status || 'none'] = (stats.users_by_status[user.subscription_status || 'none'] || 0) + 1;

    // Trials actifs
    if (user.subscription_status === 'on_trial' && user.trial_ends_at) {
      const trialEnd = new Date(user.trial_ends_at);
      if (trialEnd > now) {
        stats.trials_active++;
        // Expire dans 3 jours ?
        const daysLeft = (trialEnd - now) / (1000 * 60 * 60 * 24);
        if (daysLeft <= 3) {
          stats.trials_expiring_soon++;
        }
      }
    }

    // Nouveaux utilisateurs
    const createdAt = new Date(user.created_at);
    if (createdAt >= today) stats.new_users_today++;
    if (createdAt >= weekAgo) stats.new_users_this_week++;
    if (createdAt >= monthStart) stats.new_users_this_month++;
  });

  return jsonResponse({ success: true, stats }, 200, corsHeaders);
}

async function handleAdminListUsers(url, env, corsHeaders) {
  const page = parseInt(url.searchParams.get('page')) || 1;
  const limit = parseInt(url.searchParams.get('limit')) || 50;
  const status = url.searchParams.get('status');
  const plan = url.searchParams.get('plan');
  const search = url.searchParams.get('search');

  const offset = (page - 1) * limit;

  let query = `${env.SUPABASE_URL}/rest/v1/users?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;

  if (status) query += `&subscription_status=eq.${status}`;
  if (plan) query += `&plan=eq.${plan}`;
  if (search) query += `&or=(email.ilike.*${search}*,name.ilike.*${search}*)`;

  const response = await fetch(query, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Prefer': 'count=exact'
    }
  });

  const users = await response.json();
  const totalCount = response.headers.get('content-range');
  const total = totalCount ? parseInt(totalCount.split('/')[1]) : users.length;

  return jsonResponse({
    success: true,
    users,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit)
    }
  }, 200, corsHeaders);
}

async function handleAdminGetUser(email, env, corsHeaders) {
  const [userResponse, eventsResponse] = await Promise.all([
    fetch(`${env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }),
    fetch(`${env.SUPABASE_URL}/rest/v1/subscription_events?email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=20`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    })
  ]);

  const users = await userResponse.json();
  const events = await eventsResponse.json();

  if (!users || users.length === 0) {
    return jsonResponse({ error: 'User not found' }, 404, corsHeaders);
  }

  return jsonResponse({
    success: true,
    user: users[0],
    events
  }, 200, corsHeaders);
}

async function handleAdminUpdateUser(email, request, env, corsHeaders) {
  const body = await request.json();

  // Champs autorisés à modifier
  const allowedFields = ['plan', 'subscription_status', 'trial_ends_at', 'subscription_renews_at', 'trial_used'];
  const updateData = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return jsonResponse({ error: 'No valid fields to update' }, 400, corsHeaders);
  }

  updateData.updated_at = new Date().toISOString();

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(updateData)
  });

  const updatedUsers = await response.json();

  if (!updatedUsers || updatedUsers.length === 0) {
    return jsonResponse({ error: 'User not found or update failed' }, 404, corsHeaders);
  }

  // Logger l'action admin
  await logSubscriptionEvent('admin_update', {
    user_email: email,
    changes: updateData,
    admin_action: true
  }, env);

  return jsonResponse({
    success: true,
    user: updatedUsers[0]
  }, 200, corsHeaders);
}

async function handleAdminListEvents(url, env, corsHeaders) {
  const limit = parseInt(url.searchParams.get('limit')) || 100;
  const eventType = url.searchParams.get('type');

  let query = `${env.SUPABASE_URL}/rest/v1/subscription_events?select=*&order=created_at.desc&limit=${limit}`;

  if (eventType) query += `&event_type=eq.${eventType}`;

  const response = await fetch(query, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
    }
  });

  const events = await response.json();

  return jsonResponse({
    success: true,
    events,
    count: events.length
  }, 200, corsHeaders);
}

async function handleAdminRevenue(url, env, corsHeaders) {
  // Calculer le MRR approximatif basé sur les abonnements actifs
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/users?subscription_status=eq.active&select=plan`, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
    }
  });

  const activeUsers = await response.json();

  // Prix mensuels par plan
  const prices = {
    solo: 39,
    agency_starter: 99,
    agency_scale: 199,
    enterprise: 499
  };

  let mrr = 0;
  const breakdown = {};

  activeUsers.forEach(user => {
    const plan = user.plan || 'solo';
    const price = prices[plan] || 0;
    mrr += price;
    breakdown[plan] = (breakdown[plan] || 0) + 1;
  });

  return jsonResponse({
    success: true,
    revenue: {
      mrr,
      arr: mrr * 12,
      active_subscriptions: activeUsers.length,
      breakdown
    }
  }, 200, corsHeaders);
}
