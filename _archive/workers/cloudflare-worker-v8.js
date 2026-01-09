// cloudflare-worker-v8.js - Avec Module Prospects + Campagnes Email + Brevo
// Variables d'environnement requises:
// - ANTHROPIC_API_KEY
// - PERPLEXITY_API_KEY
// - SUPABASE_URL
// - SUPABASE_SERVICE_KEY (service_role pour le worker)
// - LEMONSQUEEZY_WEBHOOK_SECRET (pour verifier les signatures des webhooks)
// - BREVO_API_KEY (pour envoyer des emails via Brevo)
// - ORSHOT_API_KEY (pour la generation de visuels)

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

    // ============ BREVO WEBHOOKS (Tracking emails) ============
    if (url.pathname === '/webhook/brevo' && request.method === 'POST') {
      return handleBrevoWebhook(request, env, corsHeaders);
    }

    // ============ BREVO - Ajouter un contact (pour le frontend) ============
    if (url.pathname === '/api/brevo/contact' && request.method === 'POST') {
      return handleBrevoContact(request, env, corsHeaders);
    }

    // ============ ADMIN API ============
    if (url.pathname.startsWith('/api/admin/')) {
      return handleAdminAPI(request, env, corsHeaders);
    }

    // ============ CAMPAIGNS API (/api/campaigns/*) ============
    if (url.pathname.startsWith('/api/campaigns')) {
      return handleCampaignsAPI(request, env, corsHeaders);
    }

    // ============ PROSPECTS API (/api/prospects/*) ============
    if (url.pathname.startsWith('/api/prospects')) {
      return handleProspectsAPI(request, env, corsHeaders);
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
// CAMPAIGNS API - Module Prospection & Emailing
// ============================================================

async function handleCampaignsAPI(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/campaigns', '');

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
      // ============ GENERATION EMAIL IA ============
      // POST /api/campaigns/generate-email - Generer un email personnalise
      case path === '/generate-email' && request.method === 'POST':
        return await handleGenerateProspectEmail(request, env, user, corsHeaders);

      // ============ ENVOI EMAIL BREVO ============
      // POST /api/campaigns/send-email - Envoyer un email via Brevo
      case path === '/send-email' && request.method === 'POST':
        return await handleSendEmail(request, env, user, corsHeaders);

      // POST /api/campaigns/:id/send - Envoyer une campagne complete
      case path.match(/^\/[a-f0-9-]+\/send$/) && request.method === 'POST':
        const sendCampaignId = path.replace('/send', '').slice(1);
        return await handleSendCampaign(sendCampaignId, env, user, corsHeaders);

      // ============ CRUD CAMPAGNES ============
      // GET /api/campaigns - Lister les campagnes
      case path === '' && request.method === 'GET':
        return await handleListCampaigns(url, env, user, corsHeaders);

      // POST /api/campaigns - Creer une campagne
      case path === '' && request.method === 'POST':
        return await handleCreateCampaign(request, env, user, corsHeaders);

      // GET /api/campaigns/:id - Detail d'une campagne
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'GET':
        const getCampaignId = path.slice(1);
        return await handleGetCampaign(getCampaignId, env, user, corsHeaders);

      // PUT /api/campaigns/:id - Mettre a jour une campagne
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'PUT':
        const updateCampaignId = path.slice(1);
        return await handleUpdateCampaign(updateCampaignId, request, env, user, corsHeaders);

      // DELETE /api/campaigns/:id - Supprimer une campagne
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'DELETE':
        const deleteCampaignId = path.slice(1);
        return await handleDeleteCampaign(deleteCampaignId, env, user, corsHeaders);

      // GET /api/campaigns/:id/emails - Emails d'une campagne
      case path.match(/^\/[a-f0-9-]+\/emails$/) && request.method === 'GET':
        const emailsCampaignId = path.replace('/emails', '').slice(1);
        return await handleGetCampaignEmails(emailsCampaignId, env, user, corsHeaders);

      // GET /api/campaigns/stats - Stats globales
      case path === '/stats' && request.method === 'GET':
        return await handleGetCampaignStats(env, user, corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found', code: 'NOT_FOUND' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Campaigns API Error:', error);
    return jsonResponse({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: error.message
    }, 500, corsHeaders);
  }
}

