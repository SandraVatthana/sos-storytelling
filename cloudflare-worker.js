// cloudflare-worker-v10-extension.js
// Version avec Sequences Email + Extension Chrome LinkedIn Sales Navigator
// Variables d'environnement requises:
// - ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, BREVO_API_KEY

// ============ CORS CONFIGURATION ============
const ALLOWED_ORIGINS = [
  'https://sos-storytelling.netlify.app',
  'https://sosstorytelling.fr',
  'https://www.sosstorytelling.fr',
  // Dev/test (à retirer en prod si besoin)
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5500',
  'null' // Pour tests locaux en file:// - À RETIRER EN PROD
];

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';

  // Vérifier si l'origine est autorisée
  let allowedOrigin = '';

  if (ALLOWED_ORIGINS.includes(origin)) {
    allowedOrigin = origin;
  } else if (origin.startsWith('chrome-extension://')) {
    // Autoriser les extensions Chrome
    allowedOrigin = origin;
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // ============ EXTENSION API (NEW - v10) ============
    if (url.pathname.startsWith('/api/extension')) {
      return handleExtensionAPI(request, env, corsHeaders);
    }

    // ============ CRON ENDPOINT (appele toutes les 15 min) ============
    if (url.pathname === '/cron/process-sequences' && request.method === 'POST') {
      return handleProcessSequences(request, env, corsHeaders);
    }

    // ============ WEBHOOKS ============
    if (url.pathname === '/webhook/brevo' && request.method === 'POST') {
      return handleBrevoWebhookEnhanced(request, env, corsHeaders);
    }

    if (url.pathname === '/webhook/lemonsqueezy' && request.method === 'POST') {
      return handleLemonSqueezyWebhook(request, env, corsHeaders);
    }

    // ============ SUBSCRIPTION API ============
    if (url.pathname === '/api/subscription' && request.method === 'GET') {
      return handleSubscriptionCheck(request, env, corsHeaders);
    }

    // ============ UNSUBSCRIBE PAGE ============
    if (url.pathname === '/unsubscribe' && request.method === 'GET') {
      return handleUnsubscribePage(request, env, corsHeaders);
    }

    if (url.pathname === '/unsubscribe' && request.method === 'POST') {
      return handleUnsubscribeAction(request, env, corsHeaders);
    }

    // ============ CAMPAIGNS API (avec sequences) ============
    if (url.pathname.startsWith('/api/campaigns')) {
      return handleCampaignsAPIv2(request, env, corsHeaders);
    }

    // ============ PROSPECTS API ============
    if (url.pathname.startsWith('/api/prospects')) {
      return handleProspectsAPI(request, env, corsHeaders);
    }

    // ============ NEWSLETTERS API ============
    if (url.pathname.startsWith('/api/newsletters')) {
      return handleNewslettersAPI(request, env, corsHeaders);
    }

    // ============ COLLABORATION APIs ============
    if (url.pathname.startsWith('/api/workspaces')) {
      return handleWorkspacesAPI(request, env, corsHeaders);
    }

    if (url.pathname.startsWith('/api/invitations')) {
      return handleInvitationsAPI(request, env, corsHeaders);
    }

    if (url.pathname.startsWith('/api/comments')) {
      return handleCommentsAPI(request, env, corsHeaders);
    }

    if (url.pathname.startsWith('/api/notifications')) {
      return handleNotificationsAPI(request, env, corsHeaders);
    }

    // ============ SENDER EMAILS API (Multi-adresses) ============
    if (url.pathname.startsWith('/api/sender-emails')) {
      return handleSenderEmailsAPI(request, env, corsHeaders);
    }

    // ============ BLACKLIST API ============
    if (url.pathname.startsWith('/api/blacklist')) {
      return handleBlacklistAPI(request, env, corsHeaders);
    }

    // ============ PREFLIGHT CHECKS API ============
    if (url.pathname.startsWith('/api/preflight')) {
      return handlePreflightAPI(request, env, corsHeaders);
    }

    // ============ DNS CHECK API ============
    if (url.pathname.startsWith('/api/domains')) {
      return handleDomainsAPI(request, env, corsHeaders);
    }

    // ============ EMAIL VERIFICATION API (MillionVerifier) ============
    if (url.pathname.startsWith('/api/email-verify')) {
      return handleEmailVerifyAPI(request, env, corsHeaders);
    }

    // ============ CHATBOT AI ASSISTANT ============
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChatAssistant(request, env, corsHeaders);
    }

    // ============ SPINTAX GENERATOR ============
    if (url.pathname === '/api/spintax' && request.method === 'POST') {
      return handleSpintaxGenerator(request, env, corsHeaders);
    }

    // ============ VISUAL AUDIT (Claude Vision) ============
    if (url.pathname === '/audit-visual' && request.method === 'POST') {
      return handleVisualAudit(request, env, corsHeaders);
    }

    // ============ VIDEO AUDIT (Google Gemini) ============
    if (url.pathname === '/audit-video' && request.method === 'POST') {
      return handleVideoAudit(request, env, corsHeaders);
    }

    // ============ FRONTEND (AI calls - Claude & Perplexity) ============
    return handleFrontendRequest(request, env, corsHeaders);
  },

  // Scheduled trigger pour Cloudflare Workers
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processSequenceEmails(env));
  }
};

// ============================================================
// EXTENSION API - Import depuis LinkedIn Sales Navigator (NEW v10)
// ============================================================

async function handleExtensionAPI(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/extension', '');

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);
  if (!user) return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);

  try {
    switch (true) {
      // Import leads from extension
      case path === '/import' && request.method === 'POST':
        return await handleExtensionImport(request, env, user, corsHeaders);

      // Get campaigns for extension dropdown
      case path === '/campaigns' && request.method === 'GET':
        return await handleExtensionCampaigns(url, env, user, corsHeaders);

      // Check connection status
      case path === '/status' && request.method === 'GET':
        return jsonResponse({
          success: true,
          user: { id: user.id, email: user.email },
          version: '1.0.0'
        }, 200, corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Extension API Error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

// Import leads from LinkedIn Sales Navigator extension
async function handleExtensionImport(request, env, user, corsHeaders) {
  const body = await request.json();
  const { leads, campaign_id, source = 'linkedin_extension' } = body;

  if (!leads || !Array.isArray(leads)) {
    return jsonResponse({ error: 'Missing leads array' }, 400, corsHeaders);
  }

  if (leads.length === 0) {
    return jsonResponse({ error: 'No leads to import' }, 400, corsHeaders);
  }

  if (leads.length > 100) {
    return jsonResponse({ error: 'Maximum 100 leads per import' }, 400, corsHeaders);
  }

  // Get existing prospects to check for duplicates (by linkedin_url)
  const linkedinUrls = leads
    .filter(l => l.linkedin_url)
    .map(l => l.linkedin_url.toLowerCase());

  let existingUrls = new Set();
  if (linkedinUrls.length > 0) {
    const existingRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/prospects?user_id=eq.${user.id}&linkedin_url=in.(${linkedinUrls.map(u => `"${u}"`).join(',')})&select=linkedin_url`,
      { headers: supabaseHeaders(env) }
    );
    const existingProspects = await existingRes.json();
    existingUrls = new Set(existingProspects.map(p => p.linkedin_url?.toLowerCase()));
  }

  // Filter out duplicates and prepare for insert
  const newLeads = [];
  const duplicates = [];

  for (const lead of leads) {
    // Skip if linkedin_url already exists
    if (lead.linkedin_url && existingUrls.has(lead.linkedin_url.toLowerCase())) {
      duplicates.push(lead);
      continue;
    }

    // Skip if no meaningful data
    if (!lead.first_name && !lead.last_name && !lead.linkedin_url) {
      continue;
    }

    // Generate email placeholder if not provided
    let email = lead.email;
    if (!email || email.includes('.placeholder')) {
      email = generateUniqueEmail(lead, user.id);
    }

    newLeads.push({
      user_id: user.id,
      email: email.toLowerCase(),
      first_name: lead.first_name || null,
      last_name: lead.last_name || null,
      company: lead.company || null,
      job_title: lead.job_title || null,
      linkedin_url: lead.linkedin_url || null,
      city: lead.location || lead.city || null,
      source: source,
      status: 'new',
      tags: ['linkedin', 'extension'],
      notes: `Importe via extension le ${new Date().toLocaleDateString('fr-FR')}`
    });
  }

  let imported = 0;

  if (newLeads.length > 0) {
    // Batch insert (Supabase handles upsert with ON CONFLICT)
    const insertRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/prospects`,
      {
        method: 'POST',
        headers: {
          ...supabaseHeaders(env),
          'Prefer': 'return=representation,resolution=ignore-duplicates'
        },
        body: JSON.stringify(newLeads)
      }
    );

    if (!insertRes.ok) {
      const errorText = await insertRes.text();
      console.error('Insert error:', errorText);
      return jsonResponse({ error: 'Failed to insert prospects' }, 500, corsHeaders);
    }

    const insertedProspects = await insertRes.json();
    imported = insertedProspects.length;

    // If campaign_id provided, link prospects to campaign
    if (campaign_id && insertedProspects.length > 0) {
      // Update campaign total_prospects count
      const campaignRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign_id}&user_id=eq.${user.id}`,
        { headers: supabaseHeaders(env) }
      );
      const campaigns = await campaignRes.json();

      if (campaigns[0]) {
        await fetch(
          `${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign_id}`,
          {
            method: 'PATCH',
            headers: supabaseHeaders(env),
            body: JSON.stringify({
              total_prospects: (campaigns[0].total_prospects || 0) + imported,
              updated_at: new Date().toISOString()
            })
          }
        );
      }
    }
  }

  // Log import event (optional - table might not exist)
  try {
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/import_events`,
      {
        method: 'POST',
        headers: supabaseHeaders(env),
        body: JSON.stringify({
          user_id: user.id,
          source: source,
          total_leads: leads.length,
          imported_leads: imported,
          duplicate_leads: duplicates.length,
          campaign_id: campaign_id || null,
          created_at: new Date().toISOString()
        })
      }
    );
  } catch (e) {
    // Non-blocking, table might not exist
    console.log('Import event logging skipped:', e.message);
  }

  return jsonResponse({
    success: true,
    imported,
    duplicates: duplicates.length,
    total_processed: leads.length,
    message: imported > 0
      ? `${imported} prospect(s) importe(s) avec succes`
      : 'Aucun nouveau prospect importe (tous en double)'
  }, 200, corsHeaders);
}

// Generate unique email for LinkedIn prospects without email
function generateUniqueEmail(lead, userId) {
  const firstName = (lead.first_name || 'unknown').toLowerCase().replace(/[^a-z]/g, '');
  const lastName = (lead.last_name || '').toLowerCase().replace(/[^a-z]/g, '');

  // Extract LinkedIn ID from URL
  let linkedinId = '';
  if (lead.linkedin_url) {
    const match = lead.linkedin_url.match(/\/in\/([^\/]+)/);
    if (match) {
      linkedinId = match[1].replace(/[^a-z0-9-]/g, '').slice(0, 20);
    }
  }

  // Use timestamp for uniqueness if no LinkedIn ID
  const uniquePart = linkedinId || Date.now().toString(36);

  return `${firstName}${lastName ? '.' + lastName : ''}.${uniquePart}@linkedin.enrichment.pending`;
}

// Get campaigns for extension dropdown
async function handleExtensionCampaigns(url, env, user, corsHeaders) {
  const limit = parseInt(url.searchParams.get('limit') || '20');

  // Get draft and sending campaigns
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/email_campaigns?user_id=eq.${user.id}&status=in.(draft,sending)&order=updated_at.desc&limit=${limit}&select=id,name,status,total_prospects`,
    { headers: supabaseHeaders(env) }
  );

  const campaigns = await response.json();

  return jsonResponse({
    success: true,
    campaigns: campaigns.map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      prospects_count: c.total_prospects || 0
    }))
  }, 200, corsHeaders);
}

// ============================================================
// CAMPAIGNS API v2 - Avec support Sequences
// ============================================================

async function handleCampaignsAPIv2(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/campaigns', '');

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);
  if (!user) return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);

  try {
    switch (true) {
      // Sequences
      case path.match(/^\/[a-f0-9-]+\/sequence$/) && request.method === 'GET':
        return await handleGetSequence(path.replace('/sequence', '').slice(1), env, user, corsHeaders);

      case path.match(/^\/[a-f0-9-]+\/sequence$/) && request.method === 'PUT':
        return await handleSaveSequence(path.replace('/sequence', '').slice(1), request, env, user, corsHeaders);

      case path.match(/^\/[a-f0-9-]+\/sequence\/generate$/) && request.method === 'POST':
        return await handleGenerateSequenceEmails(path.replace('/sequence/generate', '').slice(1), request, env, user, corsHeaders);

      // Lancer campagne avec sequence
      case path.match(/^\/[a-f0-9-]+\/start$/) && request.method === 'POST':
        return await handleStartCampaignSequence(path.replace('/start', '').slice(1), request, env, user, corsHeaders);

      // Pause/Resume campagne
      case path.match(/^\/[a-f0-9-]+\/pause$/) && request.method === 'POST':
        return await handlePauseCampaign(path.replace('/pause', '').slice(1), env, user, corsHeaders);

      case path.match(/^\/[a-f0-9-]+\/resume$/) && request.method === 'POST':
        return await handleResumeCampaign(path.replace('/resume', '').slice(1), env, user, corsHeaders);

      // Statut prospects dans la sequence
      case path.match(/^\/[a-f0-9-]+\/prospects-status$/) && request.method === 'GET':
        return await handleGetProspectsStatus(path.replace('/prospects-status', '').slice(1), url, env, user, corsHeaders);

      // Check sending limits
      case path === '/check-limits' && request.method === 'GET':
        return await handleCheckSendingLimits(env, user, corsHeaders);

      // Generation email (existant)
      case path === '/generate-email' && request.method === 'POST':
        return await handleGenerateProspectEmail(request, env, user, corsHeaders);

      // Autres routes existantes de v8...
      case path === '' && request.method === 'GET':
        return await handleListCampaigns(url, env, user, corsHeaders);

      case path === '' && request.method === 'POST':
        return await handleCreateCampaignV2(request, env, user, corsHeaders);

      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'GET':
        return await handleGetCampaign(path.slice(1), env, user, corsHeaders);

      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'PUT':
        return await handleUpdateCampaignV2(path.slice(1), request, env, user, corsHeaders);

      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'DELETE':
        return await handleDeleteCampaign(path.slice(1), env, user, corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Campaigns API Error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

// ============================================================
// SEQUENCE MANAGEMENT
// ============================================================

async function handleGetSequence(campaignId, env, user, corsHeaders) {
  // Verifier ownership
  const campaign = await getCampaignIfOwner(campaignId, user.id, env);
  if (!campaign) return jsonResponse({ error: 'Campaign not found' }, 404, corsHeaders);

  // Recuperer les emails de sequence
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/campaign_sequence_emails?campaign_id=eq.${campaignId}&order=position.asc`,
    { headers: supabaseHeaders(env) }
  );
  const emails = await response.json();

  return jsonResponse({ success: true, sequence: emails }, 200, corsHeaders);
}

async function handleSaveSequence(campaignId, request, env, user, corsHeaders) {
  const campaign = await getCampaignIfOwner(campaignId, user.id, env);
  if (!campaign) return jsonResponse({ error: 'Campaign not found' }, 404, corsHeaders);

  const body = await request.json();
  const { emails } = body; // [{position, delay_days, send_condition, subject_template, body_template, use_ai_generation}]

  if (!emails || !Array.isArray(emails)) {
    return jsonResponse({ error: 'Missing emails array' }, 400, corsHeaders);
  }

  // Supprimer les anciens emails de sequence
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/campaign_sequence_emails?campaign_id=eq.${campaignId}`,
    { method: 'DELETE', headers: supabaseHeaders(env) }
  );

  // Inserer les nouveaux
  const toInsert = emails.map((e, i) => ({
    campaign_id: campaignId,
    position: e.position || i + 1,
    delay_days: e.delay_days || 0,
    send_condition: e.send_condition || 'no_reply',
    subject_template: e.subject_template,
    body_template: e.body_template,
    use_ai_generation: e.use_ai_generation || false
  }));

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/campaign_sequence_emails`,
    {
      method: 'POST',
      headers: { ...supabaseHeaders(env), 'Prefer': 'return=representation' },
      body: JSON.stringify(toInsert)
    }
  );

  const saved = await response.json();
  return jsonResponse({ success: true, sequence: saved }, 200, corsHeaders);
}

