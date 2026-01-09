// cloudflare-worker-v8.js - Avec Module Newsletters + Intégration Orshot
// Variables d'environnement requises:
// - ANTHROPIC_API_KEY
// - PERPLEXITY_API_KEY
// - SUPABASE_URL
// - SUPABASE_SERVICE_KEY (service_role pour le worker)
// - LEMONSQUEEZY_WEBHOOK_SECRET (pour vérifier les signatures des webhooks)
// - BREVO_API_KEY (pour ajouter les contacts à Brevo)
// - ORSHOT_API_KEY (pour la génération de visuels)

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

    // ============ NEWSLETTERS API (/api/newsletters/*) ============
    if (url.pathname.startsWith('/api/newsletters')) {
      return handleNewslettersAPI(request, env, corsHeaders);
    }

    // ============ VISUALS API - Orshot (/api/visuals/*) ============
    if (url.pathname.startsWith('/api/visuals')) {
      return handleVisualsAPI(request, env, corsHeaders);
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
// NEWSLETTERS API - Module "Newsletters qui Convertissent"
// ============================================================

async function handleNewslettersAPI(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/newsletters', '');

  // Authentification via Supabase token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required', code: 'UNAUTHORIZED' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);

  if (!user) {
    return jsonResponse({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' }, 401, corsHeaders);
  }

  try {
    switch (true) {
      // ============ GÉNÉRATION DE NEWSLETTER ============
      // POST /api/newsletters/generate - Générer une newsletter
      case path === '/generate' && request.method === 'POST':
        return await handleGenerateNewsletter(request, env, user, corsHeaders);

      // POST /api/newsletters/generate-sequence - Générer une séquence d'emails
      case path === '/generate-sequence' && request.method === 'POST':
        return await handleGenerateSequence(request, env, user, corsHeaders);

      // POST /api/newsletters/regenerate - Régénérer avec ajustements
      case path === '/regenerate' && request.method === 'POST':
        return await handleRegenerateNewsletter(request, env, user, corsHeaders);

      // ============ CRUD NEWSLETTERS ============
      // GET /api/newsletters - Lister les newsletters
      case path === '' && request.method === 'GET':
        return await handleListNewsletters(url, env, user, corsHeaders);

      // POST /api/newsletters - Sauvegarder une newsletter
      case path === '' && request.method === 'POST':
        return await handleSaveNewsletter(request, env, user, corsHeaders);

      // GET /api/newsletters/:id - Détail d'une newsletter
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'GET':
        const getId = path.slice(1);
        return await handleGetNewsletter(getId, env, user, corsHeaders);

      // PUT /api/newsletters/:id - Mettre à jour une newsletter
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'PUT':
        const updateId = path.slice(1);
        return await handleUpdateNewsletter(updateId, request, env, user, corsHeaders);

      // DELETE /api/newsletters/:id - Supprimer une newsletter
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'DELETE':
        const deleteId = path.slice(1);
        return await handleDeleteNewsletter(deleteId, env, user, corsHeaders);

      // ============ TEMPLATES ============
      // GET /api/newsletters/templates - Lister les templates
      case path === '/templates' && request.method === 'GET':
        return await handleListTemplates(url, env, user, corsHeaders);

      // POST /api/newsletters/templates - Créer un template
      case path === '/templates' && request.method === 'POST':
        return await handleCreateTemplate(request, env, user, corsHeaders);

      // DELETE /api/newsletters/templates/:id - Supprimer un template
      case path.match(/^\/templates\/[a-f0-9-]+$/) && request.method === 'DELETE':
        const templateId = path.replace('/templates/', '');
        return await handleDeleteTemplate(templateId, env, user, corsHeaders);

      // ============ CLIENTS (Mode Agency) ============
      // GET /api/newsletters/clients - Lister les clients
      case path === '/clients' && request.method === 'GET':
        return await handleListClients(env, user, corsHeaders);

      // POST /api/newsletters/clients - Créer un client
      case path === '/clients' && request.method === 'POST':
        return await handleCreateClient(request, env, user, corsHeaders);

      // PUT /api/newsletters/clients/:id - Mettre à jour un client
      case path.match(/^\/clients\/[a-f0-9-]+$/) && request.method === 'PUT':
        const clientUpdateId = path.replace('/clients/', '');
        return await handleUpdateClient(clientUpdateId, request, env, user, corsHeaders);

      // DELETE /api/newsletters/clients/:id - Supprimer un client
      case path.match(/^\/clients\/[a-f0-9-]+$/) && request.method === 'DELETE':
        const clientDeleteId = path.replace('/clients/', '');
        return await handleDeleteClient(clientDeleteId, env, user, corsHeaders);

      // ============ STATISTIQUES ============
      // GET /api/newsletters/stats - Statistiques utilisateur
      case path === '/stats' && request.method === 'GET':
        return await handleGetStats(env, user, corsHeaders);

      // ============ STRUCTURES & TYPES ============
      // GET /api/newsletters/types - Types de newsletters disponibles
      case path === '/types' && request.method === 'GET':
        return handleGetNewsletterTypes(corsHeaders);

      // GET /api/newsletters/structures - Structures copywriting disponibles
      case path === '/structures' && request.method === 'GET':
        return handleGetNewsletterStructures(corsHeaders);

      // GET /api/newsletters/tones - Tons disponibles
      case path === '/tones' && request.method === 'GET':
        return handleGetTones(corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found', code: 'NOT_FOUND' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Newsletter API Error:', error);
    return jsonResponse({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: error.message
    }, 500, corsHeaders);
  }
}

// ============================================================
// GÉNÉRATION DE NEWSLETTER (IA)
// ============================================================

async function handleGenerateNewsletter(request, env, user, corsHeaders) {
  const body = await request.json();

  // Validation des champs requis
  const {
    newsletterType,
    structure,
    objective,
    targetAudience,
    productService,
    ctaType,
    ctaText,
    ctaUrl,
    anecdote,
    voiceId,
    customVoice,
    tone,
    clientId
  } = body;

  if (!newsletterType || !structure || !objective || !targetAudience) {
    return jsonResponse({
      error: 'Missing required fields: newsletterType, structure, objective, targetAudience',
      code: 'MISSING_FIELDS'
    }, 400, corsHeaders);
  }

  // Récupérer le profil de voix si spécifié
  let voiceContext = "";
  if (voiceId) {
    const voiceProfile = await getVoiceProfile(voiceId, user.id, env);
    if (voiceProfile) {
      voiceContext = buildNewsletterVoiceContext(voiceProfile.profile_data);
    }
  } else if (customVoice) {
    voiceContext = `\n\nSTYLE D'ÉCRITURE PERSONNALISÉ:\n${customVoice}\n`;
  }

  // Si client spécifié (Mode Agency), récupérer son contexte
  let clientContext = "";
  if (clientId) {
    const client = await getClient(clientId, user.id, env);
    if (client) {
      clientContext = buildClientContext(client);
    }
  }

  // Construire le prompt système
  const systemPrompt = buildNewsletterSystemPrompt(newsletterType, structure, tone, voiceContext, clientContext);

  // Construire le prompt utilisateur
  const userPrompt = buildNewsletterUserPrompt({
    newsletterType,
    structure,
    objective,
    targetAudience,
    productService,
    ctaType,
    ctaText,
    ctaUrl,
    anecdote
  });

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
      max_tokens: 4000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  if (!claudeResponse.ok) {
    const errorData = await claudeResponse.text();
    console.error("Claude API Error:", claudeResponse.status, errorData);
    return jsonResponse({
      error: 'AI generation failed',
      code: 'AI_ERROR',
      details: claudeResponse.status
    }, 502, corsHeaders);
  }

  const data = await claudeResponse.json();
  const generatedContent = data.content[0].text;

  // Parser la réponse JSON de Claude
  let parsedContent;
  try {
    // Extraire le JSON de la réponse
    const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedContent = JSON.parse(jsonMatch[0]);
    } else {
      // Si pas de JSON, structurer la réponse
      parsedContent = {
        subjectLines: ["Objet à personnaliser"],
        previewText: "Preview à personnaliser",
        body: generatedContent,
        cta: ctaText || "Découvrir"
      };
    }
  } catch (e) {
    parsedContent = {
      subjectLines: ["Objet à personnaliser"],
      previewText: "Preview à personnaliser",
      body: generatedContent,
      cta: ctaText || "Découvrir"
    };
  }

  return jsonResponse({
    success: true,
    newsletter: {
      subjectLines: parsedContent.subjectLines || parsedContent.subjects || ["Objet 1", "Objet 2", "Objet 3"],
      previewText: parsedContent.previewText || parsedContent.preview || "",
      body: parsedContent.body || parsedContent.content || generatedContent,
      cta: parsedContent.cta || ctaText || "Découvrir",
      structure: structure,
      type: newsletterType
    },
    usage: {
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0
    }
  }, 200, corsHeaders);
}

// ============================================================
// GÉNÉRATION DE SÉQUENCE (plusieurs emails liés)
// ============================================================

async function handleGenerateSequence(request, env, user, corsHeaders) {
  const body = await request.json();

  const {
    newsletterType,
    structure,
    objective,
    targetAudience,
    productService,
    ctaType,
    ctaText,
    ctaUrl,
    anecdote,
    voiceId,
    customVoice,
    tone,
    clientId,
    sequenceCount = 5 // Par défaut 5 emails
  } = body;

  if (!newsletterType || !objective || !targetAudience) {
    return jsonResponse({
      error: 'Missing required fields',
      code: 'MISSING_FIELDS'
    }, 400, corsHeaders);
  }

  // Limiter le nombre d'emails
  const emailCount = Math.min(Math.max(sequenceCount, 2), 7);

  // Récupérer le contexte voix
  let voiceContext = "";
  if (voiceId) {
    const voiceProfile = await getVoiceProfile(voiceId, user.id, env);
    if (voiceProfile) {
      voiceContext = buildNewsletterVoiceContext(voiceProfile.profile_data);
    }
  } else if (customVoice) {
    voiceContext = `\n\nSTYLE D'ÉCRITURE PERSONNALISÉ:\n${customVoice}\n`;
  }

  // Contexte client si Agency
  let clientContext = "";
  if (clientId) {
    const client = await getClient(clientId, user.id, env);
    if (client) {
      clientContext = buildClientContext(client);
    }
  }

  const systemPrompt = buildSequenceSystemPrompt(newsletterType, emailCount, tone, voiceContext, clientContext);

  const userPrompt = buildSequenceUserPrompt({
    newsletterType,
    objective,
    targetAudience,
    productService,
    ctaType,
    ctaText,
    ctaUrl,
    anecdote,
    emailCount
  });

  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  if (!claudeResponse.ok) {
    const errorData = await claudeResponse.text();
    console.error("Claude API Error:", claudeResponse.status, errorData);
    return jsonResponse({
      error: 'AI generation failed',
      code: 'AI_ERROR'
    }, 502, corsHeaders);
  }

  const data = await claudeResponse.json();
  const generatedContent = data.content[0].text;

  // Parser la séquence
  let sequence;
  try {
    const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      sequence = parsed.sequence || parsed.emails || [];
    } else {
      sequence = [];
    }
  } catch (e) {
    console.error("Parse error:", e);
    sequence = [];
  }

  return jsonResponse({
    success: true,
    sequence: sequence,
    sequenceCount: sequence.length,
    arc: getSequenceArc(newsletterType, sequence.length),
    usage: {
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0
    }
  }, 200, corsHeaders);
}

// ============================================================
// RÉGÉNÉRER AVEC AJUSTEMENTS
// ============================================================

async function handleRegenerateNewsletter(request, env, user, corsHeaders) {
  const body = await request.json();

  const {
    originalContent,
    adjustments, // ex: "plus court", "ton plus chaleureux", "ajoute de l'urgence"
    newsletterType,
    structure,
    tone
  } = body;

  if (!originalContent || !adjustments) {
    return jsonResponse({
      error: 'Missing originalContent or adjustments',
      code: 'MISSING_FIELDS'
    }, 400, corsHeaders);
  }

  const systemPrompt = `Tu es un expert en email marketing et copywriting.
Tu dois MODIFIER un email existant selon les instructions données.
Conserve la structure générale mais applique les ajustements demandés.

RÈGLES:
- Garde le même format de réponse (JSON)
- Conserve l'essence du message original
- Applique précisément les modifications demandées
- Génère 3 nouveaux objets d'email adaptés

Réponds UNIQUEMENT en JSON valide avec cette structure:
{
  "subjectLines": ["Objet 1", "Objet 2", "Objet 3"],
  "previewText": "Texte de preview",
  "body": "Corps de l'email",
  "cta": "Texte du CTA"
}`;

  const userPrompt = `CONTENU ORIGINAL:
${JSON.stringify(originalContent, null, 2)}

AJUSTEMENTS DEMANDÉS:
${adjustments}

${tone ? `TON SOUHAITÉ: ${tone}` : ''}

Régénère l'email en appliquant ces ajustements. Réponds en JSON.`;

  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  if (!claudeResponse.ok) {
    return jsonResponse({ error: 'AI regeneration failed', code: 'AI_ERROR' }, 502, corsHeaders);
  }

  const data = await claudeResponse.json();
  const generatedContent = data.content[0].text;

  let parsedContent;
  try {
    const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedContent = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    parsedContent = { body: generatedContent };
  }

  return jsonResponse({
    success: true,
    newsletter: parsedContent,
    adjustmentsApplied: adjustments
  }, 200, corsHeaders);
}

// ============================================================
// CRUD NEWSLETTERS
// ============================================================

async function handleListNewsletters(url, env, user, corsHeaders) {
  const page = parseInt(url.searchParams.get('page')) || 1;
  const limit = parseInt(url.searchParams.get('limit')) || 20;
  const clientId = url.searchParams.get('client_id');
  const type = url.searchParams.get('type');
  const offset = (page - 1) * limit;

  let query = `${env.SUPABASE_URL}/rest/v1/newsletters?user_id=eq.${user.id}&order=created_at.desc&limit=${limit}&offset=${offset}`;

  if (clientId) query += `&client_id=eq.${clientId}`;
  if (type) query += `&newsletter_type=eq.${type}`;

  const response = await fetch(query, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Prefer': 'count=exact'
    }
  });

  const newsletters = await response.json();
  const contentRange = response.headers.get('content-range');
  const total = contentRange ? parseInt(contentRange.split('/')[1]) : newsletters.length;

  return jsonResponse({
    success: true,
    newsletters,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  }, 200, corsHeaders);
}