// ============================================================
// GENERATION EMAIL PROSPECTION (IA)
// ============================================================

async function handleGenerateProspectEmail(request, env, user, corsHeaders) {
  const body = await request.json();

  const {
    prospect,
    campaign_goal,
    language = 'fr',
    use_my_voice = true
  } = body;

  if (!prospect || !prospect.email || !prospect.first_name) {
    return jsonResponse({
      error: 'Missing prospect info (email, first_name required)',
      code: 'MISSING_FIELDS'
    }, 400, corsHeaders);
  }

  if (!campaign_goal) {
    return jsonResponse({
      error: 'Missing campaign_goal',
      code: 'MISSING_FIELDS'
    }, 400, corsHeaders);
  }

  // Recuperer le profil "Ma Voix" si demande
  let voiceContext = "";
  if (use_my_voice) {
    const voiceProfile = await getUserVoiceProfile(user.id, env);
    if (voiceProfile) {
      voiceContext = buildProspectVoiceContext(voiceProfile);
    }
  }

  // Construire le prompt
  const systemPrompt = buildProspectEmailSystemPrompt(language, voiceContext);
  const userPrompt = buildProspectEmailUserPrompt(prospect, campaign_goal, language);

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
      max_tokens: 1500,
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

  // Parser la reponse JSON
  let parsedContent;
  try {
    const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedContent = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found');
    }
  } catch (e) {
    console.error("Parse error:", e);
    // Fallback structure
    parsedContent = {
      subject_lines: ["Objet a personnaliser"],
      body: generatedContent,
      preview_text: ""
    };
  }

  return jsonResponse({
    success: true,
    email: {
      subject_lines: parsedContent.subject_lines || parsedContent.subjects || ["Objet 1", "Objet 2", "Objet 3"],
      body: parsedContent.body || parsedContent.content || generatedContent,
      preview_text: parsedContent.preview_text || parsedContent.preview || ""
    },
    prospect_id: prospect.id,
    usage: {
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0
    }
  }, 200, corsHeaders);
}

/**
 * Construit le prompt systeme pour les emails de prospection
 */
function buildProspectEmailSystemPrompt(language, voiceContext) {
  const languageInstructions = language === 'en'
    ? `
LANGUAGE: Write in American English.
CULTURAL ADAPTATION:
- Use American business conventions
- Be direct and get to the point quickly
- Use contractions (I'm, you're, we'll)
- Keep it casual but professional
- Americans appreciate confidence and clarity
`
    : `
LANGUE : Ecris en francais.
ADAPTATION CULTURELLE :
- Utilise les conventions business francaises
- Tu peux etre un peu plus relationnel avant d'entrer dans le vif
- Tutoiement OU vouvoiement selon le ton de "Ma Voix"
- Ton chaleureux mais professionnel
`;

  return `Tu es un expert en copywriting et en cold emailing.
Tu generes des emails de prospection personnalises et authentiques.

${languageInstructions}

${voiceContext}

REGLES IMPORTANTES :
1. L'email doit sembler ecrit par un humain, pas par une IA
2. Personnalise avec les infos du prospect (entreprise, poste)
3. Garde le style de "Ma Voix" si fourni
4. Pas de phrases cliches ("j'espere que vous allez bien", "I hope this email finds you well")
5. Sois concis (max 150 mots)
6. Termine par une question ouverte, pas un CTA agressif
7. Pas de lien dans le premier email
8. Pas d'emojis sauf si le style "Ma Voix" en utilise

FORMAT DE REPONSE OBLIGATOIRE (JSON valide) :
{
  "subject_lines": ["Option 1", "Option 2", "Option 3"],
  "body": "Le corps de l'email...",
  "preview_text": "Texte de preview (50 caracteres max)"
}`;
}