async function handleGenerateSequenceEmails(campaignId, request, env, user, corsHeaders) {
  const campaign = await getCampaignIfOwner(campaignId, user.id, env);
  if (!campaign) return jsonResponse({ error: 'Campaign not found' }, 404, corsHeaders);

  const body = await request.json();
  const { num_emails = 3, delays = [0, 3, 7] } = body;

  const emails = [];
  for (let i = 0; i < num_emails; i++) {
    const position = i + 1;
    const isFollowUp = position > 1;

    const prompt = buildSequenceEmailPrompt({
      position,
      isFollowUp,
      campaignGoal: campaign.goal,
      language: campaign.language || 'fr'
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
        max_tokens: 1000,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (claudeResponse.ok) {
      const data = await claudeResponse.json();
      const content = data.content[0].text;
      try {
        const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || '{}');
        emails.push({
          position,
          delay_days: delays[i] || i * 3,
          send_condition: 'no_reply',
          subject_template: parsed.subject || `Email ${position}`,
          body_template: parsed.body || content,
          use_ai_generation: false
        });
      } catch (e) {
        emails.push({
          position,
          delay_days: delays[i] || i * 3,
          send_condition: 'no_reply',
          subject_template: `Email ${position}`,
          body_template: content,
          use_ai_generation: false
        });
      }
    }
  }

  return jsonResponse({ success: true, generated_emails: emails }, 200, corsHeaders);
}

function buildSequenceEmailPrompt({ position, isFollowUp, campaignGoal, language }) {
  const langInstr = language === 'en'
    ? 'Write in English. Be direct and professional.'
    : 'Ecris en francais. Ton chaleureux et professionnel.';

  const context = isFollowUp
    ? `C'est l'email de RELANCE numero ${position}. Tu n'as pas eu de reponse au precedent email.`
    : `C'est le PREMIER email de contact.`;

  return `Tu es expert en cold emailing.
${langInstr}

OBJECTIF CAMPAGNE: ${campaignGoal}
${context}

REGLES:
- Email court (max 100 mots)
- Variables disponibles: {first_name}, {company}, {job_title}
- Pas de lien
- Question ouverte a la fin
${isFollowUp ? '- Faire reference au mail precedent sans etre lourd' : ''}
- Si relance: objet style "Re: [objet precedent]" ou variation subtile

FORMAT JSON:
{"subject": "...", "body": "..."}`;
}

// ============================================================
// START CAMPAIGN WITH SEQUENCE
// ============================================================

async function handleStartCampaignSequence(campaignId, request, env, user, corsHeaders) {
  const campaign = await getCampaignIfOwner(campaignId, user.id, env);
  if (!campaign) return jsonResponse({ error: 'Campaign not found' }, 404, corsHeaders);

  if (campaign.status !== 'draft') {
    return jsonResponse({ error: 'Campaign already started' }, 400, corsHeaders);
  }

  const body = await request.json();
  const { prospect_ids, scheduled_at, send_weekdays_only = true, send_hours_start = 9, send_hours_end = 18 } = body;

  // Recuperer la sequence
  const seqRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/campaign_sequence_emails?campaign_id=eq.${campaignId}&order=position.asc`,
    { headers: supabaseHeaders(env) }
  );
  const sequence = await seqRes.json();

  if (!sequence || sequence.length === 0) {
    return jsonResponse({ error: 'No sequence emails defined' }, 400, corsHeaders);
  }

  // Recuperer les prospects
  let prospectsQuery = `${env.SUPABASE_URL}/rest/v1/prospects?user_id=eq.${user.id}`;
  if (prospect_ids && prospect_ids.length > 0) {
    prospectsQuery += `&id=in.(${prospect_ids.join(',')})`;
  } else if (campaign.prospect_filter) {
    const filter = campaign.prospect_filter;
    if (filter.status && filter.status !== 'all') {
      prospectsQuery += `&status=eq.${filter.status}`;
    }
  }

  const prospectsRes = await fetch(prospectsQuery, { headers: supabaseHeaders(env) });
  const prospects = await prospectsRes.json();

  if (prospects.length === 0) {
    return jsonResponse({ error: 'No prospects to contact' }, 400, corsHeaders);
  }

  // Verifier les desabonnements
  const blacklistRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/email_unsubscribes?user_id=eq.${user.id}&select=email`,
    { headers: supabaseHeaders(env) }
  );
  const blacklist = (await blacklistRes.json()).map(b => b.email.toLowerCase());
  const validProspects = prospects.filter(p => !blacklist.includes(p.email.toLowerCase()));

  // Calculer le moment du premier envoi
  const startTime = scheduled_at ? new Date(scheduled_at) : new Date();

  // Creer les statuts pour chaque prospect
  const statusRecords = validProspects.map(p => ({
    campaign_id: campaignId,
    prospect_id: p.id,
    user_id: user.id,
    current_step: 0,
    status: 'pending',
    next_email_at: startTime.toISOString(),
    emails_history: []
  }));

  await fetch(
    `${env.SUPABASE_URL}/rest/v1/campaign_prospect_status`,
    {
      method: 'POST',
      headers: { ...supabaseHeaders(env), 'Prefer': 'return=minimal' },
      body: JSON.stringify(statusRecords)
    }
  );

  // Mettre a jour la campagne
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaignId}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(env),
      body: JSON.stringify({
        status: 'sending',
        total_prospects: validProspects.length,
        send_weekdays_only,
        send_hours_start,
        send_hours_end,
        scheduled_at: scheduled_at || null,
        started_at: new Date().toISOString()
      })
    }
  );

  return jsonResponse({
    success: true,
    message: 'Campaign started',
    prospects_count: validProspects.length,
    sequence_emails: sequence.length,
    first_send_at: startTime.toISOString()
  }, 200, corsHeaders);
}

// ============================================================
// PAUSE / RESUME CAMPAIGN
// ============================================================

async function handlePauseCampaign(campaignId, env, user, corsHeaders) {
  const campaign = await getCampaignIfOwner(campaignId, user.id, env);
  if (!campaign) return jsonResponse({ error: 'Campaign not found' }, 404, corsHeaders);

  if (campaign.status !== 'sending') {
    return jsonResponse({ error: 'Campaign is not running' }, 400, corsHeaders);
  }

  await fetch(
    `${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaignId}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(env),
      body: JSON.stringify({ status: 'paused', updated_at: new Date().toISOString() })
    }
  );

  return jsonResponse({ success: true, message: 'Campaign paused' }, 200, corsHeaders);
}

async function handleResumeCampaign(campaignId, env, user, corsHeaders) {
  const campaign = await getCampaignIfOwner(campaignId, user.id, env);
  if (!campaign) return jsonResponse({ error: 'Campaign not found' }, 404, corsHeaders);

  if (campaign.status !== 'paused') {
    return jsonResponse({ error: 'Campaign is not paused' }, 400, corsHeaders);
  }

  await fetch(
    `${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaignId}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(env),
      body: JSON.stringify({ status: 'sending', updated_at: new Date().toISOString() })
    }
  );

  return jsonResponse({ success: true, message: 'Campaign resumed' }, 200, corsHeaders);
}

// ============================================================
// GET PROSPECTS STATUS IN SEQUENCE
// ============================================================

async function handleGetProspectsStatus(campaignId, url, env, user, corsHeaders) {
  const campaign = await getCampaignIfOwner(campaignId, user.id, env);
  if (!campaign) return jsonResponse({ error: 'Campaign not found' }, 404, corsHeaders);

  const status = url.searchParams.get('status');
  let query = `${env.SUPABASE_URL}/rest/v1/campaign_prospect_status?campaign_id=eq.${campaignId}&select=*,prospects(first_name,last_name,email,company)&order=updated_at.desc`;

  if (status) query += `&status=eq.${status}`;

  const response = await fetch(query, { headers: supabaseHeaders(env) });
  const data = await response.json();

  // Stats
  const stats = { total: data.length, pending: 0, in_sequence: 0, replied: 0, completed: 0, stopped: 0 };
  data.forEach(d => { if (stats[d.status] !== undefined) stats[d.status]++; });

  return jsonResponse({ success: true, prospects: data, stats }, 200, corsHeaders);
}

// ============================================================
// CHECK SENDING LIMITS
// ============================================================

async function handleCheckSendingLimits(env, user, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/rpc/check_sending_limits`,
    {
      method: 'POST',
      headers: supabaseHeaders(env),
      body: JSON.stringify({ p_user_id: user.id })
    }
  );

  const result = await response.json();
  return jsonResponse({ success: true, limits: result[0] || { can_send: true, daily_remaining: 200, hourly_remaining: 50 } }, 200, corsHeaders);
}

// ============================================================
// CRON: PROCESS SEQUENCE EMAILS
// ============================================================

async function handleProcessSequences(request, env, corsHeaders) {
  // Optionnel: verifier un secret pour securiser
  const secret = request.headers.get('X-Cron-Secret');
  if (env.CRON_SECRET && secret !== env.CRON_SECRET) {
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const result = await processSequenceEmails(env);
  return jsonResponse(result, 200, corsHeaders);
}

async function processSequenceEmails(env) {
  console.log('Processing sequence emails...');

  const now = new Date();
  const currentHour = now.getUTCHours(); // Ajuster selon timezone si besoin

  // Recuperer les prospects qui doivent recevoir un email
  const pendingRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/campaign_prospect_status?status=in.(pending,in_sequence)&next_email_at=lte.${now.toISOString()}&select=*,prospects(*),email_campaigns(*)&limit=50`,
    { headers: supabaseHeaders(env) }
  );
  const pending = await pendingRes.json();

  console.log(`Found ${pending.length} prospects to process`);

  let sent = 0, skipped = 0, errors = 0;

  for (const item of pending) {
    const { prospects: prospect, email_campaigns: campaign } = item;

    if (!prospect || !campaign || campaign.status !== 'sending') {
      skipped++;
      continue;
    }

    // Verifier contraintes horaires (en UTC, ajuster si besoin)
    if (campaign.send_weekdays_only) {
      const day = now.getDay();
      if (day === 0 || day === 6) { skipped++; continue; } // Weekend
    }

    if (currentHour < (campaign.send_hours_start || 9) || currentHour >= (campaign.send_hours_end || 18)) {
      skipped++;
      continue;
    }

    // Verifier limites d'envoi
    const limitsRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/rpc/check_sending_limits`,
      { method: 'POST', headers: supabaseHeaders(env), body: JSON.stringify({ p_user_id: campaign.user_id }) }
    );
    const limits = (await limitsRes.json())[0];
    if (!limits?.can_send) {
      console.log(`User ${campaign.user_id} reached sending limit`);
      skipped++;
      continue;
    }

    // Recuperer le prochain email de la sequence
    const nextStep = item.current_step + 1;
    const seqEmailRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/campaign_sequence_emails?campaign_id=eq.${campaign.id}&position=eq.${nextStep}`,
      { headers: supabaseHeaders(env) }
    );
    const seqEmails = await seqEmailRes.json();
    const seqEmail = seqEmails[0];

    if (!seqEmail) {
      // Sequence terminee
      await fetch(
        `${env.SUPABASE_URL}/rest/v1/campaign_prospect_status?id=eq.${item.id}`,
        {
          method: 'PATCH',
          headers: supabaseHeaders(env),
          body: JSON.stringify({ status: 'completed', next_email_at: null })
        }
      );
      continue;
    }

    // Verifier la condition (no_reply, no_open)
    if (seqEmail.send_condition === 'no_reply' && item.has_replied) {
      await fetch(
        `${env.SUPABASE_URL}/rest/v1/campaign_prospect_status?id=eq.${item.id}`,
        { method: 'PATCH', headers: supabaseHeaders(env), body: JSON.stringify({ status: 'replied' }) }
      );
      continue;
    }

    // Personnaliser l'email
    const subject = personalizeTemplate(seqEmail.subject_template, prospect);
    const body = personalizeTemplate(seqEmail.body_template, prospect);

    // Ajouter lien de desabonnement
    const unsubscribeUrl = `https://sos-storytelling-api.sandra-devonssay.workers.dev/unsubscribe?email=${encodeURIComponent(prospect.email)}&user=${campaign.user_id}`;
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;">
        ${body.replace(/\n/g, '<br>')}
      </div>
      <p style="font-size:11px;color:#999;margin-top:30px;border-top:1px solid #eee;padding-top:15px;">
        Si tu ne souhaites plus recevoir mes emails, <a href="${unsubscribeUrl}">clique ici pour te desabonner</a>.
      </p>
    `;

    // Envoyer via Brevo
    try {
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
        body: JSON.stringify({
          sender: { name: campaign.sender_name, email: campaign.sender_email },
          to: [{ email: prospect.email, name: `${prospect.first_name} ${prospect.last_name || ''}`.trim() }],
          replyTo: { email: campaign.reply_to || campaign.sender_email },
          subject,
          htmlContent: htmlBody,
          textContent: body,
          tags: ['sos-storytelling', 'sequence', campaign.id, `step-${nextStep}`],
          headers: {
            'X-Campaign-Id': campaign.id,
            'X-Prospect-Id': prospect.id,
            'X-Sequence-Step': String(nextStep)
          }
        })
      });

      if (brevoRes.ok) {
        const brevoData = await brevoRes.json();
        const messageId = brevoData.messageId;

        // Calculer le prochain envoi
        const nextSeqEmailRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/campaign_sequence_emails?campaign_id=eq.${campaign.id}&position=eq.${nextStep + 1}`,
          { headers: supabaseHeaders(env) }
        );
        const nextSeqEmails = await nextSeqEmailRes.json();
        const nextSeqEmail = nextSeqEmails[0];

        let nextEmailAt = null;
        if (nextSeqEmail) {
          nextEmailAt = new Date(now.getTime() + nextSeqEmail.delay_days * 24 * 60 * 60 * 1000).toISOString();
        }

        // Mettre a jour le statut
        const emailsHistory = [...(item.emails_history || []), {
          step: nextStep,
          sent_at: now.toISOString(),
          message_id: messageId
        }];

        await fetch(
          `${env.SUPABASE_URL}/rest/v1/campaign_prospect_status?id=eq.${item.id}`,
          {
            method: 'PATCH',
            headers: supabaseHeaders(env),
            body: JSON.stringify({
              current_step: nextStep,
              status: nextEmailAt ? 'in_sequence' : 'completed',
              next_email_at: nextEmailAt,
              total_sent: (item.total_sent || 0) + 1,
              last_sent_at: now.toISOString(),
              first_sent_at: item.first_sent_at || now.toISOString(),
              emails_history: emailsHistory
            })
          }
        );

        // Enregistrer l'email envoye
        await fetch(
          `${env.SUPABASE_URL}/rest/v1/campaign_emails`,
          {
            method: 'POST',
            headers: supabaseHeaders(env),
            body: JSON.stringify({
              campaign_id: campaign.id,
              prospect_id: prospect.id,
              user_id: campaign.user_id,
              sequence_step: nextStep,
              sequence_email_id: seqEmail.id,
              subject,
              body,
              status: 'sent',
              brevo_message_id: messageId,
              sent_at: now.toISOString()
            })
          }
        );

        // Mettre a jour les stats campagne
        await fetch(
          `${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign.id}`,
          {
            method: 'PATCH',
            headers: supabaseHeaders(env),
            body: JSON.stringify({ emails_sent: (campaign.emails_sent || 0) + 1 })
          }
        );

        // Incrementer les compteurs d'envoi
        await fetch(
          `${env.SUPABASE_URL}/rest/v1/rpc/increment_send_counters`,
          { method: 'POST', headers: supabaseHeaders(env), body: JSON.stringify({ p_user_id: campaign.user_id }) }
        );

        sent++;
      } else {
        errors++;
      }
    } catch (e) {
      console.error(`Error sending to ${prospect.email}:`, e);
      errors++;
    }

    // Petit delai entre envois
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`Processed: sent=${sent}, skipped=${skipped}, errors=${errors}`);
  return { success: true, processed: pending.length, sent, skipped, errors };
}

