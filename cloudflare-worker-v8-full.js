// cloudflare-worker-v8-full.js - Version complete fusionnee
// Inclut: Newsletters, Visuals, Prospects, Campaigns, Brevo Email Sending
// Variables d'environnement requises:
// - ANTHROPIC_API_KEY
// - PERPLEXITY_API_KEY
// - SUPABASE_URL
// - SUPABASE_SERVICE_KEY
// - LEMONSQUEEZY_WEBHOOK_SECRET
// - BREVO_API_KEY
// - ORSHOT_API_KEY

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

    // ============ WEBHOOKS ============
    if (url.pathname === '/webhook/lemonsqueezy' && request.method === 'POST') {
      return handleLemonSqueezyWebhook(request, env, corsHeaders);
    }

    if (url.pathname === '/webhook/brevo' && request.method === 'POST') {
      return handleBrevoWebhook(request, env, corsHeaders);
    }

    // ============ BREVO CONTACT ============
    if (url.pathname === '/api/brevo/contact' && request.method === 'POST') {
      return handleBrevoContact(request, env, corsHeaders);
    }

    // ============ ADMIN API ============
    if (url.pathname.startsWith('/api/admin/')) {
      return handleAdminAPI(request, env, corsHeaders);
    }

    // ============ CAMPAIGNS API ============
    if (url.pathname.startsWith('/api/campaigns')) {
      return handleCampaignsAPI(request, env, corsHeaders);
    }

    // ============ PROSPECTS API ============
    if (url.pathname.startsWith('/api/prospects')) {
      return handleProspectsAPI(request, env, corsHeaders);
    }

    // ============ NEWSLETTERS API ============
    if (url.pathname.startsWith('/api/newsletters')) {
      return handleNewslettersAPI(request, env, corsHeaders);
    }

    // ============ VISUALS API ============
    if (url.pathname.startsWith('/api/visuals')) {
      return handleVisualsAPI(request, env, corsHeaders);
    }

    // ============ API REST ENTERPRISE ============
    if (url.pathname.startsWith('/api/v1/')) {
      return handleAPIRequest(request, env, corsHeaders);
    }

    // ============ FRONTEND ============
    return handleFrontendRequest(request, env, corsHeaders);
  }
};

// ============================================================
// CAMPAIGNS API - Module Prospection & Emailing (NOUVEAU)
// ============================================================

async function handleCampaignsAPI(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/campaigns', '');

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
      case path === '/generate-email' && request.method === 'POST':
        return await handleGenerateProspectEmail(request, env, user, corsHeaders);

      case path === '/send-email' && request.method === 'POST':
        return await handleSendEmail(request, env, user, corsHeaders);

      case path.match(/^\/[a-f0-9-]+\/send$/) && request.method === 'POST':
        const sendCampaignId = path.replace('/send', '').slice(1);
        return await handleSendCampaign(sendCampaignId, env, user, corsHeaders);

      case path === '' && request.method === 'GET':
        return await handleListCampaigns(url, env, user, corsHeaders);

      case path === '' && request.method === 'POST':
        return await handleCreateCampaign(request, env, user, corsHeaders);

      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'GET':
        return await handleGetCampaign(path.slice(1), env, user, corsHeaders);

      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'PUT':
        return await handleUpdateCampaign(path.slice(1), request, env, user, corsHeaders);

      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'DELETE':
        return await handleDeleteCampaign(path.slice(1), env, user, corsHeaders);

      case path.match(/^\/[a-f0-9-]+\/emails$/) && request.method === 'GET':
        return await handleGetCampaignEmails(path.replace('/emails', '').slice(1), env, user, corsHeaders);

      case path === '/stats' && request.method === 'GET':
        return await handleGetCampaignStats(env, user, corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found', code: 'NOT_FOUND' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Campaigns API Error:', error);
    return jsonResponse({ error: 'Internal server error', code: 'INTERNAL_ERROR', message: error.message }, 500, corsHeaders);
  }
}