/**
 * Construit le prompt utilisateur pour les emails de prospection
 */
function buildProspectEmailUserPrompt(prospect, campaignGoal, language) {
  return `PROSPECT :
- Prenom : ${prospect.first_name}
- Nom : ${prospect.last_name || 'N/A'}
- Email : ${prospect.email}
- Entreprise : ${prospect.company || 'N/A'}
- Poste : ${prospect.job_title || 'N/A'}
- Secteur : ${prospect.sector || 'N/A'}
- LinkedIn : ${prospect.linkedin_url || 'N/A'}

OBJECTIF DE L'EMAIL : ${campaignGoal}

LANGUE : ${language === 'en' ? 'English' : 'Francais'}

Genere un email de prospection personnalise en JSON.`;
}

/**
 * Construit le contexte "Ma Voix" pour la prospection
 */
function buildProspectVoiceContext(voiceProfile) {
  if (!voiceProfile) return "";

  let context = `\nSTYLE "MA VOIX" :
Voici le style d'ecriture de l'utilisateur. Imite-le fidelement :`;

  if (voiceProfile.voice_tone) {
    context += `\n- Ton : ${voiceProfile.voice_tone}`;
  }
  if (voiceProfile.voice_formality) {
    context += `\n- Formalite : ${voiceProfile.voice_formality}`;
  }
  if (voiceProfile.voice_keywords && voiceProfile.voice_keywords.length > 0) {
    context += `\n- Expressions cles : ${voiceProfile.voice_keywords.join(', ')}`;
  }
  if (voiceProfile.voice_samples && voiceProfile.voice_samples.length > 0) {
    context += `\n\nExemples de textes de reference :`;
    voiceProfile.voice_samples.slice(0, 3).forEach((sample, i) => {
      context += `\n${i + 1}. "${sample.substring(0, 300)}..."`;
    });
  }

  return context;
}

/**
 * Recupere le profil "Ma Voix" de l'utilisateur
 */