async function handleSaveNewsletter(request, env, user, corsHeaders) {
  const body = await request.json();

  const newsletterData = {
    user_id: user.id,
    client_id: body.clientId || null,
    name: body.name || `Newsletter ${new Date().toLocaleDateString('fr-FR')}`,
    description: body.description || null,
    newsletter_type: body.newsletterType,
    structure: body.structure,
    voice_id: body.voiceId || null,
    custom_voice_description: body.customVoice || null,
    tone: body.tone || null,
    is_sequence: body.isSequence || false,
    sequence_count: body.sequenceCount || 1,
    objective: body.objective,
    product_service: body.productService || null,
    target_audience: body.targetAudience,
    cta_type: body.ctaType || null,
    cta_text: body.ctaText || null,
    cta_url: body.ctaUrl || null,
    anecdote: body.anecdote || null,
    additional_context: body.additionalContext || null,
    status: 'generated'
  };

  // Insérer la newsletter
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/newsletters`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(newsletterData)
  });

  const newsletters = await response.json();

  if (!newsletters || newsletters.length === 0) {
    return jsonResponse({ error: 'Failed to save newsletter', code: 'SAVE_ERROR' }, 500, corsHeaders);
  }

  const newsletter = newsletters[0];

  // Sauvegarder les emails générés
  if (body.emails && body.emails.length > 0) {
    const emailsData = body.emails.map((email, index) => ({
      newsletter_id: newsletter.id,
      sequence_position: index + 1,
      sequence_role: email.role || (body.isSequence ? getSequenceRole(index, body.emails.length) : 'single'),
      subject_lines: JSON.stringify(email.subjectLines || []),
      selected_subject: email.selectedSubject || email.subjectLines?.[0] || '',
      preview_text: email.previewText || '',
      body_content: email.body || '',
      cta_formatted: email.cta || '',
      generated_at: new Date().toISOString()
    }));

    await fetch(`${env.SUPABASE_URL}/rest/v1/newsletter_emails`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailsData)
    });
  }

  return jsonResponse({
    success: true,
    newsletter: newsletter,
    message: 'Newsletter saved successfully'
  }, 201, corsHeaders);
}

async function handleGetNewsletter(id, env, user, corsHeaders) {
  // Récupérer la newsletter
  const [newsletterRes, emailsRes] = await Promise.all([
    fetch(`${env.SUPABASE_URL}/rest/v1/newsletters?id=eq.${id}&user_id=eq.${user.id}`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }),
    fetch(`${env.SUPABASE_URL}/rest/v1/newsletter_emails?newsletter_id=eq.${id}&order=sequence_position.asc`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    })
  ]);

  const newsletters = await newsletterRes.json();
  const emails = await emailsRes.json();

  if (!newsletters || newsletters.length === 0) {
    return jsonResponse({ error: 'Newsletter not found', code: 'NOT_FOUND' }, 404, corsHeaders);
  }

  return jsonResponse({
    success: true,
    newsletter: newsletters[0],
    emails: emails
  }, 200, corsHeaders);
}

async function handleUpdateNewsletter(id, request, env, user, corsHeaders) {
  const body = await request.json();

  // Vérifier que la newsletter appartient à l'utilisateur
  const checkRes = await fetch(`${env.SUPABASE_URL}/rest/v1/newsletters?id=eq.${id}&user_id=eq.${user.id}`, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
    }
  });

  const existing = await checkRes.json();
  if (!existing || existing.length === 0) {
    return jsonResponse({ error: 'Newsletter not found', code: 'NOT_FOUND' }, 404, corsHeaders);
  }

  const updateData = {
    name: body.name,
    description: body.description,
    status: body.status || 'edited',
    updated_at: new Date().toISOString()
  };

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/newsletters?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(updateData)
  });

  const updated = await response.json();

  return jsonResponse({
    success: true,
    newsletter: updated[0]
  }, 200, corsHeaders);
}

async function handleDeleteNewsletter(id, env, user, corsHeaders) {
  // Vérifier propriété
  const checkRes = await fetch(`${env.SUPABASE_URL}/rest/v1/newsletters?id=eq.${id}&user_id=eq.${user.id}`, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
    }
  });

  const existing = await checkRes.json();
  if (!existing || existing.length === 0) {
    return jsonResponse({ error: 'Newsletter not found', code: 'NOT_FOUND' }, 404, corsHeaders);
  }

  // Supprimer (les emails seront supprimés en cascade grâce à ON DELETE CASCADE)
  await fetch(`${env.SUPABASE_URL}/rest/v1/newsletters?id=eq.${id}`, {
    method: 'DELETE',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
    }
  });

  return jsonResponse({ success: true, message: 'Newsletter deleted' }, 200, corsHeaders);
}

// ============================================================
// TEMPLATES
// ============================================================

async function handleListTemplates(url, env, user, corsHeaders) {
  const clientId = url.searchParams.get('client_id');

  let query = `${env.SUPABASE_URL}/rest/v1/newsletter_templates?user_id=eq.${user.id}&order=use_count.desc`;
  if (clientId) query += `&client_id=eq.${clientId}`;

  const response = await fetch(query, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
    }
  });

  const templates = await response.json();

  return jsonResponse({ success: true, templates }, 200, corsHeaders);
}

async function handleCreateTemplate(request, env, user, corsHeaders) {
  const body = await request.json();

  const templateData = {
    user_id: user.id,
    client_id: body.clientId || null,
    name: body.name,
    description: body.description || null,
    newsletter_type: body.newsletterType,
    structure: body.structure,
    voice_id: body.voiceId || null,
    tone: body.tone || null,
    target_audience: body.targetAudience || null,
    cta_type: body.ctaType || null
  };

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/newsletter_templates`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(templateData)
  });

  const templates = await response.json();

  return jsonResponse({ success: true, template: templates[0] }, 201, corsHeaders);
}