async function handleGenerateProspectEmail(request, env, user, corsHeaders) {
  const body = await request.json();
  const { prospect, campaign_goal, language = 'fr', use_my_voice = true } = body;

  if (!prospect || !prospect.email || !prospect.first_name || !campaign_goal) {
    return jsonResponse({ error: 'Missing required fields', code: 'MISSING_FIELDS' }, 400, corsHeaders);
  }

  let voiceContext = "";
  if (use_my_voice) {
    const voiceProfile = await getUserVoiceProfile(user.id, env);
    if (voiceProfile) voiceContext = buildProspectVoiceContext(voiceProfile);
  }

  const systemPrompt = buildProspectEmailSystemPrompt(language, voiceContext);
  const userPrompt = buildProspectEmailUserPrompt(prospect, campaign_goal, language);

  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  if (!claudeResponse.ok) {
    return jsonResponse({ error: 'AI generation failed', code: 'AI_ERROR' }, 502, corsHeaders);
  }

  const data = await claudeResponse.json();
  const generatedContent = data.content[0].text;

  let parsedContent;
  try {
    const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsedContent = JSON.parse(jsonMatch[0]);
    else throw new Error('No JSON');
  } catch (e) {
    parsedContent = { subject_lines: ["Objet"], body: generatedContent, preview_text: "" };
  }

  return jsonResponse({
    success: true,
    email: {
      subject_lines: parsedContent.subject_lines || ["Objet 1", "Objet 2", "Objet 3"],
      body: parsedContent.body || generatedContent,
      preview_text: parsedContent.preview_text || ""
    },
    usage: { input_tokens: data.usage?.input_tokens || 0, output_tokens: data.usage?.output_tokens || 0 }
  }, 200, corsHeaders);
}

function buildProspectEmailSystemPrompt(language, voiceContext) {
  const langInstr = language === 'en' ? `LANGUAGE: Write in American English. Be direct, use contractions, casual but professional.` : `LANGUE: Ecris en francais. Ton chaleureux mais professionnel.`;
  return `Tu es un expert en copywriting et cold emailing.
${langInstr}
${voiceContext}
REGLES: Email humain, personnalise, pas de cliches, max 150 mots, question ouverte a la fin, pas de lien.
FORMAT JSON: { "subject_lines": ["..."], "body": "...", "preview_text": "..." }`;
}

function buildProspectEmailUserPrompt(prospect, goal, language) {
  return `PROSPECT: ${prospect.first_name} ${prospect.last_name || ''} - ${prospect.email} - ${prospect.company || 'N/A'} - ${prospect.job_title || 'N/A'}
OBJECTIF: ${goal}
LANGUE: ${language === 'en' ? 'English' : 'Francais'}
Genere l'email en JSON.`;
}

function buildProspectVoiceContext(profile) {
  if (!profile) return "";
  return `\nSTYLE "MA VOIX": Ton: ${profile.voice_tone || 'pro'}, Formalite: ${profile.voice_formality || 'moyenne'}`;
}

async function getUserVoiceProfile(userId, env) {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=voice_samples,voice_tone,voice_formality,voice_keywords`, {
      headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data[0] || null;
  } catch (e) { return null; }
}

async function handleSendEmail(request, env, user, corsHeaders) {
  const body = await request.json();
  const { to_email, to_name, from_email, from_name, reply_to, subject, html_content, text_content, tags = [] } = body;

  if (!to_email || !from_email || !subject) {
    return jsonResponse({ error: 'Missing required fields', code: 'MISSING_FIELDS' }, 400, corsHeaders);
  }

  const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
    body: JSON.stringify({
      sender: { name: from_name || from_email, email: from_email },
      to: [{ email: to_email, name: to_name || to_email }],
      replyTo: { email: reply_to || from_email },
      subject, htmlContent: html_content || `<p>${text_content || ''}</p>`, textContent: text_content,
      tags: ['sos-storytelling', ...tags]
    })
  });

  if (!brevoResponse.ok) {
    const error = await brevoResponse.json();
    return jsonResponse({ error: 'Email send failed', code: 'BREVO_ERROR', details: error.message }, 502, corsHeaders);
  }

  const data = await brevoResponse.json();
  return jsonResponse({ success: true, message_id: data.messageId }, 200, corsHeaders);
}

async function handleSendCampaign(campaignId, env, user, corsHeaders) {
  const campaignRes = await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaignId}&user_id=eq.${user.id}`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
  });
  const campaigns = await campaignRes.json();
  const campaign = campaigns[0];
  if (!campaign) return jsonResponse({ error: 'Campaign not found' }, 404, corsHeaders);
  if (campaign.status !== 'draft') return jsonResponse({ error: 'Campaign already sent' }, 400, corsHeaders);

  const emailsRes = await fetch(`${env.SUPABASE_URL}/rest/v1/campaign_emails?campaign_id=eq.${campaignId}&status=eq.pending&select=*,prospects(*)`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
  });
  const emails = await emailsRes.json();
  if (emails.length === 0) return jsonResponse({ error: 'No emails to send' }, 400, corsHeaders);

  await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaignId}`, {
    method: 'PATCH',
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'sending', started_at: new Date().toISOString() })
  });

  let sent = 0, failed = 0;
  for (const email of emails) {
    const prospect = email.prospects;
    if (!prospect) continue;
    try {
      const htmlBody = email.body.replace(/\n/g, '<br>');
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
        body: JSON.stringify({
          sender: { name: campaign.sender_name, email: campaign.sender_email },
          to: [{ email: prospect.email, name: `${prospect.first_name} ${prospect.last_name || ''}`.trim() }],
          replyTo: { email: campaign.reply_to || campaign.sender_email },
          subject: email.subject,
          htmlContent: `<div style="font-family:Arial,sans-serif;line-height:1.6;">${htmlBody}</div>`,
          textContent: email.body,
          tags: ['sos-storytelling', 'campaign', campaignId]
        })
      });
      if (brevoRes.ok) {
        const brevoData = await brevoRes.json();
        await fetch(`${env.SUPABASE_URL}/rest/v1/campaign_emails?id=eq.${email.id}`, {
          method: 'PATCH',
          headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'sent', brevo_message_id: brevoData.messageId, sent_at: new Date().toISOString() })
        });
        await fetch(`${env.SUPABASE_URL}/rest/v1/prospects?id=eq.${prospect.id}`, {
          method: 'PATCH',
          headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'contacted', emails_sent: (prospect.emails_sent || 0) + 1, last_contacted_at: new Date().toISOString() })
        });
        sent++;
      } else { failed++; }
      await new Promise(r => setTimeout(r, 100));
    } catch (e) { failed++; }
  }

  await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaignId}`, {
    method: 'PATCH',
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'sent', emails_sent: sent, completed_at: new Date().toISOString() })
  });

  return jsonResponse({ success: true, sent, failed, total: emails.length }, 200, corsHeaders);
}