function personalizeTemplate(template, prospect) {
  if (!template) return '';
  return template
    .replace(/{first_name}/g, prospect.first_name || '')
    .replace(/{last_name}/g, prospect.last_name || '')
    .replace(/{company}/g, prospect.company || 'ton entreprise')
    .replace(/{job_title}/g, prospect.job_title || '')
    .replace(/{email}/g, prospect.email || '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================
// ENHANCED BREVO WEBHOOK
// ============================================================

async function handleBrevoWebhookEnhanced(request, env, corsHeaders) {
  try {
    const event = await request.json();
    const { event: eventType, email, 'message-id': messageId } = event;

    console.log(`Brevo webhook: ${eventType} for ${email}`);

    // Enregistrer l'evenement
    await fetch(`${env.SUPABASE_URL}/rest/v1/email_events`, {
      method: 'POST',
      headers: supabaseHeaders(env),
      body: JSON.stringify({ email, message_id: messageId, event_type: eventType, payload: event })
    });

    // Trouver l'email envoye correspondant
    const emailRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/campaign_emails?brevo_message_id=eq.${messageId}&select=*,email_campaigns(*),prospects(*)`,
      { headers: supabaseHeaders(env) }
    );
    const emails = await emailRes.json();
    const emailRecord = emails[0];

    if (emailRecord) {
      const campaign = emailRecord.email_campaigns;
      const prospect = emailRecord.prospects;

      let emailUpdates = {};
      let prospectUpdates = {};
      let statusUpdates = {};
      let campaignUpdates = {};

      switch (eventType) {
        case 'delivered':
          emailUpdates.status = 'delivered';
          emailUpdates.delivered_at = new Date().toISOString();
          break;

        case 'opened':
        case 'unique_opened':
          emailUpdates.status = 'opened';
          emailUpdates.opened_at = emailRecord.opened_at || new Date().toISOString();
          emailUpdates.open_count = (emailRecord.open_count || 0) + 1;
          prospectUpdates.status = 'opened';
          prospectUpdates.last_opened_at = new Date().toISOString();
          statusUpdates.total_opened = 'increment';
          if (!emailRecord.opened_at) {
            campaignUpdates.emails_opened = (campaign?.emails_opened || 0) + 1;
          }
          break;

        case 'click':
          emailUpdates.status = 'clicked';
          emailUpdates.clicked_at = emailRecord.clicked_at || new Date().toISOString();
          emailUpdates.click_count = (emailRecord.click_count || 0) + 1;
          prospectUpdates.status = 'clicked';
          prospectUpdates.last_clicked_at = new Date().toISOString();
          statusUpdates.total_clicked = 'increment';
          if (!emailRecord.clicked_at) {
            campaignUpdates.emails_clicked = (campaign?.emails_clicked || 0) + 1;
          }
          break;

        case 'reply':
          // IMPORTANT: Stopper la sequence quand le prospect repond!
          emailUpdates.status = 'replied';
          emailUpdates.replied_at = new Date().toISOString();
          prospectUpdates.status = 'replied';
          prospectUpdates.replied_at = new Date().toISOString();

          // Arreter la sequence pour ce prospect
          await fetch(
            `${env.SUPABASE_URL}/rest/v1/campaign_prospect_status?campaign_id=eq.${campaign.id}&prospect_id=eq.${prospect.id}`,
            {
              method: 'PATCH',
              headers: supabaseHeaders(env),
              body: JSON.stringify({
                status: 'replied',
                has_replied: true,
                replied_at: new Date().toISOString(),
                next_email_at: null
              })
            }
          );

          campaignUpdates.emails_replied = (campaign?.emails_replied || 0) + 1;
          break;

        case 'hard_bounce':
        case 'soft_bounce':
          emailUpdates.status = 'bounced';
          prospectUpdates.status = 'bounced';

          // Arreter la sequence
          await fetch(
            `${env.SUPABASE_URL}/rest/v1/campaign_prospect_status?campaign_id=eq.${campaign.id}&prospect_id=eq.${prospect.id}`,
            {
              method: 'PATCH',
              headers: supabaseHeaders(env),
              body: JSON.stringify({ status: 'bounced', next_email_at: null })
            }
          );

          campaignUpdates.emails_bounced = (campaign?.emails_bounced || 0) + 1;

          // === NOUVEAU: Ajouter au blacklist ===
          await addToBlacklistEnhanced(env, campaign.user_id, email, eventType === 'hard_bounce' ? 'hard_bounce' : 'soft_bounce', 'brevo_webhook', { message_id: messageId, event });

          // === NOUVEAU: Mettre à jour health score du sender ===
          if (emailRecord.sender_email_id) {
            const healthPenalty = eventType === 'hard_bounce' ? 10 : 5;
            await fetch(
              `${env.SUPABASE_URL}/rest/v1/sender_emails?id=eq.${emailRecord.sender_email_id}`,
              {
                method: 'PATCH',
                headers: supabaseHeaders(env),
                body: JSON.stringify({
                  total_bounces: emailRecord.sender_emails?.total_bounces + 1 || 1
                })
              }
            );
            // Appeler RPC pour mise à jour health avec désactivation auto
            await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/update_sender_health_on_bounce`, {
              method: 'POST',
              headers: supabaseHeaders(env),
              body: JSON.stringify({ p_sender_id: emailRecord.sender_email_id, p_is_hard_bounce: eventType === 'hard_bounce' })
            });
          }
          break;

        case 'unsubscribed':
        case 'complaint':
          prospectUpdates.status = 'unsubscribed';

          // Ajouter a la blacklist (ancienne table)
          await fetch(`${env.SUPABASE_URL}/rest/v1/email_unsubscribes`, {
            method: 'POST',
            headers: supabaseHeaders(env),
            body: JSON.stringify({
              user_id: campaign.user_id,
              email: email.toLowerCase(),
              reason: eventType
            })
          });

          // === NOUVEAU: Ajouter au blacklist enrichi ===
          await addToBlacklistEnhanced(env, campaign.user_id, email, eventType === 'complaint' ? 'complaint' : 'unsubscribe', 'brevo_webhook', { message_id: messageId, event });

          // === NOUVEAU: Pénalité lourde pour complaint ===
          if (eventType === 'complaint' && emailRecord.sender_email_id) {
            await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/update_sender_health_on_bounce`, {
              method: 'POST',
              headers: supabaseHeaders(env),
              body: JSON.stringify({ p_sender_id: emailRecord.sender_email_id, p_is_hard_bounce: true }) // -10 pour complaint
            });
          }

          // Arreter la sequence
          await fetch(
            `${env.SUPABASE_URL}/rest/v1/campaign_prospect_status?campaign_id=eq.${campaign.id}&prospect_id=eq.${prospect.id}`,
            {
              method: 'PATCH',
              headers: supabaseHeaders(env),
              body: JSON.stringify({ status: 'unsubscribed', next_email_at: null })
            }
          );
          break;
      }

      // Appliquer les mises a jour
      if (Object.keys(emailUpdates).length > 0) {
        await fetch(
          `${env.SUPABASE_URL}/rest/v1/campaign_emails?id=eq.${emailRecord.id}`,
          { method: 'PATCH', headers: supabaseHeaders(env), body: JSON.stringify(emailUpdates) }
        );
      }

      if (Object.keys(prospectUpdates).length > 0) {
        await fetch(
          `${env.SUPABASE_URL}/rest/v1/prospects?id=eq.${prospect.id}`,
          { method: 'PATCH', headers: supabaseHeaders(env), body: JSON.stringify(prospectUpdates) }
        );
      }

      if (Object.keys(campaignUpdates).length > 0) {
        await fetch(
          `${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign.id}`,
          { method: 'PATCH', headers: supabaseHeaders(env), body: JSON.stringify(campaignUpdates) }
        );
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error('Webhook error:', e);
    return new Response('Error', { status: 500, headers: corsHeaders });
  }
}

// ============================================================
// UNSUBSCRIBE PAGE
// ============================================================

async function handleUnsubscribePage(request, env, corsHeaders) {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const userId = url.searchParams.get('user');

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Desabonnement</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; text-align: center; }
    h1 { color: #333; }
    p { color: #666; }
    button { background: #f5576c; color: white; border: none; padding: 15px 30px; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 20px; }
    button:hover { background: #e04555; }
    .success { color: #28a745; }
    .email { font-weight: bold; color: #333; }
  </style>
</head>
<body>
  <h1>Te desabonner ?</h1>
  <p>Tu souhaites ne plus recevoir d'emails a l'adresse :</p>
  <p class="email">${email || 'votre email'}</p>
  <form method="POST" action="/unsubscribe">
    <input type="hidden" name="email" value="${email || ''}">
    <input type="hidden" name="user" value="${userId || ''}">
    <button type="submit">Confirmer le desabonnement</button>
  </form>
  <p style="margin-top: 30px; font-size: 12px; color: #999;">
    Tu ne recevras plus d'emails de ma part.
  </p>
</body>
</html>`;

  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html', ...corsHeaders } });
}

async function handleUnsubscribeAction(request, env, corsHeaders) {
  const formData = await request.formData();
  const email = formData.get('email');
  const userId = formData.get('user');

  if (email && userId) {
    // Ajouter a la blacklist
    await fetch(`${env.SUPABASE_URL}/rest/v1/email_unsubscribes`, {
      method: 'POST',
      headers: supabaseHeaders(env),
      body: JSON.stringify({
        user_id: userId,
        email: email.toLowerCase(),
        reason: 'link_clicked'
      })
    });

    // Mettre a jour le prospect
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/prospects?email=eq.${encodeURIComponent(email.toLowerCase())}&user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: supabaseHeaders(env),
        body: JSON.stringify({ status: 'unsubscribed' })
      }
    );

    // Arreter toutes les sequences actives
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/campaign_prospect_status?user_id=eq.${userId}&status=in.(pending,in_sequence)`,
      {
        method: 'PATCH',
        headers: supabaseHeaders(env),
        body: JSON.stringify({ status: 'unsubscribed', next_email_at: null })
      }
    );
  }

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Desabonnement confirme</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; text-align: center; }
    h1 { color: #28a745; }
    p { color: #666; }
  </style>
</head>
<body>
  <h1>C'est fait !</h1>
  <p>Tu as ete desabonne(e) avec succes.</p>
  <p>Tu ne recevras plus d'emails de ma part.</p>
</body>
</html>`;

  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html', ...corsHeaders } });
}

// ============================================================
// LEMON SQUEEZY WEBHOOK & SUBSCRIPTION
// ============================================================

async function handleLemonSqueezyWebhook(request, env, corsHeaders) {
  try {
    const body = await request.text();
    const payload = JSON.parse(body);

    // Vérifier la signature (optionnel mais recommandé)
    const signature = request.headers.get('X-Signature');
    if (env.LEMONSQUEEZY_WEBHOOK_SECRET && signature) {
      const expectedSignature = await computeHmacSignature(body, env.LEMONSQUEEZY_WEBHOOK_SECRET);
      if (signature !== expectedSignature) {
        console.log('Invalid webhook signature');
        return jsonResponse({ error: 'Invalid signature' }, 401, corsHeaders);
      }
    }

    const eventName = payload.meta?.event_name;
    const customData = payload.meta?.custom_data || {};
    const userEmail = customData.email || payload.data?.attributes?.user_email;
    const userId = customData.user_id;

    console.log(`Lemon Squeezy webhook: ${eventName} for ${userEmail}`);

    if (!userEmail && !userId) {
      return jsonResponse({ error: 'No user identifier' }, 400, corsHeaders);
    }

    // Déterminer le statut selon l'événement
    let subscriptionStatus = null;
    let subscriptionData = {};

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_resumed':
        subscriptionStatus = 'active';
        subscriptionData = {
          plan: payload.data?.attributes?.product_name || 'Solo',
          variant: payload.data?.attributes?.variant_name || 'Monthly',
          renews_at: payload.data?.attributes?.renews_at,
          subscription_id: payload.data?.id
        };
        break;

      case 'subscription_updated':
        // Vérifier si toujours actif
        const status = payload.data?.attributes?.status;
        subscriptionStatus = (status === 'active' || status === 'on_trial') ? 'active' : status;
        subscriptionData = {
          plan: payload.data?.attributes?.product_name,
          variant: payload.data?.attributes?.variant_name,
          renews_at: payload.data?.attributes?.renews_at,
          subscription_id: payload.data?.id
        };
        break;

      case 'subscription_cancelled':
        subscriptionStatus = 'cancelled';
        subscriptionData = {
          ends_at: payload.data?.attributes?.ends_at
        };
        break;

      case 'subscription_expired':
        subscriptionStatus = 'expired';
        break;

      case 'subscription_payment_failed':
        subscriptionStatus = 'past_due';
        break;

      case 'order_created':
        // Pour les achats one-time (si applicable)
        subscriptionStatus = 'active';
        subscriptionData = {
          plan: payload.data?.attributes?.first_order_item?.product_name || 'Solo',
          type: 'one_time'
        };
        break;

      default:
        console.log(`Unhandled event: ${eventName}`);
        return jsonResponse({ received: true, event: eventName }, 200, corsHeaders);
    }

    // Mettre à jour dans Supabase
    if (subscriptionStatus) {
      await updateSubscriptionStatus(env, userEmail, userId, subscriptionStatus, subscriptionData);
    }

    return jsonResponse({ success: true, event: eventName, status: subscriptionStatus }, 200, corsHeaders);

  } catch (error) {
    console.error('Webhook error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

async function updateSubscriptionStatus(env, email, userId, status, data = {}) {
  // Chercher l'utilisateur par email ou userId
  let userIdToUpdate = userId;

  if (!userIdToUpdate && email) {
    // Chercher l'utilisateur par email dans auth.users
    const searchResponse = await fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users?filter=email.eq.${encodeURIComponent(email)}`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (searchResponse.ok) {
      const users = await searchResponse.json();
      if (users.users && users.users.length > 0) {
        userIdToUpdate = users.users[0].id;
      }
    }
  }

  if (!userIdToUpdate) {
    console.log(`User not found for email: ${email}`);
    return false;
  }

  // Upsert dans la table subscriptions
  const subscriptionRecord = {
    user_id: userIdToUpdate,
    status: status,
    plan: data.plan || 'Solo',
    variant: data.variant || 'Monthly',
    subscription_id: data.subscription_id || null,
    renews_at: data.renews_at || null,
    ends_at: data.ends_at || null,
    updated_at: new Date().toISOString()
  };

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/subscriptions`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(subscriptionRecord)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Supabase update error:', errorText);
    return false;
  }

  console.log(`Subscription updated for user ${userIdToUpdate}: ${status}`);
  return true;
}

async function handleSubscriptionCheck(request, env, corsHeaders) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await verifySupabaseToken(token, env);

    if (!user) {
      return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);
    }

    // Récupérer le statut d'abonnement
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${user.id}&select=*`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (!response.ok) {
      return jsonResponse({ status: 'free', plan: null }, 200, corsHeaders);
    }

    const subscriptions = await response.json();

    if (subscriptions.length === 0) {
      return jsonResponse({ status: 'free', plan: null }, 200, corsHeaders);
    }

    const sub = subscriptions[0];
    return jsonResponse({
      status: sub.status,
      plan: sub.plan,
      variant: sub.variant,
      renews_at: sub.renews_at,
      ends_at: sub.ends_at
    }, 200, corsHeaders);

  } catch (error) {
    console.error('Subscription check error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

async function computeHmacSignature(body, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================
// HELPERS
// ============================================================

function jsonResponse(data, status, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function supabaseHeaders(env) {
  return {
    'apikey': env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };
}

async function verifySupabaseToken(token, env) {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': env.SUPABASE_SERVICE_KEY }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) { return null; }
}

// === NOUVEAU: Ajouter au blacklist enrichi ===
async function addToBlacklistEnhanced(env, userId, email, reason, source, details = {}) {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/email_blacklist`, {
      method: 'POST',
      headers: { ...supabaseHeaders(env), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({
        user_id: userId,
        email: email.toLowerCase().trim(),
        reason,
        source,
        details
      })
    });
    console.log(`Blacklist: ${email} ajouté (${reason})`);
  } catch (e) {
    console.error('Erreur blacklist:', e);
  }
}

// === NOUVEAU: Vérifier si email blacklisté ===
async function isEmailBlacklisted(env, userId, email) {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/email_blacklist?user_id=eq.${userId}&email=eq.${encodeURIComponent(email.toLowerCase())}&select=id`,
      { headers: supabaseHeaders(env) }
    );
    const data = await response.json();
    return data.length > 0;
  } catch (e) {
    return false;
  }
}

async function getCampaignIfOwner(campaignId, userId, env) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaignId}&user_id=eq.${userId}`,
    { headers: supabaseHeaders(env) }
  );
  const campaigns = await response.json();
  return campaigns[0] || null;
}

// ============================================================
// GENERATE PROSPECT EMAIL
// ============================================================

async function handleGenerateProspectEmail(request, env, user, corsHeaders) {
  const body = await request.json();
  const { prospect, campaign_goal, email_number = 1, language = 'fr' } = body;

  if (!prospect || !campaign_goal) {
    return jsonResponse({ error: 'Missing prospect or campaign_goal' }, 400, corsHeaders);
  }

  const prompt = `Tu es expert en cold emailing B2B.
${language === 'en' ? 'Write in English.' : 'Ecris en francais.'}

PROSPECT:
- Nom: ${prospect.first_name} ${prospect.last_name || ''}
- Entreprise: ${prospect.company || 'N/A'}
- Poste: ${prospect.job_title || 'N/A'}

OBJECTIF: ${campaign_goal}

EMAIL ${email_number === 1 ? 'INITIAL' : `DE RELANCE #${email_number}`}

REGLES:
- Max 80 mots
- Personnalise avec le prenom
- Termine par une question ouverte
- Pas de lien
- Ton conversationnel

FORMAT JSON:
{"subject": "...", "body": "..."}`;

  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!claudeResponse.ok) {
    return jsonResponse({ error: 'Generation failed' }, 500, corsHeaders);
  }

  const data = await claudeResponse.json();
  const content = data.content[0].text;

  try {
    const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return jsonResponse({ success: true, subject: parsed.subject, body: parsed.body }, 200, corsHeaders);
  } catch (e) {
    return jsonResponse({ success: true, subject: 'Email', body: content }, 200, corsHeaders);
  }
}

// ============================================================
// CAMPAIGNS CRUD
// ============================================================

async function handleListCampaigns(url, env, user, corsHeaders) {
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  let query = `${env.SUPABASE_URL}/rest/v1/email_campaigns?user_id=eq.${user.id}&order=created_at.desc&limit=${limit}&offset=${offset}`;
  if (status) query += `&status=eq.${status}`;
  const response = await fetch(query, { headers: { ...supabaseHeaders(env), 'Prefer': 'count=exact' } });
  const total = response.headers.get('Content-Range')?.split('/')[1] || 0;
  const campaigns = await response.json();
  return jsonResponse({ campaigns, total: parseInt(total), limit, offset }, 200, corsHeaders);
}

async function handleCreateCampaignV2(request, env, user, corsHeaders) {
  const body = await request.json();
  const data = {
    user_id: user.id,
    name: body.name,
    description: body.description || null,
    sender_email: body.sender_email,
    sender_name: body.sender_name,
    reply_to: body.reply_to || body.sender_email,
    goal: body.goal,
    language: body.language || 'fr',
    use_my_voice: body.use_my_voice !== false,
    generate_unique_per_prospect: body.generate_unique_per_prospect !== false,
    prospect_filter: body.prospect_filter || null,
    total_prospects: body.total_prospects || 0,
    send_weekdays_only: body.send_weekdays_only !== false,
    send_hours_start: body.send_hours_start || 9,
    send_hours_end: body.send_hours_end || 18,
    status: 'draft'
  };
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns`, {
    method: 'POST',
    headers: { ...supabaseHeaders(env), 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  });
  const [campaign] = await response.json();
  return jsonResponse({ success: true, campaign }, 201, corsHeaders);
}

async function handleGetCampaign(id, env, user, corsHeaders) {
  const campaign = await getCampaignIfOwner(id, user.id, env);
  if (!campaign) return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  return jsonResponse({ campaign }, 200, corsHeaders);
}

async function handleUpdateCampaignV2(id, request, env, user, corsHeaders) {
  const campaign = await getCampaignIfOwner(id, user.id, env);
  if (!campaign) return jsonResponse({ error: 'Not found' }, 404, corsHeaders);

  const body = await request.json();
  const allowed = ['name', 'description', 'sender_email', 'sender_name', 'reply_to', 'goal', 'language', 'use_my_voice', 'generate_unique_per_prospect', 'prospect_filter', 'total_prospects', 'send_weekdays_only', 'send_hours_start', 'send_hours_end', 'scheduled_at'];
  const updates = {};
  for (const f of allowed) if (body[f] !== undefined) updates[f] = body[f];
  updates.updated_at = new Date().toISOString();

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...supabaseHeaders(env), 'Prefer': 'return=representation' },
    body: JSON.stringify(updates)
  });
  const campaigns = await response.json();
  return jsonResponse({ success: true, campaign: campaigns[0] }, 200, corsHeaders);
}

async function handleDeleteCampaign(id, env, user, corsHeaders) {
  const campaign = await getCampaignIfOwner(id, user.id, env);
  if (!campaign) return jsonResponse({ error: 'Not found' }, 404, corsHeaders);

  await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${id}`, {
    method: 'DELETE',
    headers: supabaseHeaders(env)
  });
  return jsonResponse({ success: true }, 200, corsHeaders);
}

// ============================================================
// FRONTEND REQUEST HANDLER (Claude & Perplexity)
// ============================================================

async function handleFrontendRequest(request, env, corsHeaders) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    if (!body.messages || !Array.isArray(body.messages)) {
      return jsonResponse({ error: "Messages manquants ou invalides" }, 400, corsHeaders);
    }

    const userProfile = body.userProfile || null;
    const usePerplexity = body.usePerplexity === true;

    let profileContext = "";
    if (userProfile && userProfile.nom) {
      profileContext = `\nPROFIL: ${userProfile.nom}, Domaine: ${userProfile.domaine || "N/A"}\n`;
    }

    // Si Perplexity est demande (pour TRENDS, recherche web)
    if (usePerplexity && env.PERPLEXITY_API_KEY) {
      const systemPrompt = `Tu es Tithot, une experte en tendances reseaux sociaux et personal branding.
${profileContext}
Utilise les informations du web en temps reel pour proposer des tendances actuelles.`;

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-large-128k-online",
          messages: [
            { role: "system", content: systemPrompt },
            ...body.messages
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        console.error("Perplexity error:", await response.text());
        // Fallback to Claude if Perplexity fails
        return await callClaude(body, profileContext, env, corsHeaders);
      }

      const data = await response.json();
      // Format Perplexity response to match Claude format
      return new Response(JSON.stringify({
        content: [{ type: "text", text: data.choices?.[0]?.message?.content || "" }]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Default: Use Claude
    return await callClaude(body, profileContext, env, corsHeaders);

  } catch (error) {
    console.error("Frontend error:", error);
    return jsonResponse({ error: "Erreur serveur", message: error.message }, 500, corsHeaders);
  }
}

async function callClaude(body, profileContext, env, corsHeaders) {
  const systemPrompt = `Tu es Tithot, une coach creative specialisee en personal branding.
${profileContext}
STYLE: Energique, bienveillante, utilise des emojis. Maximum 400 mots.`;

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
    return jsonResponse({ error: `Erreur API: ${response.status}`, details: errorData }, response.status, corsHeaders);
  }

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}

// ============================================================
// PROSPECTS API
// ============================================================

async function handleProspectsAPI(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);
  if (!user) return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/prospects', '');

  try {
    switch (true) {
      case path === '' && request.method === 'GET':
        return await handleListProspects(url, env, user, corsHeaders);
      case path === '' && request.method === 'POST':
        return await handleCreateProspect(request, env, user, corsHeaders);
      case path === '/import' && request.method === 'POST':
        return await handleImportProspects(request, env, user, corsHeaders);
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'GET':
        return await handleGetProspect(path.slice(1), env, user, corsHeaders);
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'PUT':
        return await handleUpdateProspect(path.slice(1), request, env, user, corsHeaders);
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'DELETE':
        return await handleDeleteProspect(path.slice(1), env, user, corsHeaders);
      default:
        return jsonResponse({ error: 'Endpoint not found' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Prospects API Error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

async function handleListProspects(url, env, user, corsHeaders) {
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const source = url.searchParams.get('source');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = `${env.SUPABASE_URL}/rest/v1/prospects?user_id=eq.${user.id}&order=created_at.desc&limit=${limit}&offset=${offset}`;
  if (status && status !== 'all') query += `&status=eq.${status}`;
  if (source) query += `&source=eq.${source}`;
  if (search) query += `&or=(email.ilike.*${search}*,first_name.ilike.*${search}*,last_name.ilike.*${search}*,company.ilike.*${search}*)`;

  const response = await fetch(query, { headers: { ...supabaseHeaders(env), 'Prefer': 'count=exact' } });
  const total = response.headers.get('Content-Range')?.split('/')[1] || 0;
  const prospects = await response.json();
  return jsonResponse({ prospects, total: parseInt(total), limit, offset }, 200, corsHeaders);
}

async function handleCreateProspect(request, env, user, corsHeaders) {
  const body = await request.json();
  const data = {
    user_id: user.id,
    email: body.email?.toLowerCase(),
    first_name: body.first_name || null,
    last_name: body.last_name || null,
    company: body.company || null,
    job_title: body.job_title || null,
    linkedin_url: body.linkedin_url || null,
    city: body.city || null,
    source: body.source || 'manual',
    status: 'new'
  };

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/prospects`, {
    method: 'POST',
    headers: { ...supabaseHeaders(env), 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  });
  const [prospect] = await response.json();
  return jsonResponse({ success: true, prospect }, 201, corsHeaders);
}