async function getUserVoiceProfile(userId, env) {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=voice_samples,voice_tone,voice_formality,voice_keywords`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data[0] || null;
  } catch (error) {
    console.error('Error fetching voice profile:', error);
    return null;
  }
}

// ============================================================
// ENVOI EMAIL VIA BREVO
// ============================================================

async function handleSendEmail(request, env, user, corsHeaders) {
  const body = await request.json();

  const {
    to_email,
    to_name,
    from_email,
    from_name,
    reply_to,
    subject,
    html_content,
    text_content,
    tags = []
  } = body;

  if (!to_email || !from_email || !subject) {
    return jsonResponse({
      error: 'Missing required fields: to_email, from_email, subject',
      code: 'MISSING_FIELDS'
    }, 400, corsHeaders);
  }

  try {
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { name: from_name || from_email, email: from_email },
        to: [{ email: to_email, name: to_name || to_email }],
        replyTo: { email: reply_to || from_email },
        subject: subject,
        htmlContent: html_content || `<p>${text_content || ''}</p>`,
        textContent: text_content,
        tags: ['sos-storytelling', ...tags]
      })
    });

    if (!brevoResponse.ok) {
      const error = await brevoResponse.json();
      console.error('Brevo Error:', error);
      return jsonResponse({
        error: 'Email send failed',
        code: 'BREVO_ERROR',
        details: error.message
      }, 502, corsHeaders);
    }

    const data = await brevoResponse.json();

    return jsonResponse({
      success: true,
      message_id: data.messageId
    }, 200, corsHeaders);

  } catch (error) {
    console.error('Send email error:', error);
    return jsonResponse({
      error: 'Email send failed',
      code: 'SEND_ERROR',
      message: error.message
    }, 500, corsHeaders);
  }
}

/**
 * Envoie tous les emails d'une campagne
 */
async function handleSendCampaign(campaignId, env, user, corsHeaders) {
  // Recuperer la campagne
  const campaignResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaignId}&user_id=eq.${user.id}`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const campaigns = await campaignResponse.json();
  const campaign = campaigns[0];

  if (!campaign) {
    return jsonResponse({ error: 'Campaign not found', code: 'NOT_FOUND' }, 404, corsHeaders);
  }

  if (campaign.status !== 'draft') {
    return jsonResponse({ error: 'Campaign already sent or in progress', code: 'INVALID_STATUS' }, 400, corsHeaders);
  }

  // Recuperer les emails a envoyer
  const emailsResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/campaign_emails?campaign_id=eq.${campaignId}&status=eq.pending&select=*,prospects(*)`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const emails = await emailsResponse.json();

  if (emails.length === 0) {
    return jsonResponse({ error: 'No emails to send', code: 'NO_EMAILS' }, 400, corsHeaders);
  }

  // Mettre a jour le statut de la campagne
  await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaignId}`, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      status: 'sending',
      started_at: new Date().toISOString()
    })
  });

  // Envoyer chaque email
  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    const prospect = email.prospects;
    if (!prospect) continue;

    try {
      // Convertir le body en HTML
      const htmlBody = email.body.replace(/\n/g, '<br>');

      const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': env.BREVO_API_KEY
        },
        body: JSON.stringify({
          sender: { name: campaign.sender_name, email: campaign.sender_email },
          to: [{ email: prospect.email, name: `${prospect.first_name} ${prospect.last_name || ''}`.trim() }],
          replyTo: { email: campaign.reply_to || campaign.sender_email },
          subject: email.subject,
          htmlContent: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${htmlBody}</div>`,
          textContent: email.body,
          tags: ['sos-storytelling', 'campaign', campaignId],
          headers: {
            'X-Campaign-Id': campaignId,
            'X-Email-Id': email.id
          }
        })
      });

      if (brevoResponse.ok) {
        const brevoData = await brevoResponse.json();

        // Mettre a jour l'email
        await fetch(`${env.SUPABASE_URL}/rest/v1/campaign_emails?id=eq.${email.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            status: 'sent',
            brevo_message_id: brevoData.messageId,
            sent_at: new Date().toISOString()
          })
        });

        // Mettre a jour le prospect
        await fetch(`${env.SUPABASE_URL}/rest/v1/prospects?id=eq.${prospect.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            status: 'contacted',
            emails_sent: (prospect.emails_sent || 0) + 1,
            last_contacted_at: new Date().toISOString()
          })
        });

        sent++;
      } else {
        const errorData = await brevoResponse.json();
        console.error('Brevo send error:', errorData);

        await fetch(`${env.SUPABASE_URL}/rest/v1/campaign_emails?id=eq.${email.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            status: 'failed'
          })
        });

        failed++;
      }

      // Petit delai entre les envois pour eviter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error('Email send error:', error);
      failed++;
    }
  }

  // Mettre a jour les stats de la campagne
  await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaignId}`, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      status: 'sent',
      emails_sent: sent,
      completed_at: new Date().toISOString()
    })
  });

  return jsonResponse({
    success: true,
    sent: sent,
    failed: failed,
    total: emails.length
  }, 200, corsHeaders);
}

// ============================================================
// BREVO WEBHOOK (Tracking ouvertures, clics, bounces)
// ============================================================

async function handleBrevoWebhook(request, env, corsHeaders) {
  try {
    const event = await request.json();

    const {
      event: eventType,
      email,
      'message-id': messageId,
      tag
    } = event;

    // Logger l'evenement
    await fetch(`${env.SUPABASE_URL}/rest/v1/email_events`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        email: email,
        message_id: messageId,
        event_type: eventType,
        payload: event
      })
    });

    // Mettre a jour le statut du prospect selon l'evenement
    let prospectStatus = null;
    let updateFields = {};

    switch (eventType) {
      case 'delivered':
        prospectStatus = 'contacted';
        break;

      case 'opened':
      case 'unique_opened':
        prospectStatus = 'opened';
        updateFields.last_opened_at = new Date().toISOString();
        break;

      case 'click':
        prospectStatus = 'clicked';
        updateFields.last_clicked_at = new Date().toISOString();
        break;

      case 'hard_bounce':
      case 'soft_bounce':
        prospectStatus = 'bounced';
        break;

      case 'unsubscribed':
      case 'complaint':
        prospectStatus = 'unsubscribed';
        break;
    }

    if (prospectStatus) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/prospects?email=eq.${encodeURIComponent(email.toLowerCase())}`, {
        method: 'PATCH',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          status: prospectStatus,
          ...updateFields
        })
      });
    }

    // Mettre a jour les stats de la campagne si message_id correspond
    if (messageId) {
      // Trouver l'email de campagne
      const emailResponse = await fetch(
        `${env.SUPABASE_URL}/rest/v1/campaign_emails?brevo_message_id=eq.${messageId}&select=id,campaign_id,status`,
        {
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
          }
        }
      );

      const emails = await emailResponse.json();
      if (emails.length > 0) {
        const campaignEmail = emails[0];

        // Mettre a jour l'email de campagne
        let emailStatus = campaignEmail.status;
        let emailUpdateFields = {};

        switch (eventType) {
          case 'delivered':
            emailStatus = 'delivered';
            emailUpdateFields.delivered_at = new Date().toISOString();
            break;
          case 'opened':
          case 'unique_opened':
            emailStatus = 'opened';
            emailUpdateFields.opened_at = new Date().toISOString();
            break;
          case 'click':
            emailStatus = 'clicked';
            emailUpdateFields.clicked_at = new Date().toISOString();
            break;
          case 'hard_bounce':
          case 'soft_bounce':
            emailStatus = 'bounced';
            break;
        }

        await fetch(`${env.SUPABASE_URL}/rest/v1/campaign_emails?id=eq.${campaignEmail.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            status: emailStatus,
            ...emailUpdateFields
          })
        });

        // Mettre a jour les stats de la campagne
        const statsField = {
          'opened': 'emails_opened',
          'unique_opened': 'emails_opened',
          'click': 'emails_clicked',
          'hard_bounce': 'emails_bounced',
          'soft_bounce': 'emails_bounced'
        }[eventType];

        if (statsField) {
          // Incrementer le compteur (via RPC serait plus propre, mais increment simple ici)
          const campaignResponse = await fetch(
            `${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaignEmail.campaign_id}&select=${statsField}`,
            {
              headers: {
                'apikey': env.SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
              }
            }
          );
          const campaigns = await campaignResponse.json();
          if (campaigns.length > 0) {
            const currentValue = campaigns[0][statsField] || 0;
            await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaignEmail.campaign_id}`, {
              method: 'PATCH',
              headers: {
                'apikey': env.SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                [statsField]: currentValue + 1
              })
            });
          }
        }
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Brevo webhook error:', error);
    return new Response('Error', { status: 500, headers: corsHeaders });
  }
}