async function handleBrevoWebhook(request, env, corsHeaders) {
  try {
    const event = await request.json();
    const { event: eventType, email, 'message-id': messageId } = event;

    await fetch(`${env.SUPABASE_URL}/rest/v1/email_events`, {
      method: 'POST',
      headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, message_id: messageId, event_type: eventType, payload: event })
    });

    let status = null, fields = {};
    if (eventType === 'delivered') status = 'contacted';
    else if (eventType === 'opened' || eventType === 'unique_opened') { status = 'opened'; fields.last_opened_at = new Date().toISOString(); }
    else if (eventType === 'click') { status = 'clicked'; fields.last_clicked_at = new Date().toISOString(); }
    else if (eventType === 'hard_bounce' || eventType === 'soft_bounce') status = 'bounced';
    else if (eventType === 'unsubscribed' || eventType === 'complaint') status = 'unsubscribed';

    if (status) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/prospects?email=eq.${encodeURIComponent(email.toLowerCase())}`, {
        method: 'PATCH',
        headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...fields })
      });
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response('Error', { status: 500, headers: corsHeaders });
  }
}

async function handleListCampaigns(url, env, user, corsHeaders) {
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  let query = `${env.SUPABASE_URL}/rest/v1/email_campaigns?user_id=eq.${user.id}&order=created_at.desc&limit=${limit}&offset=${offset}`;
  if (status) query += `&status=eq.${status}`;
  const response = await fetch(query, { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Prefer': 'count=exact' } });
  const total = response.headers.get('Content-Range')?.split('/')[1] || 0;
  const campaigns = await response.json();
  return jsonResponse({ campaigns, total: parseInt(total), limit, offset }, 200, corsHeaders);
}

async function handleCreateCampaign(request, env, user, corsHeaders) {
  const body = await request.json();
  const data = { user_id: user.id, name: body.name, description: body.description || null, sender_email: body.sender_email, sender_name: body.sender_name, reply_to: body.reply_to || body.sender_email, goal: body.goal, language: body.language || 'fr', use_my_voice: body.use_my_voice !== false, generate_unique_per_prospect: body.generate_unique_per_prospect !== false, prospect_filter: body.prospect_filter || null, total_prospects: body.total_prospects || 0, status: 'draft' };
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns`, { method: 'POST', headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, body: JSON.stringify(data) });
  const [campaign] = await response.json();
  return jsonResponse({ success: true, campaign }, 201, corsHeaders);
}

async function handleGetCampaign(id, env, user, corsHeaders) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${id}&user_id=eq.${user.id}`, { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
  const campaigns = await response.json();
  if (!campaigns[0]) return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  return jsonResponse({ campaign: campaigns[0] }, 200, corsHeaders);
}

async function handleUpdateCampaign(id, request, env, user, corsHeaders) {
  const body = await request.json();
  const allowed = ['name', 'description', 'sender_email', 'sender_name', 'reply_to', 'goal', 'language', 'use_my_voice', 'generate_unique_per_prospect', 'prospect_filter', 'total_prospects', 'subject_template', 'body_template', 'status'];
  const updates = {};
  for (const f of allowed) if (body[f] !== undefined) updates[f] = body[f];
  updates.updated_at = new Date().toISOString();
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${id}&user_id=eq.${user.id}`, { method: 'PATCH', headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, body: JSON.stringify(updates) });
  const campaigns = await response.json();
  if (!campaigns[0]) return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  return jsonResponse({ success: true, campaign: campaigns[0] }, 200, corsHeaders);
}