async function handleImportProspects(request, env, user, corsHeaders) {
  const body = await request.json();
  const { prospects: importData, source = 'csv_import' } = body;

  if (!importData || !Array.isArray(importData)) {
    return jsonResponse({ error: 'Missing prospects array' }, 400, corsHeaders);
  }

  const toInsert = importData.map(p => ({
    user_id: user.id,
    email: (p.email || '').toLowerCase(),
    first_name: p.first_name || p.firstName || p.Prénom || p.prenom || null,
    last_name: p.last_name || p.lastName || p.Nom || p.nom || null,
    company: p.company || p.Entreprise || p.entreprise || null,
    job_title: p.job_title || p.jobTitle || p.Poste || p.poste || null,
    linkedin_url: p.linkedin_url || p.linkedinUrl || p.LinkedIn || p.linkedin || null,
    city: p.city || p.Ville || p.ville || p.location || null,
    source: source,
    status: 'new'
  })).filter(p => p.email);

  if (toInsert.length === 0) {
    return jsonResponse({ error: 'No valid prospects (email required)' }, 400, corsHeaders);
  }

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/prospects`, {
    method: 'POST',
    headers: { ...supabaseHeaders(env), 'Prefer': 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(toInsert)
  });

  const imported = await response.json();
  return jsonResponse({ success: true, imported: imported.length }, 201, corsHeaders);
}

async function handleGetProspect(id, env, user, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/prospects?id=eq.${id}&user_id=eq.${user.id}`,
    { headers: supabaseHeaders(env) }
  );
  const prospects = await response.json();
  if (prospects.length === 0) return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  return jsonResponse({ prospect: prospects[0] }, 200, corsHeaders);
}

async function handleUpdateProspect(id, request, env, user, corsHeaders) {
  const body = await request.json();
  const allowed = ['email', 'first_name', 'last_name', 'company', 'job_title', 'linkedin_url', 'city', 'status', 'notes', 'tags'];
  const updates = {};
  for (const f of allowed) if (body[f] !== undefined) updates[f] = body[f];
  if (updates.email) updates.email = updates.email.toLowerCase();
  updates.updated_at = new Date().toISOString();

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/prospects?id=eq.${id}&user_id=eq.${user.id}`,
    {
      method: 'PATCH',
      headers: { ...supabaseHeaders(env), 'Prefer': 'return=representation' },
      body: JSON.stringify(updates)
    }
  );
  const prospects = await response.json();
  if (prospects.length === 0) return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  return jsonResponse({ success: true, prospect: prospects[0] }, 200, corsHeaders);
}

async function handleDeleteProspect(id, env, user, corsHeaders) {
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/prospects?id=eq.${id}&user_id=eq.${user.id}`,
    { method: 'DELETE', headers: supabaseHeaders(env) }
  );
  return jsonResponse({ success: true }, 200, corsHeaders);
}

// ============================================================
// NEWSLETTERS API
// ============================================================

async function handleNewslettersAPI(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);
  if (!user) return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/newsletters', '');

  try {
    switch (true) {
      case path === '' && request.method === 'GET':
        return await handleListNewsletters(url, env, user, corsHeaders);
      case path === '' && request.method === 'POST':
        return await handleCreateNewsletter(request, env, user, corsHeaders);
      case path === '/generate' && request.method === 'POST':
        return await handleGenerateNewsletter(request, env, user, corsHeaders);
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'GET':
        return await handleGetNewsletter(path.slice(1), env, user, corsHeaders);
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'PUT':
        return await handleUpdateNewsletter(path.slice(1), request, env, user, corsHeaders);
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'DELETE':
        return await handleDeleteNewsletter(path.slice(1), env, user, corsHeaders);
      default:
        return jsonResponse({ error: 'Endpoint not found' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Newsletters API Error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

async function handleListNewsletters(url, env, user, corsHeaders) {
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/newsletters?user_id=eq.${user.id}&order=created_at.desc&limit=${limit}&offset=${offset}`,
    { headers: { ...supabaseHeaders(env), 'Prefer': 'count=exact' } }
  );
  const total = response.headers.get('Content-Range')?.split('/')[1] || 0;
  const newsletters = await response.json();
  return jsonResponse({ newsletters, total: parseInt(total) }, 200, corsHeaders);
}

async function handleCreateNewsletter(request, env, user, corsHeaders) {
  const body = await request.json();
  const data = {
    user_id: user.id,
    title: body.title,
    content: body.content,
    status: body.status || 'draft'
  };

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/newsletters`, {
    method: 'POST',
    headers: { ...supabaseHeaders(env), 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  });
  const [newsletter] = await response.json();
  return jsonResponse({ success: true, newsletter }, 201, corsHeaders);
}

async function handleGenerateNewsletter(request, env, user, corsHeaders) {
  const body = await request.json();
  const { topic, style, length } = body;

  const prompt = `Genere une newsletter sur le sujet: ${topic}
Style: ${style || 'professionnel'}
Longueur: ${length || 'moyenne'}

Structure:
1. Titre accrocheur
2. Introduction engageante
3. Corps avec 2-3 points cles
4. Conclusion avec call-to-action`;

  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!claudeResponse.ok) {
    return jsonResponse({ error: 'Generation failed' }, 500, corsHeaders);
  }

  const data = await claudeResponse.json();
  const content = data.content[0].text;

  return jsonResponse({ success: true, content }, 200, corsHeaders);
}

async function handleGetNewsletter(id, env, user, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/newsletters?id=eq.${id}&user_id=eq.${user.id}`,
    { headers: supabaseHeaders(env) }
  );
  const newsletters = await response.json();
  if (newsletters.length === 0) return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  return jsonResponse({ newsletter: newsletters[0] }, 200, corsHeaders);
}

async function handleUpdateNewsletter(id, request, env, user, corsHeaders) {
  const body = await request.json();
  const allowed = ['title', 'content', 'status'];
  const updates = {};
  for (const f of allowed) if (body[f] !== undefined) updates[f] = body[f];
  updates.updated_at = new Date().toISOString();

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/newsletters?id=eq.${id}&user_id=eq.${user.id}`,
    {
      method: 'PATCH',
      headers: { ...supabaseHeaders(env), 'Prefer': 'return=representation' },
      body: JSON.stringify(updates)
    }
  );
  const newsletters = await response.json();
  if (newsletters.length === 0) return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  return jsonResponse({ success: true, newsletter: newsletters[0] }, 200, corsHeaders);
}

async function handleDeleteNewsletter(id, env, user, corsHeaders) {
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/newsletters?id=eq.${id}&user_id=eq.${user.id}`,
    { method: 'DELETE', headers: supabaseHeaders(env) }
  );
  return jsonResponse({ success: true }, 200, corsHeaders);
}

// ============================================================
// CHATBOT AI ASSISTANT - Assistant conversationnel intelligent
// ============================================================

const CHAT_SYSTEM_PROMPT = `Tu es Tithot, l'assistant IA de SOS Storytelling, une application de création de contenu pour réseaux sociaux.

## Ta personnalité
- Amical, professionnel et efficace
- Tu tutoies l'utilisateur
- Réponses concises (2-4 phrases max sauf si question complexe)
- Tu utilises des emojis avec parcimonie (1-2 par réponse)

## L'application SOS Storytelling

### Fonctionnalités principales
1. **Génération de contenu IA** : Posts, carrousels, newsletters, scripts vidéo pour LinkedIn, Instagram, TikTok, Facebook, Twitter/X, YouTube
2. **Mon Style** : Analyse les textes de l'utilisateur pour reproduire son style d'écriture unique
3. **Planning IA** : Génère un calendrier éditorial optimisé sur 1-4 semaines
4. **TRENDS** : Détecte les tendances du secteur et propose 5 idées de contenu
5. **20+ structures narratives** : AIDA, PAS, Storytelling, Hero's Journey, Pattern Interrupt...
6. **Exports** : Metricool, Swello, Buffer, CSV
7. **Mode Agence** : Multi-clients avec profils de voix distincts

### Parcours utilisateur
1. Créer un compte → Essai gratuit 14 jours (sans CB)
2. Compléter son profil (domaine, audience, piliers de contenu)
3. Ajouter 3-5 textes dans "Mon Style" pour personnaliser l'IA
4. Générer du contenu : choisir onglet → remplir sujet → choisir plateforme/structure → cliquer Générer
5. Copier ou exporter vers outils de planification

### Tarifs (Offre Early Adopter jusqu'au 20 février)
- **Solo** : 67€/mois pendant 6 mois, puis 97€/mois (usage personnel)
- **Agence Starter** : 99€/mois (jusqu'à 10 clients)
- **Agence Scale** : 199€/mois (jusqu'à 30 clients)
- **Enterprise** : Sur devis (illimité)

### Support
- Email : contact@myinnerquest.fr
- Réponse sous 24-48h
- Support prioritaire pour plans Agence

### Points techniques
- Fonctionne sur tous navigateurs modernes (Chrome, Firefox, Safari, Edge)
- Responsive mobile mais optimisé desktop
- Données sécurisées en Europe, conformité RGPD
- Les contenus générés appartiennent à l'utilisateur

## Règles de réponse
- Si tu ne connais pas la réponse exacte, suggère de contacter contact@myinnerquest.fr
- Pour les bugs, conseille : rafraîchir la page, vider le cache, essayer un autre navigateur
- Ne parle jamais de concurrents (Jasper, Copy.ai, etc.)
- Ne fais pas de promesses sur des fonctionnalités futures non confirmées
- Si on te demande de générer du contenu, explique que tu es l'assistant d'aide, pas le générateur principal

## Langue
Réponds dans la même langue que l'utilisateur (français ou anglais).`;

async function handleChatAssistant(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { message, conversationHistory = [], language = 'fr' } = body;

    if (!message || typeof message !== 'string') {
      return jsonResponse({ error: 'Message required' }, 400, corsHeaders);
    }

    // Rate limiting simple basé sur IP (5 messages/minute)
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `chat_${clientIP}`;

    // Note: En production, utiliser Cloudflare KV ou Durable Objects pour le rate limiting
    // Ici on fait un rate limiting côté client principalement

    // Construire l'historique de conversation (max 10 messages pour limiter les tokens)
    const messages = [];
    const recentHistory = conversationHistory.slice(-10);

    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }

    // Ajouter le nouveau message
    messages.push({ role: 'user', content: message });

    // Appel Claude API avec Haiku pour le chat (plus rapide et moins cher)
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 500,
        temperature: 0.7,
        system: CHAT_SYSTEM_PROMPT,
        messages: messages
      })
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API Error:', errorText);
      return jsonResponse({
        error: 'Assistant temporarily unavailable',
        fallback: language === 'en'
          ? "I'm having trouble right now. Please contact contact@myinnerquest.fr for help."
          : "Je rencontre un problème technique. Contacte contact@myinnerquest.fr pour de l'aide."
      }, 503, corsHeaders);
    }

    const data = await claudeResponse.json();
    const assistantMessage = data.content[0].text;

    return jsonResponse({
      success: true,
      message: assistantMessage,
      usage: {
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0
      }
    }, 200, corsHeaders);

  } catch (error) {
    console.error('Chat Assistant Error:', error);
    return jsonResponse({
      error: 'Internal error',
      fallback: "Une erreur s'est produite. Réessaie ou contacte contact@myinnerquest.fr"
    }, 500, corsHeaders);
  }
}

// ============================================================
// SPINTAX GENERATOR - Génère des variations par section
// ============================================================

const SPINTAX_SYSTEM_PROMPT = `Tu es un expert en cold email et en délivrabilité.
Ta mission : transformer un email en format SPINTAX pour éviter les filtres anti-spam.

## RÈGLES IMPORTANTES

1. **Spinner par SECTION, pas par mot**
   - MAUVAIS : {J'ai|Je} {vu|remarqué} {votre|ton} {site|entreprise}
   - BON : {J'ai vu ton dernier post LinkedIn|Ton article sur [sujet] m'a interpellé|Je viens de découvrir ton projet}

2. **Chaque variation doit être NATURELLE**
   - Sonne comme un humain qui écrit
   - Garde le même sentiment/intention
   - Varie la structure, pas juste les synonymes

3. **Créer 3-4 variations par section**
   - Accroche/Hook : 3-4 variations complètes
   - Corps du message : 2-3 variations par paragraphe
   - CTA : 3-4 variations

4. **Format de sortie**
   Retourne UNIQUEMENT le texte en format spintax, sans explication.
   Utilise { } pour les variations et | pour séparer les options.

## EXEMPLE

Input:
"Salut [Prénom],
J'ai vu ton post sur LinkedIn et ça m'a interpellé.
On aide les agences comme la tienne à automatiser leur prospection.
Tu aurais 15 min pour en discuter ?"

Output:
"{Salut|Hey|Hello} [Prénom],

{J'ai vu ton dernier post sur LinkedIn et ça m'a vraiment interpellé|Ton contenu sur LinkedIn m'a tapé dans l'œil|Je suis tombé sur ton profil et j'ai adoré ta vision}

{On accompagne les agences comme la tienne à scaler leur prospection sans y passer des heures|Notre spécialité : aider les agences à automatiser leur acquisition client|J'aide des agences similaires à la tienne à générer des leads en autopilot}

{Tu aurais 15 min cette semaine pour en parler ?|On se cale un call rapide pour voir si ça peut t'aider ?|Dispo pour un échange de 15 min ?|Je te propose un call découverte de 15 min, ça te dit ?}"`;

async function handleSpintaxGenerator(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { email, variations = 3, language = 'fr' } = body;

    if (!email || typeof email !== 'string') {
      return jsonResponse({ error: 'Email content required' }, 400, corsHeaders);
    }

    if (email.length > 5000) {
      return jsonResponse({ error: 'Email too long (max 5000 characters)' }, 400, corsHeaders);
    }

    const userPrompt = language === 'en'
      ? `Transform this email into spintax format with ${variations} variations per section:\n\n${email}`
      : `Transforme cet email en format spintax avec ${variations} variations par section :\n\n${email}`;

    // Appel Claude API
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 2000,
        temperature: 0.8,
        system: SPINTAX_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Spintax API Error:', errorText);
      return jsonResponse({ error: 'Failed to generate spintax' }, 503, corsHeaders);
    }

    const data = await claudeResponse.json();
    const spintaxResult = data.content[0].text;

    // Calculer le nombre de combinaisons possibles
    const combinationsCount = calculateSpintaxCombinations(spintaxResult);

    return jsonResponse({
      success: true,
      spintax: spintaxResult,
      combinations: combinationsCount,
      usage: {
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0
      }
    }, 200, corsHeaders);

  } catch (error) {
    console.error('Spintax Generator Error:', error);
    return jsonResponse({ error: 'Internal error' }, 500, corsHeaders);
  }
}

// ============================================================
// VISUAL AUDIT - Analyse de profil avec Claude Vision
// ============================================================

async function handleVisualAudit(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { platform, keywords = [], profileImage, postImages = [] } = body;

    if (!profileImage) {
      return jsonResponse({ error: 'Profile image required' }, 400, corsHeaders);
    }

    // Extraire le type d'image et les données base64
    const profileMatch = profileImage.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!profileMatch) {
      return jsonResponse({ error: 'Invalid image format' }, 400, corsHeaders);
    }

    const profileMediaType = profileMatch[1];
    const profileData = profileMatch[2];

    // Construire le contenu du message pour Claude Vision
    const messageContent = [];

    // Image du profil
    messageContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: profileMediaType,
        data: profileData
      }
    });

    // Images des posts (si présentes)
    for (const postImage of postImages.slice(0, 3)) {
      const postMatch = postImage.match(/^data:(image\/\w+);base64,(.+)$/);
      if (postMatch) {
        messageContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: postMatch[1],
            data: postMatch[2]
          }
        });
      }
    }

    // Prompt d'analyse
    const platformNames = {
      linkedin: 'LinkedIn',
      instagram: 'Instagram',
      tiktok: 'TikTok',
      twitter: 'X (Twitter)'
    };

    const keywordsContext = keywords.length > 0
      ? `\nLe domaine d'expertise déclaré : ${keywords.join(', ')}`
      : '';

    // Critères spécifiques selon la plateforme
    const hasBanner = platform === 'linkedin' || platform === 'twitter';
    const platformSpecificCriteria = {
      linkedin: {
        element2: `2. **Bannière/couverture** (sur 100) :
   - Message clair et lisible
   - Cohérence avec l'activité professionnelle
   - Qualité graphique (pas pixelisé, bien cadré)
   - Appel à l'action ou promesse visible`,
        colorContext: 'bannière, posts, et identité'
      },
      twitter: {
        element2: `2. **Bannière/header** (sur 100) :
   - Message clair et lisible
   - Cohérence avec l'activité
   - Qualité graphique (pas pixelisé, bien cadré)
   - Impact visuel`,
        colorContext: 'bannière, posts, et identité'
      },
      instagram: {
        element2: `2. **Grille & Highlights** (sur 100) :
   - Cohérence visuelle de la grille (feed)
   - Couvertures des stories à la une claires
   - Organisation thématique des highlights
   - Premier impact visuel de la grille`,
        colorContext: 'grille de posts et identité'
      },
      tiktok: {
        element2: `2. **Grille & Couvertures vidéos** (sur 100) :
   - Cohérence des miniatures vidéo
   - Qualité des couvertures personnalisées
   - Impact visuel du profil
   - Organisation du contenu épinglé`,
        colorContext: 'miniatures et identité visuelle'
      }
    };

    const criteria = platformSpecificCriteria[platform] || platformSpecificCriteria.linkedin;
    const element2Key = hasBanner ? 'banner' : 'grid';

    const analysisPrompt = `Tu es un expert en personal branding, design visuel et storytelling sur les réseaux sociaux.

Analyse cette capture d'écran d'un profil ${platformNames[platform] || platform}.${keywordsContext}

${postImages.length > 0 ? `J'ai également fourni ${postImages.length} captures de posts/contenus récents.` : ''}