async function handleDeleteTemplate(id, env, user, corsHeaders) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/newsletter_templates?id=eq.${id}&user_id=eq.${user.id}`, {
    method: 'DELETE',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
    }
  });

  return jsonResponse({ success: true, message: 'Template deleted' }, 200, corsHeaders);
}

// ============================================================
// CLIENTS (Mode Agency)
// ============================================================

async function handleListClients(env, user, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/clients?user_id=eq.${user.id}&is_active=eq.true&order=name.asc`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const clients = await response.json();

  return jsonResponse({ success: true, clients }, 200, corsHeaders);
}

async function handleCreateClient(request, env, user, corsHeaders) {
  const body = await request.json();

  const clientData = {
    user_id: user.id,
    name: body.name,
    company: body.company || null,
    industry: body.industry || null,
    voice_description: body.voiceDescription || null,
    tone: body.tone || null,
    brand_keywords: body.brandKeywords || [],
    email: body.email || null,
    website: body.website || null,
    target_audience: body.targetAudience || null,
    main_products: body.mainProducts || null,
    unique_value: body.uniqueValue || null
  };

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/clients`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(clientData)
  });

  const clients = await response.json();

  return jsonResponse({ success: true, client: clients[0] }, 201, corsHeaders);
}

async function handleUpdateClient(id, request, env, user, corsHeaders) {
  const body = await request.json();

  const updateData = {
    name: body.name,
    company: body.company,
    industry: body.industry,
    voice_description: body.voiceDescription,
    tone: body.tone,
    brand_keywords: body.brandKeywords,
    email: body.email,
    website: body.website,
    target_audience: body.targetAudience,
    main_products: body.mainProducts,
    unique_value: body.uniqueValue,
    updated_at: new Date().toISOString()
  };

  // Remove undefined values
  Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/clients?id=eq.${id}&user_id=eq.${user.id}`, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(updateData)
  });

  const clients = await response.json();

  if (!clients || clients.length === 0) {
    return jsonResponse({ error: 'Client not found', code: 'NOT_FOUND' }, 404, corsHeaders);
  }

  return jsonResponse({ success: true, client: clients[0] }, 200, corsHeaders);
}

async function handleDeleteClient(id, env, user, corsHeaders) {
  // Soft delete (désactiver)
  await fetch(`${env.SUPABASE_URL}/rest/v1/clients?id=eq.${id}&user_id=eq.${user.id}`, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() })
  });

  return jsonResponse({ success: true, message: 'Client archived' }, 200, corsHeaders);
}

// ============================================================
// STATISTIQUES
// ============================================================