async function handleDeleteCampaign(id, env, user, corsHeaders) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${id}&user_id=eq.${user.id}`, { method: 'DELETE', headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
  return jsonResponse({ success: true }, 200, corsHeaders);
}

async function handleGetCampaignEmails(campaignId, env, user, corsHeaders) {
  const check = await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaignId}&user_id=eq.${user.id}&select=id`, { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
  if ((await check.json()).length === 0) return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/campaign_emails?campaign_id=eq.${campaignId}&select=*,prospects(first_name,last_name,email,company)&order=created_at.desc`, { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
  return jsonResponse({ emails: await response.json() }, 200, corsHeaders);
}

async function handleGetCampaignStats(env, user, corsHeaders) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns?user_id=eq.${user.id}&select=status,emails_sent,emails_opened,emails_clicked,emails_replied,emails_bounced`, { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
  const campaigns = await response.json();
  const stats = { total_campaigns: campaigns.length, campaigns_by_status: {}, total_sent: 0, total_opened: 0, total_clicked: 0, total_replied: 0, total_bounced: 0 };
  campaigns.forEach(c => {
    stats.campaigns_by_status[c.status] = (stats.campaigns_by_status[c.status] || 0) + 1;
    stats.total_sent += c.emails_sent || 0;
    stats.total_opened += c.emails_opened || 0;
    stats.total_clicked += c.emails_clicked || 0;
    stats.total_replied += c.emails_replied || 0;
    stats.total_bounced += c.emails_bounced || 0;
  });
  if (stats.total_sent > 0) {
    stats.open_rate = Math.round((stats.total_opened / stats.total_sent) * 100);
    stats.click_rate = Math.round((stats.total_clicked / stats.total_sent) * 100);
  }
  return jsonResponse({ stats }, 200, corsHeaders);
}

// ============================================================
// PROSPECTS API (NOUVEAU)
// ============================================================

async function handleProspectsAPI(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/prospects', '');

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);
  if (!user) return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);

  try {
    switch (true) {
      case path === '' && request.method === 'GET':
        return await handleListProspects(url, env, user, corsHeaders);
      case path === '' && request.method === 'POST':
        return await handleCreateProspect(request, env, user, corsHeaders);
      case path === '/import' && request.method === 'POST':
        return await handleImportProspects(request, env, user, corsHeaders);
      case path === '/stats' && request.method === 'GET':
        return await handleGetProspectStats(env, user, corsHeaders);
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'GET':
        return await handleGetProspect(path.slice(1), env, user, corsHeaders);
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'PUT':
        return await handleUpdateProspect(path.slice(1), request, env, user, corsHeaders);
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'DELETE':
        return await handleDeleteProspect(path.slice(1), env, user, corsHeaders);
      case path === '' && request.method === 'DELETE':
        return await handleDeleteProspects(request, env, user, corsHeaders);
      default:
        return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
    }
  } catch (e) {
    return jsonResponse({ error: 'Internal error', message: e.message }, 500, corsHeaders);
  }
}