// ============================================================
// CRUD CAMPAGNES
// ============================================================

async function handleListCampaigns(url, env, user, corsHeaders) {
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = `${env.SUPABASE_URL}/rest/v1/email_campaigns?user_id=eq.${user.id}&order=created_at.desc&limit=${limit}&offset=${offset}`;

  if (status) {
    query += `&status=eq.${status}`;
  }

  const response = await fetch(query, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Prefer': 'count=exact'
    }
  });

  const total = response.headers.get('Content-Range')?.split('/')[1] || 0;
  const campaigns = await response.json();

  return jsonResponse({
    campaigns,
    total: parseInt(total),
    limit,
    offset
  }, 200, corsHeaders);
}

async function handleCreateCampaign(request, env, user, corsHeaders) {
  const body = await request.json();

  const campaignData = {
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
    status: 'draft'
  };

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/email_campaigns`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(campaignData)
  });

  if (!response.ok) {
    const error = await response.json();
    return jsonResponse({ error: 'Failed to create campaign', details: error }, 400, corsHeaders);
  }

  const [campaign] = await response.json();

  return jsonResponse({ success: true, campaign }, 201, corsHeaders);
}

async function handleGetCampaign(id, env, user, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${id}&user_id=eq.${user.id}`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const campaigns = await response.json();
  const campaign = campaigns[0];

  if (!campaign) {
    return jsonResponse({ error: 'Campaign not found', code: 'NOT_FOUND' }, 404, corsHeaders);
  }

  return jsonResponse({ campaign }, 200, corsHeaders);
}