Évalue les éléments suivants et donne une note sur 100 pour chaque critère :

1. **Photo de profil** (sur 100) :
   - Qualité de l'image (netteté, éclairage, résolution)
   - Professionnalisme vs authenticité (le bon équilibre)
   - Visage visible et expression engageante
   - Fond approprié (pas distrayant)

${criteria.element2}

3. **Bio/titre** (sur 100) :
   - Clarté de la promesse de valeur
   - Structure : qui tu aides + comment + résultat
   - Mots-clés pertinents pour le SEO
   - Personnalité qui transparaît

4. **Palette de couleurs** (sur 100) :
   - Harmonie des couleurs (2-3 couleurs max recommandé)
   - Cohérence entre ${criteria.colorContext}
   - Contraste suffisant pour la lisibilité
   - Couleurs qui évoquent les bonnes émotions pour le secteur

5. **Typographie & Design** (sur 100) :
   - Lisibilité des textes sur les visuels
   - Cohérence des polices utilisées
   - Hiérarchie visuelle claire
   - Qualité professionnelle vs amateur

6. **Branding & Reconnaissance** (sur 100) :
   - Style visuel reconnaissable au premier coup d'œil
   - Éléments récurrents (logo, couleurs, style photo)
   - Différenciation par rapport aux concurrents
   - Mémorabilité de l'identité visuelle

7. **Storytelling & Personnalité** (sur 100) :
   - Ton de voix cohérent et distinctif
   - Histoire personnelle qui transparaît
   - Connexion émotionnelle potentielle
   - Authenticité perçue
${postImages.length > 0 ? `
8. **Posts analysés** (sur 100) :
   - Qualité des accroches (premiers mots)
   - Structure narrative des posts
   - Cohérence visuelle entre les posts
   - Potentiel d'engagement` : ''}

Réponds UNIQUEMENT avec un JSON valide (sans markdown) dans ce format exact :
{
  "globalScore": <moyenne des scores>,
  "summary": {
    "message": "<résumé en 2-3 phrases de l'impression générale, comme si tu parlais directement à la personne>"
  },
  "analysis": {
    "photo": { "score": <0-100>, "feedback": "<commentaire détaillé et constructif>" },
    "${element2Key}": { "score": <0-100>, "feedback": "<commentaire détaillé et constructif>" },
    "bio": { "score": <0-100>, "feedback": "<commentaire détaillé et constructif>" },
    "colors": { "score": <0-100>, "feedback": "<analyse de la palette de couleurs>" },
    "typography": { "score": <0-100>, "feedback": "<analyse typo et design>" },
    "branding": { "score": <0-100>, "feedback": "<analyse identité visuelle>" },
    "storytelling": { "score": <0-100>, "feedback": "<analyse ton et personnalité>" }${postImages.length > 0 ? ',\n    "posts": { "score": <0-100>, "feedback": "<analyse des posts>" }' : ''}
  },
  "colorPalette": {
    "detected": ["<couleur1>", "<couleur2>", "<couleur3>"],
    "harmony": "<harmonieuse|discordante|à améliorer>",
    "suggestion": "<suggestion de palette si nécessaire>"
  },
  "recommendations": [
    "<action prioritaire 1 - la plus urgente>",
    "<action prioritaire 2>",
    "<action prioritaire 3>",
    "<action prioritaire 4>",
    "<action prioritaire 5>"
  ],
  "quickWins": [
    "<amélioration rapide qui peut être faite en 5 min>",
    "<amélioration rapide 2>"
  ]
}`;

    messageContent.push({
      type: "text",
      text: analysisPrompt
    });

    // Appel Claude Vision API
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: messageContent
        }]
      })
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude Vision Error:', errorText);
      return jsonResponse({ error: 'Erreur analyse IA' }, 503, corsHeaders);
    }

    const data = await claudeResponse.json();
    const responseText = data.content[0].text;

    // Parser le JSON de la réponse
    let auditResult;
    try {
      // Nettoyer le texte (au cas où Claude ajoute du markdown)
      const cleanedText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      auditResult = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError, responseText);
      // Fallback si le parsing échoue
      auditResult = {
        globalScore: 70,
        summary: { message: responseText.substring(0, 500) },
        analysis: {},
        recommendations: ["Améliore ta photo de profil", "Clarifie ta bio", "Soigne ta bannière"]
      };
    }

    return jsonResponse(auditResult, 200, corsHeaders);

  } catch (error) {
    console.error('Visual Audit Error:', error);
    return jsonResponse({ error: 'Erreur interne' }, 500, corsHeaders);
  }
}

// ============================================================
// VIDEO AUDIT - Analyse de Reels/vidéos avec Google Gemini
// ============================================================

async function handleVideoAudit(request, env, corsHeaders) {
  try {
    // Vérifier que la clé Gemini est configurée
    if (!env.GEMINI_API_KEY) {
      return jsonResponse({ error: 'Gemini API key not configured' }, 500, corsHeaders);
    }

    const body = await request.json();
    const { platform, videoData, videoMimeType = 'video/mp4', keywords = [] } = body;

    if (!videoData) {
      return jsonResponse({ error: 'Video data required' }, 400, corsHeaders);
    }

    // Extraire les données base64 si format data URL
    let base64Data = videoData;
    let mimeType = videoMimeType;

    const dataUrlMatch = videoData.match(/^data:(video\/\w+);base64,(.+)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      base64Data = dataUrlMatch[2];
    }

    // Noms des plateformes
    const platformNames = {
      instagram: 'Instagram Reel',
      tiktok: 'TikTok',
      youtube: 'YouTube Short',
      linkedin: 'LinkedIn Video'
    };

    const keywordsContext = keywords.length > 0
      ? `\nLe créateur travaille dans le domaine : ${keywords.join(', ')}`
      : '';

    // Prompt d'analyse vidéo
    const videoAnalysisPrompt = `Tu es un expert en création de contenu vidéo court (Reels, TikTok, Shorts) et en personal branding.

Analyse cette vidéo ${platformNames[platform] || 'courte'}.${keywordsContext}

Évalue les critères suivants avec une note sur 100 :

1. **Hook (3 premières secondes)** : Accroche-t-il l'attention immédiatement ? Y a-t-il un élément visuel ou textuel percutant ?
2. **Rythme/Pacing** : Le montage est-il dynamique ? Y a-t-il des temps morts ? La durée est-elle optimale ?
3. **Audio** : Qualité du son, choix de la musique, voix off claire ?
4. **Textes à l'écran** : Lisibilité, timing d'apparition, valeur ajoutée ?
5. **Structure narrative** : Y a-t-il une intro, un développement, une conclusion/CTA ?
6. **Qualité visuelle** : Éclairage, cadrage, stabilité, résolution ?
7. **Engagement potentiel** : Donne-t-il envie de liker, commenter, partager, suivre ?

Réponds UNIQUEMENT avec un JSON valide (sans markdown) dans ce format exact :
{
  "globalScore": <moyenne des scores>,
  "summary": {
    "message": "<résumé en 2-3 phrases de l'impression générale>"
  },
  "analysis": {
    "hook": { "score": <0-100>, "feedback": "<commentaire sur les 3 premières secondes>" },
    "pacing": { "score": <0-100>, "feedback": "<commentaire sur le rythme>" },
    "audio": { "score": <0-100>, "feedback": "<commentaire sur l'audio>" },
    "text": { "score": <0-100>, "feedback": "<commentaire sur les textes>" },
    "structure": { "score": <0-100>, "feedback": "<commentaire sur la structure>" },
    "visual": { "score": <0-100>, "feedback": "<commentaire sur la qualité visuelle>" },
    "engagement": { "score": <0-100>, "feedback": "<commentaire sur le potentiel viral>" }
  },
  "recommendations": [
    "<action prioritaire 1>",
    "<action prioritaire 2>",
    "<action prioritaire 3>"
  ],
  "optimalDuration": "<durée recommandée pour ce type de contenu>",
  "viralPotential": "<faible|moyen|élevé|très élevé>"
}`;

    // Appel Gemini API avec la vidéo
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              },
              {
                text: videoAnalysisPrompt
              }
            ]
          }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2000
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API Error:', errorText);
      return jsonResponse({ error: 'Erreur analyse vidéo', details: errorText }, 503, corsHeaders);
    }

    const geminiData = await geminiResponse.json();

    // Extraire le texte de la réponse Gemini
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      return jsonResponse({ error: 'Réponse vide de Gemini' }, 500, corsHeaders);
    }

    // Parser le JSON
    let auditResult;
    try {
      const cleanedText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      auditResult = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError, responseText);
      auditResult = {
        globalScore: 70,
        summary: { message: responseText.substring(0, 500) },
        analysis: {},
        recommendations: ["Améliore ton hook", "Ajoute des sous-titres", "Optimise la durée"],
        viralPotential: "moyen"
      };
    }

    return jsonResponse(auditResult, 200, corsHeaders);

  } catch (error) {
    console.error('Video Audit Error:', error);
    return jsonResponse({ error: 'Erreur interne' }, 500, corsHeaders);
  }
}

// Calcule le nombre de combinaisons possibles dans un texte spintax
function calculateSpintaxCombinations(text) {
  const regex = /\{([^{}]+)\}/g;
  let combinations = 1;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const options = match[1].split('|').length;
    combinations *= options;
  }

  return combinations;
}

// Fonction pour "dérouler" un spintax en une version aléatoire
function spinText(spintaxText) {
  return spintaxText.replace(/\{([^{}]+)\}/g, (match, options) => {
    const choices = options.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

// ============================================================
// COLLABORATION APIs - Workspaces, Invitations, Comments, Notifications
// ============================================================

// ============ WORKSPACES API ============

async function handleWorkspacesAPI(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);
  if (!user) return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/workspaces', '');

  try {
    switch (true) {
      // GET /api/workspaces - Liste des workspaces de l'utilisateur
      case path === '' && request.method === 'GET':
        return await handleListWorkspaces(env, user, corsHeaders);

      // POST /api/workspaces - Créer un workspace
      case path === '' && request.method === 'POST':
        return await handleCreateWorkspace(request, env, user, corsHeaders);

      // GET /api/workspaces/:id - Détails du workspace
      case /^\/[a-f0-9-]+$/.test(path) && request.method === 'GET':
        return await handleGetWorkspace(path.slice(1), env, user, corsHeaders);

      // PUT /api/workspaces/:id - Modifier le workspace
      case /^\/[a-f0-9-]+$/.test(path) && request.method === 'PUT':
        return await handleUpdateWorkspace(path.slice(1), request, env, user, corsHeaders);

      // GET /api/workspaces/:id/members - Liste des membres
      case /^\/[a-f0-9-]+\/members$/.test(path) && request.method === 'GET':
        return await handleListMembers(path.replace('/members', '').slice(1), env, user, corsHeaders);

      // PUT /api/workspaces/:id/members/:mid - Modifier un membre
      case /^\/[a-f0-9-]+\/members\/[a-f0-9-]+$/.test(path) && request.method === 'PUT':
        return await handleUpdateMember(path, request, env, user, corsHeaders);

      // DELETE /api/workspaces/:id/members/:mid - Retirer un membre
      case /^\/[a-f0-9-]+\/members\/[a-f0-9-]+$/.test(path) && request.method === 'DELETE':
        return await handleRemoveMember(path, env, user, corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Workspaces API Error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

async function handleListWorkspaces(env, user, corsHeaders) {
  // Récupérer les workspaces où l'utilisateur est membre actif
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspace_members?user_id=eq.${user.id}&status=eq.active&select=workspace_id,role,joined_at,workspaces(id,name,slug,logo_url,owner_id,max_members,max_clients)`,
    { headers: supabaseHeaders(env) }
  );

  const memberships = await response.json();

  const workspaces = memberships.map(m => ({
    ...m.workspaces,
    role: m.role,
    joined_at: m.joined_at,
    is_owner: m.workspaces.owner_id === user.id
  }));

  return jsonResponse({ workspaces }, 200, corsHeaders);
}

async function handleCreateWorkspace(request, env, user, corsHeaders) {
  const body = await request.json();
  const { name } = body;

  if (!name || name.trim().length < 2) {
    return jsonResponse({ error: 'Workspace name required (min 2 chars)' }, 400, corsHeaders);
  }

  // Générer un slug unique
  const slug = 'ws-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20) + '-' + Date.now().toString(36);

  // Récupérer le plan de l'utilisateur pour les limites
  const userResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=plan`,
    { headers: supabaseHeaders(env) }
  );
  const userData = await userResponse.json();
  const plan = userData[0]?.plan || 'solo';

  // Définir les limites selon le plan
  let maxMembers = 1, maxClients = 5;
  switch (plan) {
    case 'enterprise': maxMembers = 100; maxClients = 1000; break;
    case 'agency_scale': maxMembers = 15; maxClients = 30; break;
    case 'agency_starter': maxMembers = 5; maxClients = 10; break;
  }

  // Créer le workspace
  const createResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspaces`,
    {
      method: 'POST',
      headers: { ...supabaseHeaders(env), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        name: name.trim(),
        slug,
        owner_id: user.id,
        max_members: maxMembers,
        max_clients: maxClients
      })
    }
  );

  const workspaces = await createResponse.json();
  if (!workspaces.length) {
    return jsonResponse({ error: 'Failed to create workspace' }, 500, corsHeaders);
  }

  const workspace = workspaces[0];

  // Ajouter le créateur comme admin
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspace_members`,
    {
      method: 'POST',
      headers: supabaseHeaders(env),
      body: JSON.stringify({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'admin',
        status: 'active'
      })
    }
  );

  return jsonResponse({ success: true, workspace }, 201, corsHeaders);
}

async function handleGetWorkspace(workspaceId, env, user, corsHeaders) {
  // Vérifier l'accès
  const accessCheck = await checkWorkspaceAccess(workspaceId, user.id, env);
  if (!accessCheck.hasAccess) {
    return jsonResponse({ error: 'Access denied' }, 403, corsHeaders);
  }

  // Récupérer les détails du workspace avec statistiques
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspaces?id=eq.${workspaceId}&select=*`,
    { headers: supabaseHeaders(env) }
  );

  const workspaces = await response.json();
  if (!workspaces.length) {
    return jsonResponse({ error: 'Workspace not found' }, 404, corsHeaders);
  }

  const workspace = workspaces[0];

  // Compter les membres et clients
  const [membersRes, clientsRes] = await Promise.all([
    fetch(`${env.SUPABASE_URL}/rest/v1/workspace_members?workspace_id=eq.${workspaceId}&status=eq.active&select=id`, { headers: supabaseHeaders(env) }),
    fetch(`${env.SUPABASE_URL}/rest/v1/clients?workspace_id=eq.${workspaceId}&select=id`, { headers: supabaseHeaders(env) })
  ]);

  const members = await membersRes.json();
  const clients = await clientsRes.json();

  return jsonResponse({
    workspace: {
      ...workspace,
      member_count: members.length,
      client_count: clients.length,
      user_role: accessCheck.role
    }
  }, 200, corsHeaders);
}

async function handleUpdateWorkspace(workspaceId, request, env, user, corsHeaders) {
  // Vérifier l'accès admin
  const accessCheck = await checkWorkspaceAccess(workspaceId, user.id, env);
  if (!accessCheck.hasAccess || accessCheck.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403, corsHeaders);
  }

  const body = await request.json();
  const allowed = ['name', 'logo_url', 'settings'];
  const updates = {};
  for (const field of allowed) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  updates.updated_at = new Date().toISOString();

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspaces?id=eq.${workspaceId}`,
    {
      method: 'PATCH',
      headers: { ...supabaseHeaders(env), 'Prefer': 'return=representation' },
      body: JSON.stringify(updates)
    }
  );

  const workspaces = await response.json();
  return jsonResponse({ success: true, workspace: workspaces[0] }, 200, corsHeaders);
}

async function handleListMembers(workspaceId, env, user, corsHeaders) {
  // Vérifier l'accès
  const accessCheck = await checkWorkspaceAccess(workspaceId, user.id, env);
  if (!accessCheck.hasAccess) {
    return jsonResponse({ error: 'Access denied' }, 403, corsHeaders);
  }

  // Récupérer les membres avec infos utilisateur
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspace_members?workspace_id=eq.${workspaceId}&status=eq.active&select=id,user_id,role,assigned_clients,joined_at,last_active_at`,
    { headers: supabaseHeaders(env) }
  );

  const members = await response.json();

  // Récupérer les infos des utilisateurs
  const userIds = members.map(m => m.user_id);
  if (userIds.length) {
    const usersResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/users?id=in.(${userIds.join(',')})&select=id,email,name`,
      { headers: supabaseHeaders(env) }
    );
    const users = await usersResponse.json();

    // Merger les données
    const userMap = {};
    users.forEach(u => userMap[u.id] = u);

    members.forEach(m => {
      m.user = userMap[m.user_id] || { email: 'Unknown' };
    });
  }

  return jsonResponse({ members }, 200, corsHeaders);
}

async function handleUpdateMember(path, request, env, user, corsHeaders) {
  const parts = path.split('/');
  const workspaceId = parts[1];
  const memberId = parts[3];

  // Vérifier l'accès admin
  const accessCheck = await checkWorkspaceAccess(workspaceId, user.id, env);
  if (!accessCheck.hasAccess || accessCheck.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403, corsHeaders);
  }

  const body = await request.json();
  const allowed = ['role', 'assigned_clients'];
  const updates = {};
  for (const field of allowed) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspace_members?id=eq.${memberId}&workspace_id=eq.${workspaceId}`,
    {
      method: 'PATCH',
      headers: { ...supabaseHeaders(env), 'Prefer': 'return=representation' },
      body: JSON.stringify(updates)
    }
  );

  const members = await response.json();
  if (!members.length) {
    return jsonResponse({ error: 'Member not found' }, 404, corsHeaders);
  }

  // Créer notification si le rôle a changé
  if (body.role) {
    await createNotification(env, {
      user_id: members[0].user_id,
      workspace_id: workspaceId,
      type: 'role_changed',
      title: `Ton rôle a été modifié`,
      body: `Tu es maintenant ${body.role === 'admin' ? 'Admin' : 'Membre'}`,
      data: { role: body.role }
    });
  }

  return jsonResponse({ success: true, member: members[0] }, 200, corsHeaders);
}