async function handleListProspects(url, env, user, corsHeaders) {
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  let query = `${env.SUPABASE_URL}/rest/v1/prospects?user_id=eq.${user.id}&order=created_at.desc&limit=${limit}&offset=${offset}`;
  if (status && status !== 'all') query += `&status=eq.${status}`;
  if (search) query += `&or=(first_name.ilike.*${search}*,last_name.ilike.*${search}*,email.ilike.*${search}*,company.ilike.*${search}*)`;
  const response = await fetch(query, { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Prefer': 'count=exact' } });
  const total = response.headers.get('Content-Range')?.split('/')[1] || 0;
  return jsonResponse({ prospects: await response.json(), total: parseInt(total), limit, offset }, 200, corsHeaders);
}

async function handleCreateProspect(request, env, user, corsHeaders) {
  const body = await request.json();
  if (!body.email || !body.first_name) return jsonResponse({ error: 'Missing email or first_name' }, 400, corsHeaders);
  const data = { user_id: user.id, email: body.email.toLowerCase().trim(), first_name: body.first_name, last_name: body.last_name || null, company: body.company || null, job_title: body.job_title || null, linkedin_url: body.linkedin_url || null, phone: body.phone || null, website: body.website || null, sector: body.sector || null, city: body.city || null, company_size: body.company_size || null, notes: body.notes || null, source: body.source || 'manual', status: 'new' };
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/prospects`, { method: 'POST', headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, body: JSON.stringify(data) });
  const [prospect] = await response.json();
  return jsonResponse({ success: true, prospect }, 201, corsHeaders);
}

async function handleImportProspects(request, env, user, corsHeaders) {
  const body = await request.json();
  if (!body.prospects || !Array.isArray(body.prospects)) return jsonResponse({ error: 'Missing prospects array' }, 400, corsHeaders);
  const source = body.source || 'csv_import';
  const toInsert = body.prospects.map(p => ({ user_id: user.id, email: p.email.toLowerCase().trim(), first_name: p.first_name, last_name: p.last_name || null, company: p.company || null, job_title: p.job_title || null, linkedin_url: p.linkedin_url || p.linkedin || null, phone: p.phone || null, website: p.website || null, sector: p.sector || null, city: p.city || null, company_size: p.company_size || null, source, status: 'new' }));
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/prospects?on_conflict=user_id,email`, { method: 'POST', headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation,resolution=ignore-duplicates' }, body: JSON.stringify(toInsert) });
  const imported = await response.json();
  return jsonResponse({ success: true, imported: imported.length, total: toInsert.length }, 201, corsHeaders);
}

async function handleGetProspect(id, env, user, corsHeaders) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/prospects?id=eq.${id}&user_id=eq.${user.id}`, { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
  const prospects = await response.json();
  if (!prospects[0]) return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  return jsonResponse({ prospect: prospects[0] }, 200, corsHeaders);
}

async function handleUpdateProspect(id, request, env, user, corsHeaders) {
  const body = await request.json();
  const allowed = ['first_name', 'last_name', 'company', 'job_title', 'linkedin_url', 'phone', 'website', 'sector', 'city', 'company_size', 'notes', 'status', 'tags'];
  const updates = {};
  for (const f of allowed) if (body[f] !== undefined) updates[f] = body[f];
  updates.updated_at = new Date().toISOString();
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/prospects?id=eq.${id}&user_id=eq.${user.id}`, { method: 'PATCH', headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, body: JSON.stringify(updates) });
  const prospects = await response.json();
  if (!prospects[0]) return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  return jsonResponse({ success: true, prospect: prospects[0] }, 200, corsHeaders);
}

async function handleDeleteProspect(id, env, user, corsHeaders) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/prospects?id=eq.${id}&user_id=eq.${user.id}`, { method: 'DELETE', headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
  return jsonResponse({ success: true }, 200, corsHeaders);
}

async function handleDeleteProspects(request, env, user, corsHeaders) {
  const body = await request.json();
  if (!body.ids || !Array.isArray(body.ids)) return jsonResponse({ error: 'Missing ids' }, 400, corsHeaders);
  const idsParam = body.ids.map(id => `"${id}"`).join(',');
  await fetch(`${env.SUPABASE_URL}/rest/v1/prospects?id=in.(${idsParam})&user_id=eq.${user.id}`, { method: 'DELETE', headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
  return jsonResponse({ success: true, deleted: body.ids.length }, 200, corsHeaders);
}

async function handleGetProspectStats(env, user, corsHeaders) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/prospects?user_id=eq.${user.id}&select=status`, { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
  const prospects = await response.json();
  const stats = { total: prospects.length, new: 0, contacted: 0, opened: 0, clicked: 0, replied: 0, converted: 0, unsubscribed: 0, bounced: 0 };
  prospects.forEach(p => { if (stats[p.status] !== undefined) stats[p.status]++; });
  return jsonResponse({ stats }, 200, corsHeaders);
}

// ============================================================
// NEWSLETTERS API (depuis v7)
// ============================================================

async function handleNewslettersAPI(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/newsletters', '');

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authorization required' }, 401, corsHeaders);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await verifySupabaseToken(token, env);
  if (!user) return jsonResponse({ error: 'Invalid token' }, 401, corsHeaders);

  try {
    switch (true) {
      case path === '/generate' && request.method === 'POST':
        return await handleGenerateNewsletter(request, env, user, corsHeaders);
      case path === '/generate-sequence' && request.method === 'POST':
        return await handleGenerateSequence(request, env, user, corsHeaders);
      case path === '/regenerate' && request.method === 'POST':
        return await handleRegenerateNewsletter(request, env, user, corsHeaders);
      case path === '' && request.method === 'GET':
        return await handleListNewsletters(url, env, user, corsHeaders);
      case path === '' && request.method === 'POST':
        return await handleSaveNewsletter(request, env, user, corsHeaders);
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'GET':
        return await handleGetNewsletter(path.slice(1), env, user, corsHeaders);
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'PUT':
        return await handleUpdateNewsletter(path.slice(1), request, env, user, corsHeaders);
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'DELETE':
        return await handleDeleteNewsletter(path.slice(1), env, user, corsHeaders);
      case path === '/templates' && request.method === 'GET':
        return await handleListTemplates(url, env, user, corsHeaders);
      case path === '/templates' && request.method === 'POST':
        return await handleCreateTemplate(request, env, user, corsHeaders);
      case path.match(/^\/templates\/[a-f0-9-]+$/) && request.method === 'DELETE':
        return await handleDeleteTemplate(path.replace('/templates/', ''), env, user, corsHeaders);
      case path === '/clients' && request.method === 'GET':
        return await handleListClients(env, user, corsHeaders);
      case path === '/clients' && request.method === 'POST':
        return await handleCreateClient(request, env, user, corsHeaders);
      case path.match(/^\/clients\/[a-f0-9-]+$/) && request.method === 'PUT':
        return await handleUpdateClient(path.replace('/clients/', ''), request, env, user, corsHeaders);
      case path.match(/^\/clients\/[a-f0-9-]+$/) && request.method === 'DELETE':
        return await handleDeleteClient(path.replace('/clients/', ''), env, user, corsHeaders);
      case path === '/stats' && request.method === 'GET':
        return await handleGetStats(env, user, corsHeaders);
      case path === '/types' && request.method === 'GET':
        return handleGetNewsletterTypes(corsHeaders);
      case path === '/structures' && request.method === 'GET':
        return handleGetNewsletterStructures(corsHeaders);
      case path === '/tones' && request.method === 'GET':
        return handleGetTones(corsHeaders);
      default:
        return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
    }
  } catch (e) {
    return jsonResponse({ error: 'Internal error', message: e.message }, 500, corsHeaders);
  }
}

// Note: Les fonctions newsletters completes sont dans le fichier original v7
// Pour le deploiement, copier les fonctions depuis cloudflare-worker-v7.js:
// - handleGenerateNewsletter, handleGenerateSequence, handleRegenerateNewsletter
// - handleListNewsletters, handleSaveNewsletter, handleGetNewsletter, etc.
// - handleListTemplates, handleCreateTemplate, handleDeleteTemplate
// - handleListClients, handleCreateClient, handleUpdateClient, handleDeleteClient
// - handleGetStats, handleGetNewsletterTypes, handleGetNewsletterStructures, handleGetTones
// - buildNewsletterSystemPrompt, buildNewsletterUserPrompt, etc.

async function handleGenerateNewsletter(request, env, user, corsHeaders) {
  // Copier depuis v7 - fonction complete
  return jsonResponse({ error: 'See v7 for full implementation' }, 501, corsHeaders);
}

async function handleGenerateSequence(request, env, user, corsHeaders) {
  return jsonResponse({ error: 'See v7 for full implementation' }, 501, corsHeaders);
}

async function handleRegenerateNewsletter(request, env, user, corsHeaders) {
  return jsonResponse({ error: 'See v7 for full implementation' }, 501, corsHeaders);
}

async function handleListNewsletters(url, env, user, corsHeaders) {
  const page = parseInt(url.searchParams.get('page')) || 1;
  const limit = parseInt(url.searchParams.get('limit')) || 20;
  const offset = (page - 1) * limit;
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/newsletters?user_id=eq.${user.id}&order=created_at.desc&limit=${limit}&offset=${offset}`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Prefer': 'count=exact' }
  });
  const newsletters = await response.json();
  return jsonResponse({ success: true, newsletters, pagination: { page, limit } }, 200, corsHeaders);
}

async function handleSaveNewsletter(request, env, user, corsHeaders) {
  return jsonResponse({ error: 'See v7 for full implementation' }, 501, corsHeaders);
}

async function handleGetNewsletter(id, env, user, corsHeaders) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/newsletters?id=eq.${id}&user_id=eq.${user.id}`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
  });
  const newsletters = await response.json();
  if (!newsletters[0]) return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  return jsonResponse({ success: true, newsletter: newsletters[0] }, 200, corsHeaders);
}