async function handleUpdateCampaign(id, request, env, user, corsHeaders) {
  const body = await request.json();

  // Filtrer les champs autorisés
  const allowedFields = ['name', 'description', 'sender_email', 'sender_name', 'reply_to',
    'goal', 'language', 'use_my_voice', 'generate_unique_per_prospect', 'prospect_filter',
    'total_prospects', 'subject_template', 'body_template', 'status'];

  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }
  updates.updated_at = new Date().toISOString();

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${id}&user_id=eq.${user.id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updates)
    }
  );

  const campaigns = await response.json();
  const campaign = campaigns[0];

  if (!campaign) {
    return jsonResponse({ error: 'Campaign not found', code: 'NOT_FOUND' }, 404, corsHeaders);
  }

  return jsonResponse({ success: true, campaign }, 200, corsHeaders);
}

async function handleDeleteCampaign(id, env, user, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${id}&user_id=eq.${user.id}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!response.ok) {
    return jsonResponse({ error: 'Delete failed', code: 'DELETE_FAILED' }, 400, corsHeaders);
  }

  return jsonResponse({ success: true }, 200, corsHeaders);
}

async function handleGetCampaignEmails(campaignId, env, user, corsHeaders) {
  // Verifier que la campagne appartient a l'utilisateur
  const campaignResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaignId}&user_id=eq.${user.id}&select=id`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const campaigns = await campaignResponse.json();
  if (campaigns.length === 0) {
    return jsonResponse({ error: 'Campaign not found', code: 'NOT_FOUND' }, 404, corsHeaders);
  }

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/campaign_emails?campaign_id=eq.${campaignId}&select=*,prospects(first_name,last_name,email,company)&order=created_at.desc`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const emails = await response.json();

  return jsonResponse({ emails }, 200, corsHeaders);
}