async function handleRemoveMember(path, env, user, corsHeaders) {
  const parts = path.split('/');
  const workspaceId = parts[1];
  const memberId = parts[3];

  // Vérifier l'accès admin
  const accessCheck = await checkWorkspaceAccess(workspaceId, user.id, env);
  if (!accessCheck.hasAccess || accessCheck.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403, corsHeaders);
  }

  // Récupérer le membre pour notification
  const memberRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspace_members?id=eq.${memberId}&workspace_id=eq.${workspaceId}&select=user_id`,
    { headers: supabaseHeaders(env) }
  );
  const memberData = await memberRes.json();

  if (!memberData.length) {
    return jsonResponse({ error: 'Member not found' }, 404, corsHeaders);
  }

  // Mettre à jour le statut au lieu de supprimer
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspace_members?id=eq.${memberId}&workspace_id=eq.${workspaceId}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(env),
      body: JSON.stringify({ status: 'left' })
    }
  );

  // Notifier le membre retiré
  await createNotification(env, {
    user_id: memberData[0].user_id,
    workspace_id: workspaceId,
    type: 'member_removed',
    title: `Tu as été retiré d'un workspace`,
    body: 'Un admin t\'a retiré de l\'équipe'
  });

  return jsonResponse({ success: true }, 200, corsHeaders);
}

// ============ INVITATIONS API ============

async function handleInvitationsAPI(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/invitations', '');

  // Accept invitation est public (pas d'auth requise)
  if (path === '/accept' && request.method === 'GET') {
    return await handleAcceptInvitation(url, env, corsHeaders);
  }

  // Autres endpoints nécessitent auth
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);
  if (!user) return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);

  try {
    switch (true) {
      // POST /api/invitations - Envoyer invitation
      case path === '' && request.method === 'POST':
        return await handleSendInvitation(request, env, user, corsHeaders);

      // GET /api/invitations/pending?workspace_id=xxx
      case path === '/pending' && request.method === 'GET':
        return await handleListPendingInvitations(url, env, user, corsHeaders);

      // POST /api/invitations/:id/revoke
      case /^\/[a-f0-9-]+\/revoke$/.test(path) && request.method === 'POST':
        return await handleRevokeInvitation(path.replace('/revoke', '').slice(1), env, user, corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Invitations API Error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

async function handleSendInvitation(request, env, user, corsHeaders) {
  const body = await request.json();
  const { workspace_id, email, role = 'member', assigned_clients } = body;

  if (!workspace_id || !email) {
    return jsonResponse({ error: 'workspace_id and email required' }, 400, corsHeaders);
  }

  // Vérifier l'accès admin
  const accessCheck = await checkWorkspaceAccess(workspace_id, user.id, env);
  if (!accessCheck.hasAccess || accessCheck.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403, corsHeaders);
  }

  // Vérifier la limite de membres
  const workspaceRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspaces?id=eq.${workspace_id}&select=name,max_members`,
    { headers: supabaseHeaders(env) }
  );
  const wsData = await workspaceRes.json();
  const workspace = wsData[0];

  const membersRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspace_members?workspace_id=eq.${workspace_id}&status=eq.active&select=id`,
    { headers: supabaseHeaders(env) }
  );
  const currentMembers = await membersRes.json();

  if (currentMembers.length >= workspace.max_members) {
    return jsonResponse({ error: `Limite de ${workspace.max_members} membres atteinte. Passe à un plan supérieur.` }, 400, corsHeaders);
  }

  // Vérifier si l'email est déjà membre
  const existingMemberRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/users?email=eq.${email.toLowerCase()}&select=id`,
    { headers: supabaseHeaders(env) }
  );
  const existingUser = await existingMemberRes.json();

  if (existingUser.length) {
    const alreadyMemberRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/workspace_members?workspace_id=eq.${workspace_id}&user_id=eq.${existingUser[0].id}&status=eq.active&select=id`,
      { headers: supabaseHeaders(env) }
    );
    const alreadyMember = await alreadyMemberRes.json();
    if (alreadyMember.length) {
      return jsonResponse({ error: 'Cet utilisateur est déjà membre' }, 400, corsHeaders);
    }
  }

  // Générer token sécurisé
  const token = crypto.randomUUID() + '-' + Date.now().toString(36);
  const tokenHash = await hashSHA256(token);

  // Créer l'invitation
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspace_invitations`,
    {
      method: 'POST',
      headers: supabaseHeaders(env),
      body: JSON.stringify({
        workspace_id,
        email: email.toLowerCase(),
        role,
        assigned_clients,
        token_hash: tokenHash,
        invited_by: user.id
      })
    }
  );

  // Envoyer l'email via Brevo
  const magicLink = `https://sosstorytelling.fr/join?token=${token}`;

  // Récupérer le nom de l'inviteur
  const inviterRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=name,email`,
    { headers: supabaseHeaders(env) }
  );
  const inviterData = await inviterRes.json();
  const inviterName = inviterData[0]?.name || inviterData[0]?.email || 'Un utilisateur';

  await sendInvitationEmail(env, {
    to: email,
    inviterName,
    workspaceName: workspace.name,
    magicLink,
    role
  });

  return jsonResponse({ success: true, message: 'Invitation envoyée' }, 200, corsHeaders);
}

async function handleAcceptInvitation(url, env, corsHeaders) {
  const token = url.searchParams.get('token');

  if (!token) {
    return jsonResponse({ error: 'Token required' }, 400, corsHeaders);
  }

  const tokenHash = await hashSHA256(token);

  // Chercher l'invitation
  const inviteRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspace_invitations?token_hash=eq.${tokenHash}&status=eq.pending&select=*`,
    { headers: supabaseHeaders(env) }
  );
  const invitations = await inviteRes.json();

  if (!invitations.length) {
    return jsonResponse({ error: 'Invitation invalide ou expirée' }, 404, corsHeaders);
  }

  const invitation = invitations[0];

  // Vérifier expiration
  if (new Date(invitation.expires_at) < new Date()) {
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/workspace_invitations?id=eq.${invitation.id}`,
      {
        method: 'PATCH',
        headers: supabaseHeaders(env),
        body: JSON.stringify({ status: 'expired' })
      }
    );
    return jsonResponse({ error: 'Invitation expirée' }, 400, corsHeaders);
  }

  // Retourner les infos pour que le frontend puisse finaliser
  // (l'utilisateur doit être connecté pour accepter)
  const workspaceRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspaces?id=eq.${invitation.workspace_id}&select=name,logo_url`,
    { headers: supabaseHeaders(env) }
  );
  const workspaces = await workspaceRes.json();

  return jsonResponse({
    invitation: {
      id: invitation.id,
      workspace_id: invitation.workspace_id,
      workspace_name: workspaces[0]?.name,
      workspace_logo: workspaces[0]?.logo_url,
      role: invitation.role,
      email: invitation.email
    }
  }, 200, corsHeaders);
}

async function handleListPendingInvitations(url, env, user, corsHeaders) {
  const workspaceId = url.searchParams.get('workspace_id');

  if (!workspaceId) {
    return jsonResponse({ error: 'workspace_id required' }, 400, corsHeaders);
  }

  // Vérifier l'accès admin
  const accessCheck = await checkWorkspaceAccess(workspaceId, user.id, env);
  if (!accessCheck.hasAccess || accessCheck.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403, corsHeaders);
  }

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspace_invitations?workspace_id=eq.${workspaceId}&status=eq.pending&select=*&order=created_at.desc`,
    { headers: supabaseHeaders(env) }
  );

  const invitations = await response.json();
  return jsonResponse({ invitations }, 200, corsHeaders);
}

async function handleRevokeInvitation(invitationId, env, user, corsHeaders) {
  // Récupérer l'invitation pour vérifier le workspace
  const inviteRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspace_invitations?id=eq.${invitationId}&select=workspace_id`,
    { headers: supabaseHeaders(env) }
  );
  const invitations = await inviteRes.json();

  if (!invitations.length) {
    return jsonResponse({ error: 'Invitation not found' }, 404, corsHeaders);
  }

  // Vérifier l'accès admin
  const accessCheck = await checkWorkspaceAccess(invitations[0].workspace_id, user.id, env);
  if (!accessCheck.hasAccess || accessCheck.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403, corsHeaders);
  }

  await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspace_invitations?id=eq.${invitationId}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(env),
      body: JSON.stringify({ status: 'revoked' })
    }
  );

  return jsonResponse({ success: true }, 200, corsHeaders);
}

// ============ COMMENTS API ============

async function handleCommentsAPI(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);
  if (!user) return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/comments', '');

  try {
    switch (true) {
      // GET /api/comments?content_type=x&content_id=y
      case path === '' && request.method === 'GET':
        return await handleListComments(url, env, user, corsHeaders);

      // POST /api/comments
      case path === '' && request.method === 'POST':
        return await handleAddComment(request, env, user, corsHeaders);

      // POST /api/comments/:id/resolve
      case /^\/[a-f0-9-]+\/resolve$/.test(path) && request.method === 'POST':
        return await handleResolveComment(path.replace('/resolve', '').slice(1), env, user, corsHeaders);

      // DELETE /api/comments/:id
      case /^\/[a-f0-9-]+$/.test(path) && request.method === 'DELETE':
        return await handleDeleteComment(path.slice(1), env, user, corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Comments API Error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

async function handleListComments(url, env, user, corsHeaders) {
  const contentType = url.searchParams.get('content_type');
  const contentId = url.searchParams.get('content_id');
  const workspaceId = url.searchParams.get('workspace_id');

  if (!contentType || !contentId) {
    return jsonResponse({ error: 'content_type and content_id required' }, 400, corsHeaders);
  }

  // Vérifier l'accès au workspace si fourni
  if (workspaceId) {
    const accessCheck = await checkWorkspaceAccess(workspaceId, user.id, env);
    if (!accessCheck.hasAccess) {
      return jsonResponse({ error: 'Access denied' }, 403, corsHeaders);
    }
  }

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/comments?content_type=eq.${contentType}&content_id=eq.${contentId}&order=created_at.asc&select=*`,
    { headers: supabaseHeaders(env) }
  );

  const comments = await response.json();

  // Récupérer les infos utilisateurs
  const userIds = [...new Set(comments.map(c => c.user_id))];
  if (userIds.length) {
    const usersRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/users?id=in.(${userIds.join(',')})&select=id,name,email`,
      { headers: supabaseHeaders(env) }
    );
    const users = await usersRes.json();
    const userMap = {};
    users.forEach(u => userMap[u.id] = u);

    comments.forEach(c => {
      c.user = userMap[c.user_id] || { name: 'Unknown' };
    });
  }

  // Organiser en threads
  const rootComments = comments.filter(c => !c.parent_id);
  rootComments.forEach(root => {
    root.replies = comments.filter(c => c.parent_id === root.id);
  });

  return jsonResponse({ comments: rootComments }, 200, corsHeaders);
}

async function handleAddComment(request, env, user, corsHeaders) {
  const body = await request.json();
  const { workspace_id, content_type, content_id, body: commentBody, parent_id } = body;

  if (!workspace_id || !content_type || !content_id || !commentBody) {
    return jsonResponse({ error: 'workspace_id, content_type, content_id and body required' }, 400, corsHeaders);
  }

  // Vérifier l'accès au workspace
  const accessCheck = await checkWorkspaceAccess(workspace_id, user.id, env);
  if (!accessCheck.hasAccess) {
    return jsonResponse({ error: 'Access denied' }, 403, corsHeaders);
  }

  // Créer le commentaire
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/comments`,
    {
      method: 'POST',
      headers: { ...supabaseHeaders(env), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        workspace_id,
        content_type,
        content_id,
        user_id: user.id,
        body: commentBody,
        parent_id
      })
    }
  );

  const comments = await response.json();
  const comment = comments[0];

  // Créer des notifications pour les autres membres du workspace
  await createCommentNotifications(env, comment, user, workspace_id);

  return jsonResponse({ success: true, comment }, 201, corsHeaders);
}

async function handleResolveComment(commentId, env, user, corsHeaders) {
  // Récupérer le commentaire
  const commentRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/comments?id=eq.${commentId}&select=*`,
    { headers: supabaseHeaders(env) }
  );
  const comments = await commentRes.json();

  if (!comments.length) {
    return jsonResponse({ error: 'Comment not found' }, 404, corsHeaders);
  }

  const comment = comments[0];

  // Vérifier l'accès
  const accessCheck = await checkWorkspaceAccess(comment.workspace_id, user.id, env);
  if (!accessCheck.hasAccess) {
    return jsonResponse({ error: 'Access denied' }, 403, corsHeaders);
  }

  // Résoudre le commentaire
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/comments?id=eq.${commentId}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(env),
      body: JSON.stringify({
        status: 'resolved',
        resolved_by: user.id,
        resolved_at: new Date().toISOString()
      })
    }
  );

  // Notifier l'auteur du commentaire
  if (comment.user_id !== user.id) {
    await createNotification(env, {
      user_id: comment.user_id,
      workspace_id: comment.workspace_id,
      type: 'comment_resolved',
      title: 'Ton commentaire a été résolu',
      body: commentBody.slice(0, 50) + '...',
      data: { comment_id: commentId, content_type: comment.content_type, content_id: comment.content_id }
    });
  }

  return jsonResponse({ success: true }, 200, corsHeaders);
}

async function handleDeleteComment(commentId, env, user, corsHeaders) {
  // Récupérer le commentaire
  const commentRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/comments?id=eq.${commentId}&select=*`,
    { headers: supabaseHeaders(env) }
  );
  const comments = await commentRes.json();

  if (!comments.length) {
    return jsonResponse({ error: 'Comment not found' }, 404, corsHeaders);
  }

  const comment = comments[0];

  // Vérifier que c'est l'auteur ou un admin
  const accessCheck = await checkWorkspaceAccess(comment.workspace_id, user.id, env);
  if (comment.user_id !== user.id && accessCheck.role !== 'admin') {
    return jsonResponse({ error: 'Not authorized' }, 403, corsHeaders);
  }

  await fetch(
    `${env.SUPABASE_URL}/rest/v1/comments?id=eq.${commentId}`,
    { method: 'DELETE', headers: supabaseHeaders(env) }
  );

  return jsonResponse({ success: true }, 200, corsHeaders);
}

// ============ NOTIFICATIONS API ============

async function handleNotificationsAPI(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);
  if (!user) return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/notifications', '');

  try {
    switch (true) {
      // GET /api/notifications
      case path === '' && request.method === 'GET':
        return await handleListNotifications(url, env, user, corsHeaders);

      // GET /api/notifications/unread-count
      case path === '/unread-count' && request.method === 'GET':
        return await handleUnreadCount(env, user, corsHeaders);

      // POST /api/notifications/mark-read
      case path === '/mark-read' && request.method === 'POST':
        return await handleMarkRead(request, env, user, corsHeaders);

      // POST /api/notifications/mark-all-read
      case path === '/mark-all-read' && request.method === 'POST':
        return await handleMarkAllRead(env, user, corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Notifications API Error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

async function handleListNotifications(url, env, user, corsHeaders) {
  const limit = parseInt(url.searchParams.get('limit')) || 20;
  const offset = parseInt(url.searchParams.get('offset')) || 0;

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&order=created_at.desc&limit=${limit}&offset=${offset}&select=*`,
    { headers: supabaseHeaders(env) }
  );

  const notifications = await response.json();
  return jsonResponse({ notifications }, 200, corsHeaders);
}

async function handleUnreadCount(env, user, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&is_read=eq.false&select=id`,
    { headers: supabaseHeaders(env) }
  );

  const notifications = await response.json();
  return jsonResponse({ count: notifications.length }, 200, corsHeaders);
}

async function handleMarkRead(request, env, user, corsHeaders) {
  const body = await request.json();
  const { notification_ids } = body;

  if (!notification_ids || !notification_ids.length) {
    return jsonResponse({ error: 'notification_ids required' }, 400, corsHeaders);
  }

  await fetch(
    `${env.SUPABASE_URL}/rest/v1/notifications?id=in.(${notification_ids.join(',')})&user_id=eq.${user.id}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(env),
      body: JSON.stringify({ is_read: true, read_at: new Date().toISOString() })
    }
  );

  return jsonResponse({ success: true }, 200, corsHeaders);
}

async function handleMarkAllRead(env, user, corsHeaders) {
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&is_read=eq.false`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(env),
      body: JSON.stringify({ is_read: true, read_at: new Date().toISOString() })
    }
  );

  return jsonResponse({ success: true }, 200, corsHeaders);
}


// ============ SENDER EMAILS API (Multi-adresses Cold Email 2026) ============

async function handleSenderEmailsAPI(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);
  if (!user) return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/sender-emails', '');

  try {
    switch (true) {
      // GET /api/sender-emails - Liste des adresses
      case path === '' && request.method === 'GET':
        return await handleListSenderEmails(env, user, corsHeaders);

      // POST /api/sender-emails - Ajouter une adresse
      case path === '' && request.method === 'POST':
        return await handleAddSenderEmail(request, env, user, corsHeaders);

      // PUT /api/sender-emails/:id - Modifier une adresse
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'PUT':
        return await handleUpdateSenderEmail(request, env, user, path.slice(1), corsHeaders);

      // DELETE /api/sender-emails/:id - Supprimer une adresse
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'DELETE':
        return await handleDeleteSenderEmail(env, user, path.slice(1), corsHeaders);

      // GET /api/sender-emails/stats - Stats d'envoi du jour
      case path === '/stats' && request.method === 'GET':
        return await handleSenderEmailStats(env, user, corsHeaders);

      // POST /api/sender-emails/next - Obtenir la prochaine adresse disponible
      case path === '/next' && request.method === 'POST':
        return await handleGetNextSender(env, user, corsHeaders);

      // POST /api/sender-emails/:id/reset - Reset le compteur (admin)
      case path.match(/^\/[a-f0-9-]+\/reset$/) && request.method === 'POST':
        return await handleResetSenderCounter(env, user, path.split('/')[1], corsHeaders);

      // POST /api/sender-emails/check-prospect - Vérifier si on peut envoyer à un prospect
      case path === '/check-prospect' && request.method === 'POST':
        return await handleCheckProspect(request, env, user, corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Sender Emails API Error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

// Liste toutes les adresses email de l'utilisateur
async function handleListSenderEmails(env, user, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/sender_emails?user_id=eq.${user.id}&order=created_at.asc&select=*`,
    { headers: supabaseHeaders(env) }
  );

  const senders = await response.json();

  // Calculer les stats agrégées
  const stats = {
    total_senders: senders.length,
    active_senders: senders.filter(s => s.is_active).length,
    total_available_today: senders.reduce((sum, s) => {
      const limit = s.warmup_enabled ? s.warmup_current_limit : s.daily_limit;
      return sum + limit;
    }, 0),
    total_sent_today: senders.reduce((sum, s) => sum + (s.emails_sent_today || 0), 0),
    total_remaining_today: senders.reduce((sum, s) => {
      const limit = s.warmup_enabled ? s.warmup_current_limit : s.daily_limit;
      return sum + Math.max(0, limit - (s.emails_sent_today || 0));
    }, 0)
  };

  return jsonResponse({ senders, stats }, 200, corsHeaders);
}