async function handleUpdateNewsletter(id, request, env, user, corsHeaders) {
  return jsonResponse({ error: 'See v7 for full implementation' }, 501, corsHeaders);
}

async function handleDeleteNewsletter(id, env, user, corsHeaders) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/newsletters?id=eq.${id}&user_id=eq.${user.id}`, {
    method: 'DELETE', headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
  });
  return jsonResponse({ success: true }, 200, corsHeaders);
}

async function handleListTemplates(url, env, user, corsHeaders) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/newsletter_templates?user_id=eq.${user.id}&order=use_count.desc`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
  });
  return jsonResponse({ success: true, templates: await response.json() }, 200, corsHeaders);
}

async function handleCreateTemplate(request, env, user, corsHeaders) {
  return jsonResponse({ error: 'See v7 for full implementation' }, 501, corsHeaders);
}

async function handleDeleteTemplate(id, env, user, corsHeaders) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/newsletter_templates?id=eq.${id}&user_id=eq.${user.id}`, {
    method: 'DELETE', headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
  });
  return jsonResponse({ success: true }, 200, corsHeaders);
}

async function handleListClients(env, user, corsHeaders) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/clients?user_id=eq.${user.id}&is_active=eq.true&order=name.asc`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
  });
  return jsonResponse({ success: true, clients: await response.json() }, 200, corsHeaders);
}