async function handleGetStats(env, user, corsHeaders) {
  const [newslettersRes, templatesRes] = await Promise.all([
    fetch(`${env.SUPABASE_URL}/rest/v1/newsletters?user_id=eq.${user.id}&select=id,newsletter_type,structure,is_sequence,created_at`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }),
    fetch(`${env.SUPABASE_URL}/rest/v1/newsletter_templates?user_id=eq.${user.id}&select=id`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    })
  ]);

  const newsletters = await newslettersRes.json();
  const templates = await templatesRes.json();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const stats = {
    totalNewsletters: newsletters.length,
    newslettersThisMonth: newsletters.filter(n => new Date(n.created_at) >= monthStart).length,
    totalSequences: newsletters.filter(n => n.is_sequence).length,
    totalTemplates: templates.length,
    byType: {},
    byStructure: {},
    favoriteType: null,
    favoriteStructure: null
  };

  // Compter par type et structure
  newsletters.forEach(n => {
    stats.byType[n.newsletter_type] = (stats.byType[n.newsletter_type] || 0) + 1;
    stats.byStructure[n.structure] = (stats.byStructure[n.structure] || 0) + 1;
  });

  // Trouver les favoris
  let maxType = 0, maxStructure = 0;
  Object.entries(stats.byType).forEach(([type, count]) => {
    if (count > maxType) { maxType = count; stats.favoriteType = type; }
  });
  Object.entries(stats.byStructure).forEach(([structure, count]) => {
    if (count > maxStructure) { maxStructure = count; stats.favoriteStructure = structure; }
  });

  return jsonResponse({ success: true, stats }, 200, corsHeaders);
}

// ============================================================
// TYPES, STRUCTURES, TONS
// ============================================================

function handleGetNewsletterTypes(corsHeaders) {
  const types = [
    {
      id: 'launch',
      name: 'Lancement produit/service',
      icon: '🚀',
      description: 'Annonce d\'un nouveau produit ou service',
      bestStructures: ['aida', 'hook_story_offer']
    },
    {
      id: 'nurturing',
      name: 'Nurturing',
      icon: '💝',
      description: 'Créer la relation, apporter de la valeur',
      bestStructures: ['hook_story_offer', 'obi']
    },
    {
      id: 'reengagement',
      name: 'Réengagement',
      icon: '🔄',
      description: 'Réactiver les abonnés inactifs',
      bestStructures: ['pas', 'bab']
    },
    {
      id: 'promo',
      name: 'Promo/Vente flash',
      icon: '⚡',
      description: 'Offre limitée, promotion spéciale',
      bestStructures: ['aida', 'pas']
    },
    {
      id: 'storytelling',
      name: 'Storytelling personnel',
      icon: '📖',
      description: 'Coulisses, parcours, histoire personnelle',
      bestStructures: ['hook_story_offer', 'bab']
    },
    {
      id: 'event',
      name: 'Annonce événement',
      icon: '🎉',
      description: 'Webinar, atelier, conférence...',
      bestStructures: ['aida', 'pas']
    }
  ];

  return jsonResponse({ success: true, types }, 200, corsHeaders);
}

function handleGetNewsletterStructures(corsHeaders) {
  const structures = [
    {
      id: 'aida',
      name: 'AIDA',
      fullName: 'Attention - Intérêt - Désir - Action',
      icon: '🎯',
      description: 'Structure classique de copywriting pour guider vers l\'action',
      steps: ['Attention: Accroche choc', 'Intérêt: Problème identifié', 'Désir: Solution et bénéfices', 'Action: CTA clair'],
      bestFor: ['launch', 'promo', 'event']
    },
    {
      id: 'pas',
      name: 'PAS',
      fullName: 'Problème - Agitation - Solution',
      icon: '🔥',
      description: 'Identifier la douleur, l\'amplifier, puis présenter la solution',
      steps: ['Problème: Identifier la douleur', 'Agitation: Amplifier l\'urgence', 'Solution: Présenter la réponse'],
      bestFor: ['promo', 'reengagement', 'event']
    },
    {
      id: 'hook_story_offer',
      name: 'Hook + Story + Offer',
      fullName: 'Accroche + Histoire + Offre',
      icon: '📚',
      description: 'Captiver avec une accroche, raconter une histoire, faire une offre',
      steps: ['Hook: Accroche irrésistible', 'Story: Histoire engageante', 'Offer: Proposition de valeur'],
      bestFor: ['storytelling', 'nurturing', 'launch']
    },
    {
      id: 'bab',
      name: 'Before/After/Bridge',
      fullName: 'Avant - Après - Pont',
      icon: '🌉',
      description: 'Montrer la transformation possible',
      steps: ['Before: Situation actuelle', 'After: Situation rêvée', 'Bridge: Comment y arriver'],
      bestFor: ['storytelling', 'reengagement', 'nurturing']
    },
    {
      id: 'obi',
      name: 'One Big Idea',
      fullName: 'Une Grande Idée',
      icon: '💡',
      description: 'Un seul message puissant, développé en profondeur',
      steps: ['Une idée centrale', 'Développement approfondi', 'Conclusion mémorable'],
      bestFor: ['nurturing', 'storytelling']
    }
  ];

  return jsonResponse({ success: true, structures }, 200, corsHeaders);
}

function handleGetTones(corsHeaders) {
  const tones = [
    { id: 'warm', name: 'Chaleureux', icon: '☀️', description: 'Proche, bienveillant, comme un ami' },
    { id: 'direct', name: 'Direct', icon: '🎯', description: 'Droit au but, sans fioritures' },
    { id: 'inspiring', name: 'Inspirant', icon: '✨', description: 'Motivant, qui donne envie d\'agir' },
    { id: 'quirky', name: 'Décalé', icon: '🎭', description: 'Original, avec une touche d\'humour' },
    { id: 'expert', name: 'Expert', icon: '🎓', description: 'Autorité, maîtrise du sujet' },
    { id: 'friendly', name: 'Amical', icon: '🤝', description: 'Décontracté, accessible' },
    { id: 'professional', name: 'Professionnel', icon: '💼', description: 'Sérieux, corporate' },
    { id: 'storyteller', name: 'Conteur', icon: '📖', description: 'Narratif, captivant' }
  ];

  return jsonResponse({ success: true, tones }, 200, corsHeaders);
}

// ============================================================
// HELPERS - PROMPTS NEWSLETTER
// ============================================================