async function handleGetCampaignStats(env, user, corsHeaders) {
  // Stats globales de toutes les campagnes
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/email_campaigns?user_id=eq.${user.id}&select=status,emails_sent,emails_opened,emails_clicked,emails_replied,emails_bounced`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const campaigns = await response.json();

  const stats = {
    total_campaigns: campaigns.length,
    campaigns_by_status: {},
    total_sent: 0,
    total_opened: 0,
    total_clicked: 0,
    total_replied: 0,
    total_bounced: 0,
    open_rate: 0,
    click_rate: 0
  };

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
// PROSPECTS API
// ============================================================

async function handleProspectsAPI(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/prospects', '');

  // Authentification
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
      // GET /api/prospects - Lister les prospects
      case path === '' && request.method === 'GET':
        return await handleListProspects(url, env, user, corsHeaders);

      // POST /api/prospects - Creer un prospect
      case path === '' && request.method === 'POST':
        return await handleCreateProspect(request, env, user, corsHeaders);

      // POST /api/prospects/import - Import batch
      case path === '/import' && request.method === 'POST':
        return await handleImportProspects(request, env, user, corsHeaders);

      // GET /api/prospects/stats - Stats
      case path === '/stats' && request.method === 'GET':
        return await handleGetProspectStats(env, user, corsHeaders);

      // GET /api/prospects/:id - Detail
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'GET':
        const getId = path.slice(1);
        return await handleGetProspect(getId, env, user, corsHeaders);

      // PUT /api/prospects/:id - Update
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'PUT':
        const updateId = path.slice(1);
        return await handleUpdateProspect(updateId, request, env, user, corsHeaders);

      // DELETE /api/prospects/:id - Delete
      case path.match(/^\/[a-f0-9-]+$/) && request.method === 'DELETE':
        const deleteId = path.slice(1);
        return await handleDeleteProspect(deleteId, env, user, corsHeaders);

      // DELETE /api/prospects - Delete batch
      case path === '' && request.method === 'DELETE':
        return await handleDeleteProspects(request, env, user, corsHeaders);

      default:
        return jsonResponse({ error: 'Endpoint not found', code: 'NOT_FOUND' }, 404, corsHeaders);
    }
  } catch (error) {
    console.error('Prospects API Error:', error);
    return jsonResponse({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: error.message
    }, 500, corsHeaders);
  }
}

async function handleListProspects(url, env, user, corsHeaders) {
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = `${env.SUPABASE_URL}/rest/v1/prospects?user_id=eq.${user.id}&order=created_at.desc&limit=${limit}&offset=${offset}`;

  if (status && status !== 'all') {
    query += `&status=eq.${status}`;
  }

  if (search) {
    query += `&or=(first_name.ilike.*${search}*,last_name.ilike.*${search}*,email.ilike.*${search}*,company.ilike.*${search}*)`;
  }

  const response = await fetch(query, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Prefer': 'count=exact'
    }
  });

  const total = response.headers.get('Content-Range')?.split('/')[1] || 0;
  const prospects = await response.json();

  return jsonResponse({
    prospects,
    total: parseInt(total),
    limit,
    offset
  }, 200, corsHeaders);
}

async function handleCreateProspect(request, env, user, corsHeaders) {
  const body = await request.json();

  if (!body.email || !body.first_name) {
    return jsonResponse({
      error: 'Missing required fields: email, first_name',
      code: 'MISSING_FIELDS'
    }, 400, corsHeaders);
  }

  const prospectData = {
    user_id: user.id,
    email: body.email.toLowerCase().trim(),
    first_name: body.first_name,
    last_name: body.last_name || null,
    company: body.company || null,
    job_title: body.job_title || null,
    linkedin_url: body.linkedin_url || null,
    phone: body.phone || null,
    website: body.website || null,
    sector: body.sector || null,
    city: body.city || null,
    company_size: body.company_size || null,
    notes: body.notes || null,
    source: body.source || 'manual',
    status: 'new'
  };

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/prospects`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(prospectData)
  });

  if (!response.ok) {
    const error = await response.json();
    return jsonResponse({ error: 'Failed to create prospect', details: error }, 400, corsHeaders);
  }

  const [prospect] = await response.json();

  return jsonResponse({ success: true, prospect }, 201, corsHeaders);
}

async function handleImportProspects(request, env, user, corsHeaders) {
  const body = await request.json();

  if (!body.prospects || !Array.isArray(body.prospects)) {
    return jsonResponse({
      error: 'Missing prospects array',
      code: 'MISSING_FIELDS'
    }, 400, corsHeaders);
  }

  const source = body.source || 'csv_import';

  const prospectsToInsert = body.prospects.map(p => ({
    user_id: user.id,
    email: p.email.toLowerCase().trim(),
    first_name: p.first_name,
    last_name: p.last_name || null,
    company: p.company || null,
    job_title: p.job_title || null,
    linkedin_url: p.linkedin_url || p.linkedin || null,
    phone: p.phone || null,
    website: p.website || null,
    sector: p.sector || null,
    city: p.city || null,
    company_size: p.company_size || null,
    source: source,
    status: 'new'
  }));

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/prospects?on_conflict=user_id,email`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation,resolution=ignore-duplicates'
    },
    body: JSON.stringify(prospectsToInsert)
  });

  const imported = await response.json();

  return jsonResponse({
    success: true,
    imported: imported.length,
    total: prospectsToInsert.length
  }, 201, corsHeaders);
}

async function handleGetProspect(id, env, user, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/prospects?id=eq.${id}&user_id=eq.${user.id}`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const prospects = await response.json();
  const prospect = prospects[0];

  if (!prospect) {
    return jsonResponse({ error: 'Prospect not found', code: 'NOT_FOUND' }, 404, corsHeaders);
  }

  return jsonResponse({ prospect }, 200, corsHeaders);
}