async function handleCreateClient(request, env, user, corsHeaders) {
  return jsonResponse({ error: 'See v7 for full implementation' }, 501, corsHeaders);
}

async function handleUpdateClient(id, request, env, user, corsHeaders) {
  return jsonResponse({ error: 'See v7 for full implementation' }, 501, corsHeaders);
}

async function handleDeleteClient(id, env, user, corsHeaders) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/clients?id=eq.${id}&user_id=eq.${user.id}`, {
    method: 'PATCH', headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: false })
  });
  return jsonResponse({ success: true }, 200, corsHeaders);
}

async function handleGetStats(env, user, corsHeaders) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/newsletters?user_id=eq.${user.id}&select=id`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
  });
  const newsletters = await response.json();
  return jsonResponse({ success: true, stats: { totalNewsletters: newsletters.length } }, 200, corsHeaders);
}

function handleGetNewsletterTypes(corsHeaders) {
  return jsonResponse({ success: true, types: [
    { id: 'launch', name: 'Lancement', icon: '🚀' },
    { id: 'nurturing', name: 'Nurturing', icon: '💝' },
    { id: 'promo', name: 'Promo', icon: '⚡' },
    { id: 'storytelling', name: 'Storytelling', icon: '📖' },
    { id: 'event', name: 'Evenement', icon: '🎉' }
  ]}, 200, corsHeaders);
}

function handleGetNewsletterStructures(corsHeaders) {
  return jsonResponse({ success: true, structures: [
    { id: 'aida', name: 'AIDA', icon: '🎯' },
    { id: 'pas', name: 'PAS', icon: '🔥' },
    { id: 'hook_story_offer', name: 'Hook + Story + Offer', icon: '📚' },
    { id: 'bab', name: 'Before/After/Bridge', icon: '🌉' }
  ]}, 200, corsHeaders);
}

function handleGetTones(corsHeaders) {
  return jsonResponse({ success: true, tones: [
    { id: 'warm', name: 'Chaleureux', icon: '☀️' },
    { id: 'direct', name: 'Direct', icon: '🎯' },
    { id: 'inspiring', name: 'Inspirant', icon: '✨' },
    { id: 'expert', name: 'Expert', icon: '🎓' }
  ]}, 200, corsHeaders);
}

// ============================================================
// VISUALS API (depuis v7 - simplifie)
// ============================================================

const ORSHOT_API_BASE = 'https://api.orshot.com/v1';

async function handleVisualsAPI(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/visuals', '');

  try {
    switch (true) {
      case path === '/generate' && request.method === 'POST':
        return await handleGenerateVisual(request, env, null, corsHeaders);
      case path === '/templates' && request.method === 'GET':
        return handleListVisualTemplates(url, corsHeaders);
      default:
        return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
    }
  } catch (e) {
    return jsonResponse({ error: 'Internal error', message: e.message }, 500, corsHeaders);
  }
}