function buildNewsletterSystemPrompt(type, structure, tone, voiceContext, clientContext) {
  const typeDescriptions = {
    launch: "un email de LANCEMENT de produit/service. Objectif: créer l'excitation et l'envie",
    nurturing: "un email de NURTURING. Objectif: apporter de la valeur et renforcer la relation",
    reengagement: "un email de RÉENGAGEMENT. Objectif: réactiver un abonné inactif",
    promo: "un email PROMOTIONNEL. Objectif: générer des ventes avec urgence",
    storytelling: "un email STORYTELLING. Objectif: partager une histoire personnelle qui connecte",
    event: "un email d'ANNONCE D'ÉVÉNEMENT. Objectif: générer des inscriptions"
  };

  const structureGuides = {
    aida: `Structure AIDA:
1. ATTENTION: Une accroche qui stoppe le scroll (question choc, statistique surprenante, déclaration audacieuse)
2. INTÉRÊT: Identifier le problème/besoin du lecteur, montrer que tu comprends
3. DÉSIR: Présenter la solution et ses bénéfices concrets, créer l'envie
4. ACTION: Un CTA clair et unique`,

    pas: `Structure PAS:
1. PROBLÈME: Identifier précisément la douleur du lecteur
2. AGITATION: Amplifier le problème, montrer les conséquences de l'inaction
3. SOLUTION: Présenter ta solution comme la réponse évidente`,

    hook_story_offer: `Structure Hook + Story + Offer:
1. HOOK: Une première phrase irrésistible qui donne envie de lire la suite
2. STORY: Une histoire personnelle ou de client qui illustre le message
3. OFFER: La transition naturelle vers ton offre/CTA`,

    bab: `Structure Before/After/Bridge:
1. BEFORE: Décrire la situation actuelle (frustrante) du lecteur
2. AFTER: Peindre le tableau de la situation idéale
3. BRIDGE: Expliquer comment passer de l'un à l'autre`,

    obi: `Structure One Big Idea:
1. UNE IDÉE CENTRALE: Un seul concept puissant
2. DÉVELOPPEMENT: Explorer cette idée sous plusieurs angles
3. CONCLUSION: Ramener à l'essentiel avec impact`
  };

  const toneGuides = {
    warm: "Ton CHALEUREUX: Utilise le 'tu', sois proche, bienveillant. Comme si tu parlais à un ami.",
    direct: "Ton DIRECT: Va droit au but. Phrases courtes. Pas de blabla.",
    inspiring: "Ton INSPIRANT: Motive, élève, donne envie d'agir. Utilise des métaphores puissantes.",
    quirky: "Ton DÉCALÉ: Sois original, surprenant. Une pointe d'humour bien dosée.",
    expert: "Ton EXPERT: Montre ton autorité. Utilise des données, des preuves. Sois précis.",
    friendly: "Ton AMICAL: Décontracté mais pro. Comme une conversation entre collègues.",
    professional: "Ton PROFESSIONNEL: Sérieux, structuré. Adapté au B2B corporate.",
    storyteller: "Ton CONTEUR: Narratif, captivant. Emmène le lecteur dans un voyage."
  };

  return `Tu es un expert en email marketing et copywriting, spécialisé dans les newsletters qui convertissent.

MISSION: Tu dois rédiger ${typeDescriptions[type] || "un email marketing efficace"}.

${structureGuides[structure] || ""}

${toneGuides[tone] || ""}

${voiceContext}

${clientContext}

RÈGLES D'OR:
- Première ligne = CRUCIALE. Elle doit donner envie de lire la suite
- Un seul CTA par email (pas de confusion)
- Phrases courtes, paragraphes aérés
- Parle des bénéfices, pas des caractéristiques
- Utilise le "tu" pour créer la proximité
- Évite le jargon marketing trop évident

FORMAT DE RÉPONSE:
Réponds UNIQUEMENT en JSON valide avec cette structure exacte:
{
  "subjectLines": ["Objet 1 (max 50 car)", "Objet 2", "Objet 3"],
  "previewText": "Texte de preview (max 90 car)",
  "body": "Corps complet de l'email avec sauts de ligne",
  "cta": "Texte du bouton CTA"
}`;
}

function buildNewsletterUserPrompt(params) {
  const {
    newsletterType,
    structure,
    objective,
    targetAudience,
    productService,
    ctaType,
    ctaText,
    ctaUrl,
    anecdote
  } = params;

  const ctaDescriptions = {
    click_link: "cliquer sur un lien",
    reply: "répondre à l'email",
    purchase: "acheter",
    register: "s'inscrire",
    download: "télécharger",
    book_call: "réserver un appel"
  };

  return `BRIEF DE LA NEWSLETTER:

📌 TYPE: ${newsletterType}
📐 STRUCTURE: ${structure}

🎯 OBJECTIF:
${objective}

👥 CIBLE:
${targetAudience}

${productService ? `📦 PRODUIT/SERVICE:\n${productService}` : ''}

${ctaType ? `🔘 ACTION ATTENDUE: ${ctaDescriptions[ctaType] || ctaType}` : ''}
${ctaText ? `📝 TEXTE DU CTA: ${ctaText}` : ''}
${ctaUrl ? `🔗 URL: ${ctaUrl}` : ''}

${anecdote ? `✨ ANECDOTE/ÉLÉMENT PERSONNEL À INTÉGRER:\n${anecdote}` : ''}

Génère maintenant l'email complet en JSON.`;
}

function buildSequenceSystemPrompt(type, emailCount, tone, voiceContext, clientContext) {
  const sequenceArcs = {
    launch: ['teasing', 'value', 'offer', 'urgency', 'last_call'],
    promo: ['teasing', 'offer', 'value', 'urgency', 'last_call'],
    event: ['teasing', 'value', 'offer', 'urgency', 'last_call'],
    nurturing: ['value', 'value', 'value', 'offer', 'value'],
    reengagement: ['teasing', 'value', 'offer', 'urgency', 'last_call'],
    storytelling: ['teasing', 'value', 'value', 'offer', 'value']
  };

  const arc = sequenceArcs[type] || sequenceArcs.launch;
  const selectedArc = arc.slice(0, emailCount);

  const roleDescriptions = {
    teasing: "TEASING: Créer la curiosité, annoncer quelque chose qui arrive",
    value: "VALEUR: Apporter du contenu utile, renforcer la confiance",
    offer: "OFFRE: Présenter l'offre clairement avec ses bénéfices",
    urgency: "URGENCE: Créer le sentiment d'urgence (deadline, places limitées)",
    last_call: "DERNIER RAPPEL: Dernière chance, récap des bénéfices, FOMO"
  };

  return `Tu es un expert en séquences email et copywriting.

MISSION: Créer une SÉQUENCE de ${emailCount} emails cohérents pour ${type}.

ARC NARRATIF DE LA SÉQUENCE:
${selectedArc.map((role, i) => `Email ${i + 1}: ${roleDescriptions[role]}`).join('\n')}

${voiceContext}
${clientContext}

RÈGLES POUR LA SÉQUENCE:
- Chaque email doit pouvoir être lu indépendamment
- Mais ensemble ils racontent une histoire cohérente
- L'intensité monte progressivement
- Le dernier email est le plus direct/urgent
- Varier les accroches d'un email à l'autre

FORMAT DE RÉPONSE (JSON):
{
  "sequence": [
    {
      "position": 1,
      "role": "teasing",
      "subjectLines": ["Objet 1", "Objet 2", "Objet 3"],
      "previewText": "Preview",
      "body": "Corps de l'email",
      "cta": "Texte CTA",
      "sendDelay": "J+0"
    },
    // ... autres emails
  ]
}`;
}

function buildSequenceUserPrompt(params) {
  const {
    newsletterType,
    objective,
    targetAudience,
    productService,
    ctaType,
    ctaText,
    ctaUrl,
    anecdote,
    emailCount
  } = params;

  return `BRIEF DE LA SÉQUENCE:

📌 TYPE: ${newsletterType}
📊 NOMBRE D'EMAILS: ${emailCount}

🎯 OBJECTIF GLOBAL:
${objective}

👥 CIBLE:
${targetAudience}

${productService ? `📦 PRODUIT/SERVICE:\n${productService}` : ''}
${ctaType ? `🔘 ACTION FINALE ATTENDUE: ${ctaType}` : ''}
${ctaText ? `📝 CTA: ${ctaText}` : ''}
${anecdote ? `✨ ÉLÉMENT À INTÉGRER: ${anecdote}` : ''}

Génère la séquence complète de ${emailCount} emails en JSON.`;
}

function buildNewsletterVoiceContext(profileData) {
  if (!profileData) return "";

  return `

=== PROFIL DE VOIX (TRÈS IMPORTANT) ===
Tu DOIS écrire exactement comme cette personne:
- Ton: ${profileData.ton || "Non défini"}
- Longueur des phrases: ${profileData.longueurPhrases || "Variable"}
- Expressions favorites: ${profileData.expressions || "Aucune spécifiée"}
- Ponctuation/émojis: ${profileData.ponctuation || "Standard"}
- Style narratif: ${profileData.styleNarratif || "Direct"}
- Vocabulaire: ${profileData.vocabulaire || "Courant"}
- Signature: ${profileData.signature || "Aucune"}

⚠️ L'email doit sonner comme si cette personne l'avait écrit elle-même.
`;
}