// Ajouter une nouvelle adresse email
async function handleAddSenderEmail(request, env, user, corsHeaders) {
  const body = await request.json();
  const { email, display_name, reply_to, daily_limit = 20, warmup_enabled = true } = body;

  if (!email) {
    return jsonResponse({ error: 'Email requis' }, 400, corsHeaders);
  }

  // Vérifier le format email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return jsonResponse({ error: 'Format email invalide' }, 400, corsHeaders);
  }

  // Vérifier si l'email existe déjà
  const existingResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/sender_emails?user_id=eq.${user.id}&email=eq.${encodeURIComponent(email)}&select=id`,
    { headers: supabaseHeaders(env) }
  );
  const existing = await existingResponse.json();

  if (existing.length > 0) {
    return jsonResponse({ error: 'Cette adresse email existe déjà' }, 409, corsHeaders);
  }

  // Créer l'adresse
  const senderData = {
    user_id: user.id,
    email: email.toLowerCase().trim(),
    display_name: display_name || email.split('@')[0],
    reply_to: reply_to || email,
    daily_limit: Math.min(daily_limit, 50), // Max 50 par sécurité
    warmup_enabled,
    warmup_current_limit: warmup_enabled ? 5 : daily_limit,
    warmup_started_at: warmup_enabled ? new Date().toISOString() : null
  };

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/sender_emails`,
    {
      method: 'POST',
      headers: { ...supabaseHeaders(env), 'Prefer': 'return=representation' },
      body: JSON.stringify(senderData)
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return jsonResponse({ error: 'Erreur création: ' + error }, 500, corsHeaders);
  }

  const sender = await response.json();
  return jsonResponse({ sender: sender[0], message: 'Adresse ajoutée avec succès' }, 201, corsHeaders);
}

// Modifier une adresse email
async function handleUpdateSenderEmail(request, env, user, senderId, corsHeaders) {
  const body = await request.json();
  const allowedFields = ['display_name', 'reply_to', 'daily_limit', 'warmup_enabled', 'is_active'];

  const updateData = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  // Si on active le warmup, reset le compteur
  if (body.warmup_enabled === true) {
    updateData.warmup_current_limit = 5;
    updateData.warmup_started_at = new Date().toISOString();
  }

  if (updateData.daily_limit) {
    updateData.daily_limit = Math.min(updateData.daily_limit, 50);
  }

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/sender_emails?id=eq.${senderId}&user_id=eq.${user.id}`,
    {
      method: 'PATCH',
      headers: { ...supabaseHeaders(env), 'Prefer': 'return=representation' },
      body: JSON.stringify(updateData)
    }
  );

  if (!response.ok) {
    return jsonResponse({ error: 'Erreur mise à jour' }, 500, corsHeaders);
  }

  const sender = await response.json();
  return jsonResponse({ sender: sender[0], message: 'Adresse mise à jour' }, 200, corsHeaders);
}

// Supprimer une adresse email
async function handleDeleteSenderEmail(env, user, senderId, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/sender_emails?id=eq.${senderId}&user_id=eq.${user.id}`,
    {
      method: 'DELETE',
      headers: supabaseHeaders(env)
    }
  );

  if (!response.ok) {
    return jsonResponse({ error: 'Erreur suppression' }, 500, corsHeaders);
  }

  return jsonResponse({ success: true, message: 'Adresse supprimée' }, 200, corsHeaders);
}

// Obtenir les stats d'envoi du jour
async function handleSenderEmailStats(env, user, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/sender_emails?user_id=eq.${user.id}&is_active=eq.true&select=id,email,display_name,daily_limit,warmup_enabled,warmup_current_limit,emails_sent_today,last_sent_at,health_score`,
    { headers: supabaseHeaders(env) }
  );

  const senders = await response.json();

  const stats = {
    senders: senders.map(s => ({
      ...s,
      effective_limit: s.warmup_enabled ? s.warmup_current_limit : s.daily_limit,
      remaining: Math.max(0, (s.warmup_enabled ? s.warmup_current_limit : s.daily_limit) - (s.emails_sent_today || 0)),
      at_limit: (s.emails_sent_today || 0) >= (s.warmup_enabled ? s.warmup_current_limit : s.daily_limit)
    })),
    totals: {
      total_limit: senders.reduce((sum, s) => sum + (s.warmup_enabled ? s.warmup_current_limit : s.daily_limit), 0),
      total_sent: senders.reduce((sum, s) => sum + (s.emails_sent_today || 0), 0),
      total_remaining: senders.reduce((sum, s) => {
        const limit = s.warmup_enabled ? s.warmup_current_limit : s.daily_limit;
        return sum + Math.max(0, limit - (s.emails_sent_today || 0));
      }, 0),
      senders_available: senders.filter(s => (s.emails_sent_today || 0) < (s.warmup_enabled ? s.warmup_current_limit : s.daily_limit)).length,
      senders_at_limit: senders.filter(s => (s.emails_sent_today || 0) >= (s.warmup_enabled ? s.warmup_current_limit : s.daily_limit)).length
    }
  };

  return jsonResponse(stats, 200, corsHeaders);
}

// Obtenir la prochaine adresse disponible (rotation)
async function handleGetNextSender(env, user, corsHeaders) {
  // Reset les compteurs si nouveau jour
  const today = new Date().toISOString().split('T')[0];

  // Récupérer toutes les adresses actives
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/sender_emails?user_id=eq.${user.id}&is_active=eq.true&health_score=gte.50&order=emails_sent_today.asc,health_score.desc&select=*`,
    { headers: supabaseHeaders(env) }
  );

  const senders = await response.json();

  if (senders.length === 0) {
    return jsonResponse({ error: 'Aucune adresse email configurée', available: false }, 404, corsHeaders);
  }

  // Trouver la première adresse qui n'a pas atteint sa limite
  for (const sender of senders) {
    // Reset si nouveau jour
    if (sender.last_reset_date !== today) {
      const newLimit = sender.warmup_enabled
        ? Math.min((sender.warmup_current_limit || 5) + (sender.warmup_increment || 3), sender.daily_limit)
        : sender.daily_limit;

      await fetch(
        `${env.SUPABASE_URL}/rest/v1/sender_emails?id=eq.${sender.id}`,
        {
          method: 'PATCH',
          headers: supabaseHeaders(env),
          body: JSON.stringify({
            emails_sent_today: 0,
            last_reset_date: today,
            warmup_current_limit: newLimit
          })
        }
      );

      sender.emails_sent_today = 0;
      sender.warmup_current_limit = newLimit;
    }

    const effectiveLimit = sender.warmup_enabled ? sender.warmup_current_limit : sender.daily_limit;

    if ((sender.emails_sent_today || 0) < effectiveLimit) {
      return jsonResponse({
        available: true,
        sender: {
          id: sender.id,
          email: sender.email,
          display_name: sender.display_name,
          reply_to: sender.reply_to
        },
        stats: {
          sent_today: sender.emails_sent_today || 0,
          limit: effectiveLimit,
          remaining: effectiveLimit - (sender.emails_sent_today || 0)
        }
      }, 200, corsHeaders);
    }
  }

  // Toutes les adresses sont à leur limite
  return jsonResponse({
    available: false,
    error: 'Toutes les adresses ont atteint leur limite quotidienne',
    next_reset: 'demain à minuit'
  }, 429, corsHeaders);
}

// Reset le compteur d'une adresse
async function handleResetSenderCounter(env, user, senderId, corsHeaders) {
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/sender_emails?id=eq.${senderId}&user_id=eq.${user.id}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(env),
      body: JSON.stringify({
        emails_sent_today: 0,
        last_reset_date: new Date().toISOString().split('T')[0]
      })
    }
  );

  return jsonResponse({ success: true, message: 'Compteur réinitialisé' }, 200, corsHeaders);
}

// Vérifier si on peut envoyer à un prospect (max 3 touchpoints)
async function handleCheckProspect(request, env, user, corsHeaders) {
  const body = await request.json();
  const { prospect_email, campaign_id } = body;

  if (!prospect_email) {
    return jsonResponse({ error: 'prospect_email requis' }, 400, corsHeaders);
  }

  // Compter les emails déjà envoyés à ce prospect
  let query = `${env.SUPABASE_URL}/rest/v1/email_send_log?user_id=eq.${user.id}&recipient_email=eq.${encodeURIComponent(prospect_email)}&status=not.in.(bounced,failed)&select=id,touchpoint_number,sent_at`;

  if (campaign_id) {
    query += `&campaign_id=eq.${campaign_id}`;
  }

  const response = await fetch(query, { headers: supabaseHeaders(env) });
  const logs = await response.json();

  const touchpointCount = logs.length;
  const lastSent = logs.length > 0 ? logs.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0] : null;

  return jsonResponse({
    can_send: touchpointCount < 3,
    touchpoints_sent: touchpointCount,
    next_touchpoint: touchpointCount + 1,
    max_touchpoints: 3,
    last_sent: lastSent?.sent_at || null,
    message: touchpointCount >= 3
      ? 'Maximum 3 touchpoints atteint pour ce prospect'
      : `Touchpoint ${touchpointCount + 1}/3 disponible`
  }, 200, corsHeaders);
}

// ============ COLLABORATION HELPERS ============

async function checkWorkspaceAccess(workspaceId, userId, env) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspace_members?workspace_id=eq.${workspaceId}&user_id=eq.${userId}&status=eq.active&select=role`,
    { headers: supabaseHeaders(env) }
  );

  const members = await response.json();

  if (!members.length) {
    return { hasAccess: false, role: null };
  }

  return { hasAccess: true, role: members[0].role };
}

async function createNotification(env, notification) {
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/notifications`,
    {
      method: 'POST',
      headers: supabaseHeaders(env),
      body: JSON.stringify(notification)
    }
  );
}

async function createCommentNotifications(env, comment, author, workspaceId) {
  // Notifier tous les autres membres du workspace
  const membersRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/workspace_members?workspace_id=eq.${workspaceId}&status=eq.active&user_id=neq.${author.id}&select=user_id`,
    { headers: supabaseHeaders(env) }
  );
  const members = await membersRes.json();

  // Récupérer le nom de l'auteur
  const authorRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/users?id=eq.${author.id}&select=name,email`,
    { headers: supabaseHeaders(env) }
  );
  const authorData = await authorRes.json();
  const authorName = authorData[0]?.name || authorData[0]?.email || 'Un membre';

  for (const member of members) {
    await createNotification(env, {
      user_id: member.user_id,
      workspace_id: workspaceId,
      type: 'comment_added',
      title: `${authorName} a commenté`,
      body: comment.body.slice(0, 100) + (comment.body.length > 100 ? '...' : ''),
      data: {
        comment_id: comment.id,
        content_type: comment.content_type,
        content_id: comment.content_id
      }
    });
  }
}

async function hashSHA256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendInvitationEmail(env, { to, inviterName, workspaceName, magicLink, role }) {
  // Utiliser Brevo pour envoyer l'email
  const emailContent = {
    sender: { name: 'SOS Storytelling', email: 'noreply@sosstorytelling.fr' },
    to: [{ email: to }],
    subject: `${inviterName} t'invite à rejoindre ${workspaceName}`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Tu es invité(e) !</h2>
        <p><strong>${inviterName}</strong> t'invite à rejoindre l'espace <strong>${workspaceName}</strong> sur SOS Storytelling.</p>
        <p>Rôle proposé : <strong>${role === 'admin' ? 'Admin' : 'Membre'}</strong></p>
        <div style="margin: 30px 0;">
          <a href="${magicLink}" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: bold;">
            Accepter l'invitation
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">Ce lien expire dans 7 jours.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">SOS Storytelling - Création de contenu assistée par IA</p>
      </div>
    `
  };

  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailContent)
    });
  } catch (error) {
    console.error('Failed to send invitation email:', error);
  }
}

// ============================================================
// BLACKLIST API - Gestion des emails blacklistés
// ============================================================

async function handleBlacklistAPI(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);
  if (!user) return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/blacklist', '');

  try {
    switch (true) {
      // GET /api/blacklist - Liste des emails blacklistés
      case path === '' && request.method === 'GET':
        return await handleListBlacklist(env, user, url, corsHeaders);

      // POST /api/blacklist - Ajouter au blacklist
      case path === '' && request.method === 'POST':
        return await handleAddBlacklist(request, env, user, corsHeaders);

      // DELETE /api/blacklist/:id - Retirer du blacklist
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'DELETE':
        return await handleRemoveBlacklist(env, user, path.slice(1), corsHeaders);

      // POST /api/blacklist/check - Vérifier si email blacklisté
      case path === '/check' && request.method === 'POST':
        return await handleCheckBlacklist(request, env, user, corsHeaders);

      // GET /api/blacklist/stats - Stats blacklist
      case path === '/stats' && request.method === 'GET':
        return await handleBlacklistStats(env, user, corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Blacklist API Error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

async function handleListBlacklist(env, user, url, corsHeaders) {
  const reason = url.searchParams.get('reason');
  const limit = parseInt(url.searchParams.get('limit')) || 100;
  const offset = parseInt(url.searchParams.get('offset')) || 0;

  let query = `${env.SUPABASE_URL}/rest/v1/email_blacklist?user_id=eq.${user.id}&order=created_at.desc&limit=${limit}&offset=${offset}`;

  if (reason) {
    query += `&reason=eq.${reason}`;
  }

  const response = await fetch(query, { headers: supabaseHeaders(env) });
  const blacklist = await response.json();

  return jsonResponse({ blacklist, count: blacklist.length }, 200, corsHeaders);
}

async function handleAddBlacklist(request, env, user, corsHeaders) {
  const body = await request.json();
  const { email, reason = 'manual' } = body;

  if (!email) {
    return jsonResponse({ error: 'Email requis' }, 400, corsHeaders);
  }

  await addToBlacklistEnhanced(env, user.id, email, reason, 'manual_api', body.details || {});

  return jsonResponse({ success: true, message: 'Email ajouté au blacklist' }, 201, corsHeaders);
}

async function handleRemoveBlacklist(env, user, blacklistId, corsHeaders) {
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/email_blacklist?id=eq.${blacklistId}&user_id=eq.${user.id}`,
    { method: 'DELETE', headers: supabaseHeaders(env) }
  );

  return jsonResponse({ success: true, message: 'Email retiré du blacklist' }, 200, corsHeaders);
}

async function handleCheckBlacklist(request, env, user, corsHeaders) {
  const body = await request.json();
  const { emails } = body;

  if (!emails || !Array.isArray(emails)) {
    return jsonResponse({ error: 'Liste emails requise' }, 400, corsHeaders);
  }

  const results = {};
  for (const email of emails.slice(0, 100)) { // Max 100 emails par requête
    results[email] = await isEmailBlacklisted(env, user.id, email);
  }

  return jsonResponse({ results }, 200, corsHeaders);
}

async function handleBlacklistStats(env, user, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/email_blacklist?user_id=eq.${user.id}&select=reason`,
    { headers: supabaseHeaders(env) }
  );
  const blacklist = await response.json();

  const stats = {
    total: blacklist.length,
    by_reason: {}
  };

  blacklist.forEach(item => {
    stats.by_reason[item.reason] = (stats.by_reason[item.reason] || 0) + 1;
  });

  return jsonResponse(stats, 200, corsHeaders);
}

// ============================================================
// PREFLIGHT API - Vérifications avant lancement campagne
// ============================================================

async function handlePreflightAPI(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);
  if (!user) return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/preflight', '');

  try {
    // POST /api/preflight/campaign - Vérification pré-lancement campagne
    if (path === '/campaign' && request.method === 'POST') {
      return await handleCampaignPreflight(request, env, user, corsHeaders);
    }

    return jsonResponse({ error: 'Endpoint not found' }, 404, corsHeaders);
  } catch (error) {
    console.error('Preflight API Error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

async function handleCampaignPreflight(request, env, user, corsHeaders) {
  const body = await request.json();
  const { prospect_ids, sender_email_ids } = body;

  const checks = {
    passed: true,
    warnings: [],
    errors: [],
    details: {}
  };

  // 1. Vérifier les prospects
  if (prospect_ids && prospect_ids.length > 0) {
    const prospectsRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/prospects?id=in.(${prospect_ids.join(',')})&user_id=eq.${user.id}&select=id,email,verification_status,status`,
      { headers: supabaseHeaders(env) }
    );
    const prospects = await prospectsRes.json();

    const verifiedCount = prospects.filter(p => p.verification_status === 'valid').length;
    const unverifiedCount = prospects.filter(p => p.verification_status === 'unverified').length;
    const invalidCount = prospects.filter(p => ['invalid', 'disposable'].includes(p.verification_status)).length;
    const bouncedCount = prospects.filter(p => p.status === 'bounced').length;

    checks.details.prospects = {
      total: prospects.length,
      verified: verifiedCount,
      unverified: unverifiedCount,
      invalid: invalidCount,
      bounced: bouncedCount,
      verification_rate: prospects.length > 0 ? Math.round((verifiedCount / prospects.length) * 100) : 0
    };

    // Vérifier blacklist
    let blacklistedCount = 0;
    for (const p of prospects) {
      if (await isEmailBlacklisted(env, user.id, p.email)) {
        blacklistedCount++;
      }
    }
    checks.details.prospects.blacklisted = blacklistedCount;

    // Règles
    if (invalidCount > 0) {
      checks.errors.push(`${invalidCount} prospect(s) avec email invalide`);
      checks.passed = false;
    }
    if (bouncedCount > 0) {
      checks.warnings.push(`${bouncedCount} prospect(s) déjà bounced seront ignorés`);
    }
    if (blacklistedCount > 0) {
      checks.warnings.push(`${blacklistedCount} email(s) blacklisté(s) seront ignorés`);
    }
    if (unverifiedCount > prospects.length * 0.5) {
      checks.warnings.push(`${Math.round((unverifiedCount / prospects.length) * 100)}% des emails non vérifiés`);
    }
  }

  // 2. Vérifier les senders
  if (sender_email_ids && sender_email_ids.length > 0) {
    const sendersRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/sender_emails?id=in.(${sender_email_ids.join(',')})&user_id=eq.${user.id}&select=*`,
      { headers: supabaseHeaders(env) }
    );
    const senders = await sendersRes.json();

    const activeSenders = senders.filter(s => s.is_active);
    const healthySenders = senders.filter(s => s.health_score >= 70);
    const totalCapacity = senders.reduce((sum, s) => {
      if (!s.is_active) return sum;
      const limit = s.warmup_enabled ? s.warmup_current_limit : s.daily_limit;
      return sum + Math.max(0, limit - (s.emails_sent_today || 0));
    }, 0);

    checks.details.senders = {
      total: senders.length,
      active: activeSenders.length,
      healthy: healthySenders.length,
      total_capacity_today: totalCapacity,
      senders_status: senders.map(s => ({
        email: s.email,
        active: s.is_active,
        health_score: s.health_score,
        remaining_today: Math.max(0, (s.warmup_enabled ? s.warmup_current_limit : s.daily_limit) - (s.emails_sent_today || 0))
      }))
    };

    // Règles
    if (activeSenders.length === 0) {
      checks.errors.push('Aucune adresse d\'envoi active');
      checks.passed = false;
    }
    if (healthySenders.length === 0 && activeSenders.length > 0) {
      checks.errors.push('Aucune adresse avec un health score >= 70');
      checks.passed = false;
    }
    if (totalCapacity < (prospect_ids?.length || 0)) {
      checks.warnings.push(`Capacité insuffisante (${totalCapacity} emails dispo pour ${prospect_ids?.length || 0} prospects)`);
    }

    // Vérifier les unhealthy senders
    const unhealthySenders = senders.filter(s => s.health_score < 70 && s.is_active);
    if (unhealthySenders.length > 0) {
      checks.warnings.push(`${unhealthySenders.length} adresse(s) avec health score faible`);
    }
  }

  // 3. Message final
  checks.message = checks.passed
    ? (checks.warnings.length > 0 ? 'Prêt avec avertissements' : 'Tout est prêt!')
    : 'Des corrections sont nécessaires';

  return jsonResponse(checks, 200, corsHeaders);
}

// ============================================================
// DOMAINS API - Vérification DNS et gestion domaines
// ============================================================

async function handleDomainsAPI(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);
  if (!user) return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/domains', '');

  try {
    switch (true) {
      // GET /api/domains - Liste des domaines
      case path === '' && request.method === 'GET':
        return await handleListDomains(env, user, corsHeaders);

      // POST /api/domains - Ajouter un domaine
      case path === '' && request.method === 'POST':
        return await handleAddDomain(request, env, user, corsHeaders);

      // GET /api/domains/:domain/check - Vérifier DNS d'un domaine
      case path.match(/^\/[^\/]+\/check$/) && request.method === 'GET':
        const domain = path.split('/')[1];
        return await handleCheckDNS(env, user, domain, corsHeaders);

      // POST /api/domains/:id/refresh - Rafraîchir vérification DNS
      case path.match(/^\/[a-f0-9-]+\/refresh$/) && request.method === 'POST':
        const domainId = path.split('/')[1];
        return await handleRefreshDNS(env, user, domainId, corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Domains API Error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

async function handleListDomains(env, user, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/sender_domains?user_id=eq.${user.id}&order=created_at.desc`,
    { headers: supabaseHeaders(env) }
  );
  const domains = await response.json();

  return jsonResponse({ domains }, 200, corsHeaders);
}