async function handleGenerateVisual(request, env, user, corsHeaders) {
  const body = await request.json();
  const { content_data } = body;
  if (!content_data || !content_data.text) return jsonResponse({ error: 'Missing content_data.text' }, 400, corsHeaders);
  if (!env.ORSHOT_API_KEY) return jsonResponse({ error: 'Orshot not configured' }, 500, corsHeaders);

  const text = content_data.text || content_data.quote || '';
  const prompt = `Create a beautiful minimalist social media quote image. Quote: "${text.substring(0, 200)}". Style: clean, modern, professional.`;

  const orshotRes = await fetch(`${ORSHOT_API_BASE}/images/generations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.ORSHOT_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, n: 1, size: '1024x1024', response_format: 'url' })
  });

  if (!orshotRes.ok) {
    const err = await orshotRes.json().catch(() => ({}));
    return jsonResponse({ error: 'Orshot failed', details: err.message }, 502, corsHeaders);
  }

  const data = await orshotRes.json();
  const imageUrl = data.data?.[0]?.url || data.url || data.image_url;
  if (!imageUrl) return jsonResponse({ error: 'No image URL' }, 500, corsHeaders);

  return jsonResponse({ success: true, image_url: imageUrl }, 200, corsHeaders);
}

function handleListVisualTemplates(url, corsHeaders) {
  return jsonResponse({ formats: ['post_instagram', 'story_instagram', 'post_linkedin', 'quote'], templates: {} }, 200, corsHeaders);
}

// ============================================================
// API REST ENTERPRISE (depuis v7 - simplifie)
// ============================================================

async function handleAPIRequest(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/v1', '');
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) return jsonResponse({ error: 'API key required' }, 401, corsHeaders);

  const keyData = await validateAPIKey(apiKey, env);
  if (!keyData || !keyData.is_active) return jsonResponse({ error: 'Invalid API key' }, 401, corsHeaders);

  switch (true) {
    case path === '/structures' && request.method === 'GET':
      return jsonResponse({ success: true, structures: [
        { id: 'aida', name: 'AIDA' }, { id: 'pas', name: 'PAS' }, { id: 'storytelling', name: 'Storytelling' }
      ]}, 200, corsHeaders);
    case path === '/platforms' && request.method === 'GET':
      return jsonResponse({ success: true, platforms: [
        { id: 'linkedin', name: 'LinkedIn' }, { id: 'instagram', name: 'Instagram' }, { id: 'twitter', name: 'Twitter/X' }
      ]}, 200, corsHeaders);
    default:
      return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  }
}

// ============================================================
// FRONTEND REQUEST (depuis v7)
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
    let profileContext = "";
    if (userProfile && userProfile.nom) {
      profileContext = `\nPROFIL: ${userProfile.nom}, Domaine: ${userProfile.domaine || "N/A"}\n`;
    }

    const systemPrompt = `Tu es Tithot, une coach creative specialisee en personal branding.
${profileContext}
STYLE: Energique, bienveillante, utilise des emojis. Maximum 400 mots.`;

    const requestBody = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: body.messages
    });

    // Retry avec backoff exponentiel pour erreurs 529 (API overloaded)
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: requestBody
      });

      if (response.ok) {
        const data = await response.json();
        return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      // Erreur 529 = API overloaded, on retry avec backoff
      if (response.status === 529 && attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      const errorData = await response.text();
      lastError = { status: response.status, details: errorData };

      // Erreur 529 finale : message plus clair pour l'utilisateur
      if (response.status === 529) {
        return jsonResponse({
          error: "L'IA est temporairement surchargée. Réessaye dans quelques secondes.",
          code: "AI_OVERLOADED",
          details: errorData
        }, 503, corsHeaders);
      }

      return jsonResponse({ error: `Erreur API: ${response.status}`, details: errorData }, response.status, corsHeaders);
    }

    return jsonResponse({ error: "Erreur après plusieurs tentatives", details: lastError }, 503, corsHeaders);

  } catch (error) {
    return jsonResponse({ error: "Erreur serveur", message: error.message }, 500, corsHeaders);
  }
}

// ============================================================
// ADMIN API (depuis v7 - simplifie)
// ============================================================

async function handleAdminAPI(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return jsonResponse({ error: 'Auth required' }, 401, corsHeaders);

  const token = authHeader.replace('Bearer ', '');
  const isAdmin = await verifyAdminToken(token, env);
  if (!isAdmin) return jsonResponse({ error: 'Admin access required' }, 403, corsHeaders);

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/admin', '');

  if (path === '/stats' && request.method === 'GET') {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/users?select=id,plan`, {
      headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
    });
    const users = await response.json();
    return jsonResponse({ success: true, stats: { total_users: users.length } }, 200, corsHeaders);
  }

  return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
}

async function verifyAdminToken(token, env) {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': env.SUPABASE_SERVICE_KEY }
    });
    if (!response.ok) return false;
    const user = await response.json();
    return ['sandra@myinnerquest.fr', 'admin@myinnerquest.fr'].includes(user.email?.toLowerCase());
  } catch (e) { return false; }
}

// ============================================================
// LEMON SQUEEZY WEBHOOKS (depuis v7 - simplifie)
// ============================================================

async function handleLemonSqueezyWebhook(request, env, corsHeaders) {
  try {
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);
    const eventType = payload.meta?.event_name;
    console.log(`Lemon Squeezy webhook: ${eventType}`);
    return jsonResponse({ received: true, event: eventType }, 200, corsHeaders);
  } catch (e) {
    return jsonResponse({ error: 'Webhook error', message: e.message }, 500, corsHeaders);
  }
}

// ============================================================
// BREVO CONTACT (depuis v7)
// ============================================================

async function handleBrevoContact(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { email, name, source } = body;
    if (!email) return jsonResponse({ error: 'Email required' }, 400, corsHeaders);

    if (!env.BREVO_API_KEY) return jsonResponse({ success: true, message: 'Brevo not configured' }, 200, corsHeaders);

    await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
      body: JSON.stringify({ email: email.toLowerCase(), attributes: { PRENOM: name ? name.split(' ')[0] : '' }, listIds: [3], updateEnabled: true })
    });

    return jsonResponse({ success: true, message: 'Contact added' }, 200, corsHeaders);
  } catch (e) {
    return jsonResponse({ error: 'Failed', message: e.message }, 500, corsHeaders);
  }
}

// ============================================================
// HELPERS
// ============================================================

function jsonResponse(data, status, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
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

async function validateAPIKey(key, env) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/api_keys?key_hash=eq.${hashHex}&select=*`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
  });
  const keys = await response.json();
  return keys[0] || null;
}