function buildClientContext(client) {
  if (!client) return "";

  return `

=== CONTEXTE CLIENT (Mode Agency) ===
Client: ${client.name}${client.company ? ` (${client.company})` : ''}
${client.industry ? `Secteur: ${client.industry}` : ''}
${client.voice_description ? `Style de voix: ${client.voice_description}` : ''}
${client.tone ? `Ton préféré: ${client.tone}` : ''}
${client.brand_keywords?.length ? `Mots-clés de marque: ${client.brand_keywords.join(', ')}` : ''}
${client.target_audience ? `Cible: ${client.target_audience}` : ''}
${client.main_products ? `Produits/Services: ${client.main_products}` : ''}
${client.unique_value ? `Proposition de valeur: ${client.unique_value}` : ''}

⚠️ Adapte le contenu à l'identité de ce client.
`;
}

function getSequenceRole(index, total) {
  const roles = ['teasing', 'value', 'offer', 'urgency', 'last_call'];
  if (total <= 2) return index === 0 ? 'teasing' : 'offer';
  if (total === 3) return ['teasing', 'offer', 'last_call'][index];
  if (total === 4) return ['teasing', 'value', 'offer', 'last_call'][index];
  return roles[Math.min(index, roles.length - 1)];
}

function getSequenceArc(type, count) {
  const arcs = {
    launch: { name: 'Lancement', flow: 'Teasing → Valeur → Offre → Urgence → Dernier rappel' },
    promo: { name: 'Promo', flow: 'Teasing → Offre → Preuves → Urgence → Dernier rappel' },
    event: { name: 'Événement', flow: 'Annonce → Valeur → Détails → Urgence → Dernier rappel' },
    nurturing: { name: 'Nurturing', flow: 'Valeur → Valeur → Valeur → Offre douce → Valeur' },
    reengagement: { name: 'Réengagement', flow: '"Tu nous manques" → Valeur → Offre spéciale → Urgence' },
    storytelling: { name: 'Storytelling', flow: 'Teaser → Histoire partie 1 → Suite → Révélation → Offre' }
  };
  return arcs[type] || arcs.launch;
}

// ============================================================
// HELPERS - AUTHENTIFICATION
// ============================================================

async function verifySupabaseToken(token, env) {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': env.SUPABASE_SERVICE_KEY
      }
    });

    if (!response.ok) return null;

    const user = await response.json();
    return user;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