async function handleUpdateProspect(id, request, env, user, corsHeaders) {
  const body = await request.json();

  const allowedFields = ['first_name', 'last_name', 'company', 'job_title',
    'linkedin_url', 'phone', 'website', 'sector', 'city', 'company_size',
    'notes', 'status', 'tags'];

  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }
  updates.updated_at = new Date().toISOString();

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/prospects?id=eq.${id}&user_id=eq.${user.id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updates)
    }
  );

  const prospects = await response.json();
  const prospect = prospects[0];

  if (!prospect) {
    return jsonResponse({ error: 'Prospect not found', code: 'NOT_FOUND' }, 404, corsHeaders);
  }

  return jsonResponse({ success: true, prospect }, 200, corsHeaders);
}

async function handleDeleteProspect(id, env, user, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/prospects?id=eq.${id}&user_id=eq.${user.id}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!response.ok) {
    return jsonResponse({ error: 'Delete failed', code: 'DELETE_FAILED' }, 400, corsHeaders);
  }

  return jsonResponse({ success: true }, 200, corsHeaders);
}

async function handleDeleteProspects(request, env, user, corsHeaders) {
  const body = await request.json();

  if (!body.ids || !Array.isArray(body.ids)) {
    return jsonResponse({ error: 'Missing ids array', code: 'MISSING_FIELDS' }, 400, corsHeaders);
  }

  const idsParam = body.ids.map(id => `"${id}"`).join(',');

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/prospects?id=in.(${idsParam})&user_id=eq.${user.id}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!response.ok) {
    return jsonResponse({ error: 'Delete failed', code: 'DELETE_FAILED' }, 400, corsHeaders);
  }

  return jsonResponse({ success: true, deleted: body.ids.length }, 200, corsHeaders);
}

async function handleGetProspectStats(env, user, corsHeaders) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/prospects?user_id=eq.${user.id}&select=status`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const prospects = await response.json();

  const stats = {
    total: prospects.length,
    new: 0,
    contacted: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    converted: 0,
    unsubscribed: 0,
    bounced: 0
  };

  prospects.forEach(p => {
    if (stats[p.status] !== undefined) {
      stats[p.status]++;
    }
  });

  return jsonResponse({ stats }, 200, corsHeaders);
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

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

// ============================================================
// NOTE: Les autres handlers existants (newsletters, visuals, admin, etc.)
// doivent etre copies depuis cloudflare-worker-v7.js
// Ce fichier ne contient que les NOUVELLES fonctionnalites
// ============================================================

// Placeholder pour les handlers existants
async function handleNewslettersAPI(request, env, corsHeaders) {
  // Copier depuis v7
  return jsonResponse({ error: 'Not implemented' }, 501, corsHeaders);
}

async function handleVisualsAPI(request, env, corsHeaders) {
  // Copier depuis v7
  return jsonResponse({ error: 'Not implemented' }, 501, corsHeaders);
}

async function handleAdminAPI(request, env, corsHeaders) {
  // Copier depuis v7
  return jsonResponse({ error: 'Not implemented' }, 501, corsHeaders);
}

async function handleAPIRequest(request, env, corsHeaders) {
  // Copier depuis v7
  return jsonResponse({ error: 'Not implemented' }, 501, corsHeaders);
}

async function handleFrontendRequest(request, env, corsHeaders) {
  // Copier depuis v7
  return jsonResponse({ error: 'Not implemented' }, 501, corsHeaders);
}

async function handleLemonSqueezyWebhook(request, env, corsHeaders) {
  // Copier depuis v7
  return jsonResponse({ error: 'Not implemented' }, 501, corsHeaders);
}

async function handleBrevoContact(request, env, corsHeaders) {
  // Copier depuis v7
  return jsonResponse({ error: 'Not implemented' }, 501, corsHeaders);
}