async function handleAddDomain(request, env, user, corsHeaders) {
  const body = await request.json();
  const { domain } = body;

  if (!domain) {
    return jsonResponse({ error: 'Domaine requis' }, 400, corsHeaders);
  }

  // Vérifier si existe déjà
  const existingRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/sender_domains?user_id=eq.${user.id}&domain=eq.${domain}&select=id`,
    { headers: supabaseHeaders(env) }
  );
  const existing = await existingRes.json();

  if (existing.length > 0) {
    return jsonResponse({ error: 'Ce domaine existe déjà' }, 409, corsHeaders);
  }

  // Créer le domaine
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/sender_domains`,
    {
      method: 'POST',
      headers: { ...supabaseHeaders(env), 'Prefer': 'return=representation' },
      body: JSON.stringify({ user_id: user.id, domain: domain.toLowerCase() })
    }
  );

  const newDomain = await response.json();

  // Lancer vérification DNS
  const dnsCheck = await performDNSCheck(domain);

  // Mettre à jour avec résultats
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/sender_domains?id=eq.${newDomain[0].id}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(env),
      body: JSON.stringify({
        ...dnsCheck,
        last_dns_check: new Date().toISOString()
      })
    }
  );

  return jsonResponse({
    domain: { ...newDomain[0], ...dnsCheck },
    dns_check: dnsCheck
  }, 201, corsHeaders);
}

async function handleCheckDNS(env, user, domain, corsHeaders) {
  const dnsCheck = await performDNSCheck(domain);

  return jsonResponse({
    domain,
    ...dnsCheck,
    checked_at: new Date().toISOString()
  }, 200, corsHeaders);
}

async function handleRefreshDNS(env, user, domainId, corsHeaders) {
  // Récupérer le domaine
  const domainRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/sender_domains?id=eq.${domainId}&user_id=eq.${user.id}&select=*`,
    { headers: supabaseHeaders(env) }
  );
  const domains = await domainRes.json();

  if (domains.length === 0) {
    return jsonResponse({ error: 'Domaine non trouvé' }, 404, corsHeaders);
  }

  const domain = domains[0];
  const dnsCheck = await performDNSCheck(domain.domain);

  // Mettre à jour
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/sender_domains?id=eq.${domainId}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(env),
      body: JSON.stringify({
        ...dnsCheck,
        last_dns_check: new Date().toISOString()
      })
    }
  );

  return jsonResponse({
    domain: domain.domain,
    ...dnsCheck,
    checked_at: new Date().toISOString()
  }, 200, corsHeaders);
}

// Fonction pour vérifier les enregistrements DNS
async function performDNSCheck(domain) {
  const result = {
    spf_valid: false,
    spf_record: null,
    dkim_valid: false,
    dkim_selector: null,
    dmarc_valid: false,
    dmarc_record: null,
    mx_valid: false,
    dns_score: 0,
    recommendations: []
  };

  try {
    // Vérifier SPF via DNS-over-HTTPS (Cloudflare)
    const spfRes = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=TXT`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    const spfData = await spfRes.json();

    if (spfData.Answer) {
      const spfRecord = spfData.Answer.find(r => r.data && r.data.includes('v=spf1'));
      if (spfRecord) {
        result.spf_valid = true;
        result.spf_record = spfRecord.data.replace(/"/g, '');
        result.dns_score += 25;
      }
    }

    if (!result.spf_valid) {
      result.recommendations.push({
        type: 'spf',
        message: 'Ajouter un enregistrement SPF',
        record: `${domain} IN TXT "v=spf1 include:spf.brevo.com ~all"`
      });
    }

    // Vérifier DKIM (selector brevo)
    const dkimRes = await fetch(`https://cloudflare-dns.com/dns-query?name=brevo._domainkey.${domain}&type=TXT`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    const dkimData = await dkimRes.json();

    if (dkimData.Answer && dkimData.Answer.length > 0) {
      result.dkim_valid = true;
      result.dkim_selector = 'brevo';
      result.dns_score += 25;
    }

    if (!result.dkim_valid) {
      result.recommendations.push({
        type: 'dkim',
        message: 'Ajouter un enregistrement DKIM',
        record: 'Consultez votre compte Brevo pour obtenir la clé DKIM'
      });
    }

    // Vérifier DMARC
    const dmarcRes = await fetch(`https://cloudflare-dns.com/dns-query?name=_dmarc.${domain}&type=TXT`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    const dmarcData = await dmarcRes.json();

    if (dmarcData.Answer) {
      const dmarcRecord = dmarcData.Answer.find(r => r.data && r.data.includes('v=DMARC1'));
      if (dmarcRecord) {
        result.dmarc_valid = true;
        result.dmarc_record = dmarcRecord.data.replace(/"/g, '');
        result.dns_score += 25;
      }
    }

    if (!result.dmarc_valid) {
      result.recommendations.push({
        type: 'dmarc',
        message: 'Ajouter un enregistrement DMARC',
        record: `_dmarc.${domain} IN TXT "v=DMARC1; p=none; rua=mailto:dmarc@${domain}"`
      });
    }

    // Vérifier MX
    const mxRes = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    const mxData = await mxRes.json();

    if (mxData.Answer && mxData.Answer.length > 0) {
      result.mx_valid = true;
      result.dns_score += 25;
    }

    if (!result.mx_valid) {
      result.recommendations.push({
        type: 'mx',
        message: 'Aucun enregistrement MX trouvé',
        record: 'Configurez les MX de votre hébergeur email'
      });
    }

    // Status global
    result.status = result.dns_score >= 75 ? 'ready' :
                    result.dns_score >= 50 ? 'partial' : 'incomplete';

  } catch (error) {
    console.error('DNS check error:', error);
    result.error = error.message;
  }

  return result;
}


// ============================================================
// EMAIL VERIFICATION API (MillionVerifier Integration)
// ============================================================

async function handleEmailVerifyAPI(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);
  if (!user) return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/email-verify', '');

  try {
    switch (true) {
      // POST /api/email-verify - Vérifier un seul email
      case path === '' && request.method === 'POST':
        return await handleVerifySingleEmail(request, env, user, corsHeaders);

      // POST /api/email-verify/bulk - Vérifier une liste d'emails (async)
      case path === '/bulk' && request.method === 'POST':
        return await handleVerifyBulkEmails(request, env, user, corsHeaders);

      // GET /api/email-verify/job/:id - Statut d'un job bulk
      case path.match(/^\/job\/[a-zA-Z0-9]+$/) && request.method === 'GET':
        const jobId = path.split('/')[2];
        return await handleVerifyJobStatus(env, user, jobId, corsHeaders);

      // POST /api/email-verify/prospects - Vérifier les prospects d'une liste
      case path === '/prospects' && request.method === 'POST':
        return await handleVerifyProspects(request, env, user, corsHeaders);

      // GET /api/email-verify/stats - Stats de vérification utilisateur
      case path === '/stats' && request.method === 'GET':
        return await handleVerifyStats(env, user, corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Email Verify API Error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

// Vérifier un seul email via MillionVerifier
async function handleVerifySingleEmail(request, env, user, corsHeaders) {
  const body = await request.json();
  const { email } = body;

  if (!email) {
    return jsonResponse({ error: 'Email requis' }, 400, corsHeaders);
  }

  // Appel API MillionVerifier
  const result = await verifyEmailWithMillionVerifier(env, email);

  return jsonResponse({
    email,
    ...result,
    verified_at: new Date().toISOString()
  }, 200, corsHeaders);
}

// Vérifier une liste d'emails en bulk (async job)
async function handleVerifyBulkEmails(request, env, user, corsHeaders) {
  const body = await request.json();
  const { emails } = body;

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return jsonResponse({ error: 'Liste d\'emails requise' }, 400, corsHeaders);
  }

  if (emails.length > 10000) {
    return jsonResponse({ error: 'Maximum 10000 emails par requête' }, 400, corsHeaders);
  }

  // Pour bulk, MillionVerifier utilise leur API file upload
  // On fait une vérification synchrone par batch pour simplifier
  const results = [];
  const batchSize = 50;
  const batches = [];

  for (let i = 0; i < emails.length; i += batchSize) {
    batches.push(emails.slice(i, i + batchSize));
  }

  // Traiter le premier batch immédiatement
  const firstBatch = batches[0];
  for (const email of firstBatch) {
    const result = await verifyEmailWithMillionVerifier(env, email);
    results.push({ email, ...result });
  }

  // Si plus de batches, créer un job pour le reste
  if (batches.length > 1) {
    const jobId = `mv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Stocker le job en cache KV (si disponible) ou retourner statut partiel
    return jsonResponse({
      job_id: jobId,
      status: 'partial',
      processed: results.length,
      total: emails.length,
      results: results,
      message: `${results.length} emails vérifiés. ${emails.length - results.length} restants en traitement.`,
      remaining_emails: emails.slice(batchSize)
    }, 202, corsHeaders);
  }

  return jsonResponse({
    status: 'completed',
    processed: results.length,
    total: emails.length,
    results: results,
    summary: summarizeVerificationResults(results)
  }, 200, corsHeaders);
}

// Statut d'un job de vérification bulk
async function handleVerifyJobStatus(env, user, jobId, corsHeaders) {
  // Dans une implémentation complète, on utiliserait KV ou D1 pour stocker l'état
  return jsonResponse({
    job_id: jobId,
    status: 'unknown',
    message: 'Les jobs sont traités en temps réel. Utilisez /bulk avec des batches plus petits.'
  }, 200, corsHeaders);
}

// Vérifier les prospects d'une liste
async function handleVerifyProspects(request, env, user, corsHeaders) {
  const body = await request.json();
  const { list_id, only_unverified = true } = body;

  if (!list_id) {
    return jsonResponse({ error: 'list_id requis' }, 400, corsHeaders);
  }

  // Récupérer les prospects de la liste
  let queryUrl = `${env.SUPABASE_URL}/rest/v1/prospects?user_id=eq.${user.id}&list_id=eq.${list_id}&select=id,email,verification_status`;

  if (only_unverified) {
    queryUrl += '&verification_status=eq.unverified';
  }

  const prospectsRes = await fetch(queryUrl, { headers: supabaseHeaders(env) });
  const prospects = await prospectsRes.json();

  if (prospects.length === 0) {
    return jsonResponse({
      message: 'Aucun prospect à vérifier',
      verified: 0
    }, 200, corsHeaders);
  }

  // Limiter à 100 prospects par requête
  const toVerify = prospects.slice(0, 100);
  const results = [];

  for (const prospect of toVerify) {
    const verifyResult = await verifyEmailWithMillionVerifier(env, prospect.email);

    // Mettre à jour le prospect dans Supabase
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/prospects?id=eq.${prospect.id}`,
      {
        method: 'PATCH',
        headers: supabaseHeaders(env),
        body: JSON.stringify({
          verification_status: verifyResult.status,
          verification_result: verifyResult,
          verified_at: new Date().toISOString(),
          is_disposable: verifyResult.is_disposable || false,
          is_catch_all: verifyResult.is_catch_all || false
        })
      }
    );

    results.push({
      prospect_id: prospect.id,
      email: prospect.email,
      ...verifyResult
    });

    // Pause pour éviter rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  const summary = summarizeVerificationResults(results);

  return jsonResponse({
    verified: results.length,
    remaining: prospects.length - results.length,
    results,
    summary,
    warning: summary.invalid_rate > 20 ?
      '⚠️ Plus de 20% d\'emails invalides détectés. Nettoyez votre liste avant d\'envoyer.' : null
  }, 200, corsHeaders);
}

// Stats de vérification pour l'utilisateur
async function handleVerifyStats(env, user, corsHeaders) {
  // Récupérer les stats depuis les prospects
  const statsRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/prospects?user_id=eq.${user.id}&select=verification_status`,
    { headers: supabaseHeaders(env) }
  );
  const prospects = await statsRes.json();

  const stats = {
    total: prospects.length,
    unverified: 0,
    valid: 0,
    risky: 0,
    invalid: 0,
    disposable: 0,
    catch_all: 0
  };

  for (const p of prospects) {
    const status = p.verification_status || 'unverified';
    if (stats[status] !== undefined) {
      stats[status]++;
    }
  }

  stats.verified_rate = stats.total > 0 ?
    Math.round(((stats.total - stats.unverified) / stats.total) * 100) : 0;
  stats.quality_score = stats.total > 0 ?
    Math.round((stats.valid / stats.total) * 100) : 0;

  return jsonResponse({ stats }, 200, corsHeaders);
}

// Fonction principale d'appel à MillionVerifier API
async function verifyEmailWithMillionVerifier(env, email) {
  const apiKey = env.MILLIONVERIFIER_API_KEY;

  if (!apiKey) {
    // Mode simulation si pas de clé API
    return simulateEmailVerification(email);
  }

  try {
    const response = await fetch(
      `https://api.millionverifier.com/api/v3/?api=${apiKey}&email=${encodeURIComponent(email)}`,
      { method: 'GET' }
    );

    const data = await response.json();

    // Mapper les résultats MillionVerifier vers nos statuts
    return mapMillionVerifierResult(data);

  } catch (error) {
    console.error('MillionVerifier API error:', error);
    return {
      status: 'error',
      error: error.message,
      verified: false
    };
  }
}

// Mapper les résultats MillionVerifier vers nos statuts
function mapMillionVerifierResult(data) {
  /*
  MillionVerifier returns:
  - result: "ok", "catch_all", "unknown", "error", "invalid", "disposable"
  - resultcode: 1 (valid), 2 (catch-all), 3 (unknown), 4 (error), 5 (invalid), 6 (disposable)
  - quality: "good", "risky", "bad"
  */

  const resultMap = {
    'ok': 'valid',
    'catch_all': 'catch_all',
    'unknown': 'risky',
    'error': 'risky',
    'invalid': 'invalid',
    'disposable': 'disposable'
  };

  const status = resultMap[data.result] || 'risky';

  return {
    status,
    quality: data.quality || 'unknown',
    is_valid: data.result === 'ok',
    is_disposable: data.result === 'disposable',
    is_catch_all: data.result === 'catch_all',
    is_risky: ['catch_all', 'unknown', 'error'].includes(data.result),
    raw_result: data.result,
    raw_code: data.resultcode,
    credits_used: 1
  };
}

// Simulation pour développement sans clé API
function simulateEmailVerification(email) {
  const emailLower = email.toLowerCase();

  // Domaines jetables connus
  const disposableDomains = ['tempmail.com', 'guerrillamail.com', '10minutemail.com',
    'mailinator.com', 'throwaway.email', 'yopmail.com', 'trashmail.com'];

  const domain = emailLower.split('@')[1] || '';

  if (disposableDomains.some(d => domain.includes(d))) {
    return { status: 'disposable', quality: 'bad', is_valid: false, is_disposable: true, is_catch_all: false, is_risky: true, simulated: true };
  }

  // Format invalide
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { status: 'invalid', quality: 'bad', is_valid: false, is_disposable: false, is_catch_all: false, is_risky: false, simulated: true };
  }

  // Catch-all communs
  const catchAllDomains = ['outlook.com', 'hotmail.com', 'live.com'];
  if (catchAllDomains.some(d => domain === d)) {
    return { status: 'catch_all', quality: 'risky', is_valid: true, is_disposable: false, is_catch_all: true, is_risky: true, simulated: true };
  }

  // Par défaut: valide
  return { status: 'valid', quality: 'good', is_valid: true, is_disposable: false, is_catch_all: false, is_risky: false, simulated: true };
}

// Résumer les résultats de vérification
function summarizeVerificationResults(results) {
  const summary = {
    total: results.length,
    valid: 0,
    risky: 0,
    invalid: 0,
    disposable: 0,
    catch_all: 0
  };

  for (const r of results) {
    if (r.status === 'valid') summary.valid++;
    else if (r.status === 'risky') summary.risky++;
    else if (r.status === 'invalid') summary.invalid++;
    else if (r.status === 'disposable') summary.disposable++;
    else if (r.status === 'catch_all') summary.catch_all++;
  }

  summary.valid_rate = Math.round((summary.valid / summary.total) * 100);
  summary.invalid_rate = Math.round(((summary.invalid + summary.disposable) / summary.total) * 100);
  summary.risky_rate = Math.round(((summary.risky + summary.catch_all) / summary.total) * 100);

  return summary;
}