async function getClient(clientId, userId, env) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/clients?id=eq.${clientId}&user_id=eq.${userId}`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const clients = await response.json();
  return clients[0] || null;
}

// ============================================================
// LEMON SQUEEZY WEBHOOKS (inchangé)
// ============================================================

async function handleLemonSqueezyWebhook(request, env, corsHeaders) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('X-Signature');

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
  const plan = determinePlanFromProduct(subData.plan_name);

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
  await addContactToBrevo(subData.user_email, subData.user_name, plan, env);
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

  return 'solo';
}

async function upsertUser(userData, env) {
  try {
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
// API REST ENTERPRISE (inchangé)
// ============================================================

async function handleAPIRequest(request, env, corsHeaders) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/v1', '');

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

  let response;
  let tokensUsed = { input: 0, output: 0 };
  let requestMetadata = {};

  try {
    switch (true) {
      case path === '/generate' && request.method === 'POST':
        if (!keyData.permissions?.generate) {
          return jsonResponse({ error: 'Permission denied for generate', code: 'PERMISSION_DENIED' }, 403, corsHeaders);
        }
        const generateResult = await handleAPIGenerate(request, env, keyData);
        response = generateResult.response;
        tokensUsed = generateResult.tokens;
        requestMetadata = generateResult.metadata;
        break;

      case path === '/voices' && request.method === 'GET':
        if (!keyData.permissions?.voices) {
          return jsonResponse({ error: 'Permission denied for voices', code: 'PERMISSION_DENIED' }, 403, corsHeaders);
        }
        response = await handleAPIListVoices(env, keyData);
        break;

      case path.match(/^\/voices\/[\w-]+$/) && request.method === 'GET':
        if (!keyData.permissions?.voices) {
          return jsonResponse({ error: 'Permission denied for voices', code: 'PERMISSION_DENIED' }, 403, corsHeaders);
        }
        const voiceId = path.split('/')[2];
        response = await handleAPIGetVoice(voiceId, env, keyData);
        break;

      case path === '/usage' && request.method === 'GET':
        response = await handleAPIGetUsage(url, env, keyData);
        break;

      case path === '/structures' && request.method === 'GET':
        response = handleAPIListStructures(corsHeaders);
        break;

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

  const latencyMs = Date.now() - startTime;
  logAPIUsage(keyData.id, path, request.method, response.status, tokensUsed, latencyMs, requestMetadata, env);
  updateLastUsed(keyData.id, env);

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

async function handleAPIGenerate(request, env, keyData) {
  const body = await request.json();
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

  let voiceContext = "";
  if (voiceProfileId) {
    const voiceProfile = await getVoiceProfile(voiceProfileId, keyData.user_id, env);
    if (voiceProfile) {
      voiceContext = buildVoiceContext(voiceProfile.profile_data);
    }
  }

  const systemPrompt = buildAPISystemPrompt(structure, format, platform, voiceContext);
  const userPrompt = buildAPIUserPrompt(idea, structure, format, platform);

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

async function handleAPIGetUsage(url, env, keyData) {
  const period = url.searchParams.get('period') || 'month';

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
// VISUALS API - Intégration Orshot
// ============================================================

const ORSHOT_API_BASE = 'https://api.orshot.com/v1';

async function handleVisualsAPI(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/visuals', '');

  // Pas d'authentification requise pour les visuels (outil public)
  // L'utilisateur peut optionnellement s'authentifier pour l'historique

  try {
    switch (true) {
      // POST /api/visuals/generate - Générer un visuel (public)
      case path === '/generate' && request.method === 'POST':
        return await handleGenerateVisual(request, env, null, corsHeaders);

      // GET /api/visuals/templates - Lister les templates disponibles (public)
      case path === '/templates' && request.method === 'GET':
        return await handleListVisualTemplates(url, corsHeaders);

      // GET /api/visuals/history - Historique des visuels générés (auth requise)
      case path === '/history' && request.method === 'GET':
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return jsonResponse({ error: 'Authorization required for history', code: 'UNAUTHORIZED' }, 401, corsHeaders);
        }
        const token = authHeader.replace('Bearer ', '');
        const user = await verifySupabaseToken(token, env);
        if (!user) {
          return jsonResponse({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' }, 401, corsHeaders);
        }
        return await handleVisualHistory(url, env, user, corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found', code: 'NOT_FOUND' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Visuals API Error:', error);
    return jsonResponse({ error: 'Internal server error', code: 'INTERNAL_ERROR', details: error.message }, 500, corsHeaders);
  }
}

// ============ ORSHOT VISUAL TEMPLATES ============
// Templates prédéfinis pour chaque format de contenu

const VISUAL_TEMPLATES = {
  // Post Instagram 1080x1080
  post_instagram: [
    {
      id: 'post_ig_minimal',
      name: 'Minimal',
      description: 'Design épuré avec focus sur le texte',
      preview: 'https://via.placeholder.com/200x200/1a1a2e/ffffff?text=Minimal',
      template_id: 'sos-post-ig-minimal-v1',
      width: 1080,
      height: 1080
    },
    {
      id: 'post_ig_bold',
      name: 'Bold',
      description: 'Design impactant avec couleurs vives',
      preview: 'https://via.placeholder.com/200x200/e94560/ffffff?text=Bold',
      template_id: 'sos-post-ig-bold-v1',
      width: 1080,
      height: 1080
    },
    {
      id: 'post_ig_gradient',
      name: 'Gradient',
      description: 'Fond dégradé moderne',
      preview: 'https://via.placeholder.com/200x200/667eea/ffffff?text=Gradient',
      template_id: 'sos-post-ig-gradient-v1',
      width: 1080,
      height: 1080
    }
  ],

  // Story Instagram 1080x1920
  story_instagram: [
    {
      id: 'story_ig_minimal',
      name: 'Minimal',
      description: 'Story épurée et élégante',
      preview: 'https://via.placeholder.com/112x200/1a1a2e/ffffff?text=Minimal',
      template_id: 'sos-story-ig-minimal-v1',
      width: 1080,
      height: 1920
    },
    {
      id: 'story_ig_bold',
      name: 'Bold',
      description: 'Story percutante',
      preview: 'https://via.placeholder.com/112x200/e94560/ffffff?text=Bold',
      template_id: 'sos-story-ig-bold-v1',
      width: 1080,
      height: 1920
    },
    {
      id: 'story_ig_gradient',
      name: 'Gradient',
      description: 'Story avec dégradé tendance',
      preview: 'https://via.placeholder.com/112x200/764ba2/ffffff?text=Gradient',
      template_id: 'sos-story-ig-gradient-v1',
      width: 1080,
      height: 1920
    }
  ],

  // Carrousel Instagram (5 slides)
  carrousel_instagram: [
    {
      id: 'carrousel_ig_minimal',
      name: 'Minimal',
      description: 'Carrousel épuré et cohérent',
      preview: 'https://via.placeholder.com/200x200/1a1a2e/ffffff?text=Minimal',
      template_id: 'sos-carrousel-ig-minimal-v1',
      width: 1080,
      height: 1080,
      slides: 5
    },
    {
      id: 'carrousel_ig_educatif',
      name: 'Éducatif',
      description: 'Parfait pour les tips et tutoriels',
      preview: 'https://via.placeholder.com/200x200/16a085/ffffff?text=Educatif',
      template_id: 'sos-carrousel-ig-educatif-v1',
      width: 1080,
      height: 1080,
      slides: 5
    }
  ],

  // Post LinkedIn 1200x627
  post_linkedin: [
    {
      id: 'post_li_pro',
      name: 'Professionnel',
      description: 'Design corporate et élégant',
      preview: 'https://via.placeholder.com/200x105/0077b5/ffffff?text=Pro',
      template_id: 'sos-post-li-pro-v1',
      width: 1200,
      height: 627
    },
    {
      id: 'post_li_minimal',
      name: 'Minimal',
      description: 'Simple et efficace',
      preview: 'https://via.placeholder.com/200x105/2d3436/ffffff?text=Minimal',
      template_id: 'sos-post-li-minimal-v1',
      width: 1200,
      height: 627
    }
  ],

  // Citation 1080x1080
  quote: [
    {
      id: 'quote_minimal',
      name: 'Minimal',
      description: 'Citation élégante sur fond uni',
      preview: 'https://via.placeholder.com/200x200/1a1a2e/ffffff?text=Citation',
      template_id: 'sos-quote-minimal-v1',
      width: 1080,
      height: 1080
    },
    {
      id: 'quote_bold',
      name: 'Bold',
      description: 'Citation impactante',
      preview: 'https://via.placeholder.com/200x200/e94560/ffffff?text=Citation',
      template_id: 'sos-quote-bold-v1',
      width: 1080,
      height: 1080
    }
  ]
};

// Mapping des formats content_type vers les dimensions
const FORMAT_DIMENSIONS = {
  'post_instagram': { width: 1080, height: 1080, name: 'Post Instagram' },
  'story_instagram': { width: 1080, height: 1920, name: 'Story Instagram' },
  'carrousel_instagram': { width: 1080, height: 1080, name: 'Carrousel Instagram', slides: 5 },
  'post_linkedin': { width: 1200, height: 627, name: 'Post LinkedIn' },
  'quote': { width: 1080, height: 1080, name: 'Citation' }
};

// ============ ORSHOT API FUNCTIONS ============

// POST /api/visuals/generate - Générer un visuel via Orshot (mode prompt)
async function handleGenerateVisual(request, env, user, corsHeaders) {
  const body = await request.json();
  const { content_type, content_data, style = 'modern' } = body;

  // Validation
  if (!content_data || !content_data.text) {
    return jsonResponse({
      error: 'Missing required fields',
      code: 'VALIDATION_ERROR',
      required: ['content_data.text']
    }, 400, corsHeaders);
  }

  // Vérifier la clé API Orshot
  if (!env.ORSHOT_API_KEY) {
    return jsonResponse({
      error: 'Orshot API not configured',
      code: 'CONFIG_ERROR'
    }, 500, corsHeaders);
  }

  try {
    // Construire le prompt pour Orshot
    const visualType = content_type || 'quote';
    const text = content_data.text || content_data.quote || '';
    const author = content_data.author || '';

    let prompt = '';
    if (visualType === 'quote') {
      prompt = `Create a beautiful minimalist social media quote image. The quote is: "${text.substring(0, 200)}". ${author ? `By ${author}.` : ''} Style: clean, modern, professional, suitable for LinkedIn or Instagram. Use elegant typography on a subtle gradient background.`;
    } else if (visualType === 'carrousel_instagram' || visualType === 'carousel') {
      prompt = `Create a professional carousel slide for Instagram. Main text: "${text.substring(0, 150)}". Style: modern, clean, with bold typography. Colors: professional gradient background.`;
    } else {
      prompt = `Create a professional social media post image. Content: "${text.substring(0, 200)}". Style: modern, minimalist, eye-catching. Perfect for Instagram or LinkedIn.`;
    }

    // Appeler l'API Orshot avec un prompt
    const orshotResponse = await fetch(`${ORSHOT_API_BASE}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.ORSHOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'url'
      })
    });

    if (!orshotResponse.ok) {
      const errorData = await orshotResponse.json().catch(() => ({}));
      console.error('Orshot API error:', errorData);

      // Si Orshot ne supporte pas ce format, essayer un autre endpoint
      return jsonResponse({
        error: 'Failed to generate visual',
        code: 'ORSHOT_ERROR',
        details: errorData.error?.message || errorData.message || orshotResponse.statusText
      }, orshotResponse.status, corsHeaders);
    }

    const orshotData = await orshotResponse.json();
    const imageUrl = orshotData.data?.[0]?.url || orshotData.url || orshotData.image_url;

    if (!imageUrl) {
      return jsonResponse({
        error: 'No image URL in response',
        code: 'NO_IMAGE'
      }, 500, corsHeaders);
    }

    return jsonResponse({
      success: true,
      image_url: imageUrl,
      content_type: visualType,
      prompt_used: prompt
    }, 200, corsHeaders);

  } catch (error) {
    console.error('Visual generation error:', error);
    return jsonResponse({
      error: 'Internal error during generation',
      code: 'INTERNAL_ERROR',
      details: error.message
    }, 500, corsHeaders);
  }
}


