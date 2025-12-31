// cloudflare-worker-v10-extension.js
// Version avec Sequences Email + Extension Chrome LinkedIn Sales Navigator
// Variables d'environnement requises:
// - ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, BREVO_API_KEY

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
          break;

        case 'unsubscribed':
        case 'complaint':
          prospectUpdates.status = 'unsubscribed';

          // Ajouter a la blacklist
          await fetch(`${env.SUPABASE_URL}/rest/v1/email_unsubscribes`, {
            method: 'POST',
            headers: supabaseHeaders(env),
            body: JSON.stringify({
              user_id: campaign.user_id,
              email: email.toLowerCase(),
              reason: eventType
            })
          });

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