// GET /api/visuals/templates - Lister les templates disponibles
async function handleListVisualTemplates(url, corsHeaders) {
  const contentType = url.searchParams.get('content_type');

  if (contentType) {
    const templates = VISUAL_TEMPLATES[contentType];
    if (!templates) {
      return jsonResponse({
        error: 'Invalid content_type',
        code: 'INVALID_FORMAT',
        valid_formats: Object.keys(VISUAL_TEMPLATES)
      }, 400, corsHeaders);
    }

    return jsonResponse({
      content_type: contentType,
      format: FORMAT_DIMENSIONS[contentType],
      templates
    }, 200, corsHeaders);
  }

  // Retourner tous les templates par format
  const allTemplates = {};
  for (const [type, templates] of Object.entries(VISUAL_TEMPLATES)) {
    allTemplates[type] = {
      format: FORMAT_DIMENSIONS[type],
      templates
    };
  }

  return jsonResponse({
    formats: Object.keys(VISUAL_TEMPLATES),
    templates: allTemplates
  }, 200, corsHeaders);
}

// GET /api/visuals/history - Historique des visuels générés
async function handleVisualHistory(url, env, user, corsHeaders) {
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const contentType = url.searchParams.get('content_type');

  let queryUrl = `${env.SUPABASE_URL}/rest/v1/visual_history?user_id=eq.${user.id}&order=created_at.desc&limit=${limit}&offset=${offset}`;

  if (contentType) {
    queryUrl += `&content_type=eq.${contentType}`;
  }

  const response = await fetch(queryUrl, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
    }
  });

  if (!response.ok) {
    // Table might not exist yet, return empty array
    return jsonResponse({
      visuals: [],
      total: 0,
      limit,
      offset
    }, 200, corsHeaders);
  }

  const visuals = await response.json();

  // Get total count
  const countResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/visual_history?user_id=eq.${user.id}&select=count`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'count=exact'
      }
    }
  );

  const total = parseInt(countResponse.headers.get('content-range')?.split('/')[1] || '0');

  return jsonResponse({
    visuals,
    total,
    limit,
    offset
  }, 200, corsHeaders);
}

// GET /api/visuals/:id - Détail d'un visuel
async function handleGetVisual(visualId, env, user, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/visual_history?id=eq.${visualId}&user_id=eq.${user.id}`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!response.ok) {
    return jsonResponse({
      error: 'Visual not found',
      code: 'NOT_FOUND'
    }, 404, corsHeaders);
  }

  const visuals = await response.json();
  if (visuals.length === 0) {
    return jsonResponse({
      error: 'Visual not found',
      code: 'NOT_FOUND'
    }, 404, corsHeaders);
  }

  return jsonResponse({ visual: visuals[0] }, 200, corsHeaders);
}

// ============ ORSHOT HELPER FUNCTIONS ============

// Construire le payload pour l'API Orshot
function buildOrshotPayload(contentType, template, contentData, outputFormat) {
  // Structure de base pour Orshot
  const payload = {
    template_id: template.template_id,
    output: {
      format: outputFormat,
      width: template.width,
      height: template.height
    },
    variables: {}
  };

  // Mapper les données de contenu vers les variables du template
  if (contentData.titre) {
    payload.variables.title = contentData.titre;
    payload.variables.titre = contentData.titre;
  }
  if (contentData.accroche) {
    payload.variables.hook = contentData.accroche;
    payload.variables.accroche = contentData.accroche;
    payload.variables.subtitle = contentData.accroche;
  }
  if (contentData.cta) {
    payload.variables.cta = contentData.cta;
    payload.variables.call_to_action = contentData.cta;
  }
  if (contentData.citation) {
    payload.variables.quote = contentData.citation;
    payload.variables.citation = contentData.citation;
  }
  if (contentData.auteur) {
    payload.variables.author = contentData.auteur;
    payload.variables.auteur = contentData.auteur;
  }
  if (contentData.signature) {
    payload.variables.signature = contentData.signature;
  }

  // Points pour carrousels
  if (contentData.points && Array.isArray(contentData.points)) {
    contentData.points.forEach((point, index) => {
      payload.variables[`point_${index + 1}`] = point;
      payload.variables[`bullet_${index + 1}`] = point;
    });
    payload.variables.points = contentData.points.join('\n');
  }

  // Corps de texte
  if (contentData.corps) {
    payload.variables.body = contentData.corps;
    payload.variables.content = contentData.corps;
  }

  // Style personnalisé
  if (contentData.couleur_principale) {
    payload.variables.primary_color = contentData.couleur_principale;
  }
  if (contentData.couleur_secondaire) {
    payload.variables.secondary_color = contentData.couleur_secondaire;
  }

  return payload;
}

// Sauvegarder un visuel dans l'historique
async function saveVisualToHistory(visualData, env) {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/visual_history`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        user_id: visualData.user_id,
        content_type: visualData.content_type,
        template_id: visualData.template_id,
        template_name: visualData.template_name,
        content_data: visualData.content_data,
        image_url: visualData.image_url,
        width: visualData.width,
        height: visualData.height,
        format: visualData.format,
        created_at: new Date().toISOString()
      })
    });

    if (response.ok) {
      const saved = await response.json();
      return saved[0];
    }
    return null;
  } catch (error) {
    console.error('Failed to save visual history:', error);
    return null;
  }
}

// ============================================================
// FRONTEND REQUEST (inchangé)
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
          console.log("Fallback vers Claude...");
        } else {
          const data = await response.json();

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
      }
    }

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
    const brevoPlan = mapPlanToBrevo(plan);

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
        listIds: [3],
        updateEnabled: true
      })
    });

    if (response.ok) {
      console.log('✅ Contact ajouté à Brevo:', email, '- Plan:', brevoPlan);
    } else {
      const errorData = await response.json();
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

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');

  const isAdmin = await verifyAdminToken(token, env);
  if (!isAdmin) {
    return jsonResponse({ error: 'Admin access required' }, 403, corsHeaders);
  }

  try {
    switch (true) {
      case path === '/stats' && request.method === 'GET':
        return await handleAdminStats(env, corsHeaders);

      case path === '/users' && request.method === 'GET':
        return await handleAdminListUsers(url, env, corsHeaders);

      case path.match(/^\/users\/[^/]+$/) && request.method === 'GET':
        const email = decodeURIComponent(path.split('/')[2]);
        return await handleAdminGetUser(email, env, corsHeaders);

      case path.match(/^\/users\/[^/]+$/) && request.method === 'PATCH':
        const emailToUpdate = decodeURIComponent(path.split('/')[2]);
        return await handleAdminUpdateUser(emailToUpdate, request, env, corsHeaders);

      case path === '/events' && request.method === 'GET':
        return await handleAdminListEvents(url, env, corsHeaders);

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
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': env.SUPABASE_SERVICE_KEY
      }
    });

    if (!response.ok) return false;

    const user = await response.json();

    const adminEmails = ['sandra@myinnerquest.fr', 'admin@myinnerquest.fr'];

    return adminEmails.includes(user.email?.toLowerCase());
  } catch (error) {
    console.error('Admin verification error:', error);
    return false;
  }
}

async function handleAdminStats(env, corsHeaders) {
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
    trials_expiring_soon: 0,
    new_users_today: 0,
    new_users_this_week: 0,
    new_users_this_month: 0,
    recent_events: events.slice(0, 20)
  };

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  users.forEach(user => {
    stats.users_by_plan[user.plan || 'free'] = (stats.users_by_plan[user.plan || 'free'] || 0) + 1;
    stats.users_by_status[user.subscription_status || 'none'] = (stats.users_by_status[user.subscription_status || 'none'] || 0) + 1;

    if (user.subscription_status === 'on_trial' && user.trial_ends_at) {
      const trialEnd = new Date(user.trial_ends_at);
      if (trialEnd > now) {
        stats.trials_active++;
        const daysLeft = (trialEnd - now) / (1000 * 60 * 60 * 24);
        if (daysLeft <= 3) {
          stats.trials_expiring_soon++;
        }
      }
    }

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
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/users?subscription_status=eq.active&select=plan`, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
    }
  });

  const activeUsers = await response.json();

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
