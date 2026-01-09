/**
 * INBOX INTELLIGENTE - Cloudflare Worker
 * Gère la synchronisation des emails, l'analyse IA et les actions
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      // Routes
      switch (url.pathname) {
        // OAuth
        case '/api/oauth/gmail/callback':
          return handleGmailCallback(request, env);
        case '/api/oauth/gmail/refresh':
          return handleRefreshToken(request, env);

        // Inbox
        case '/api/inbox/connection':
          return handleGetConnection(request, env);
        case '/api/inbox/disconnect':
          return handleDisconnect(request, env);
        case '/api/inbox/sync':
          return handleSyncEmails(request, env);
        case '/api/inbox/responses':
          return handleGetResponses(request, env);
        case '/api/inbox/update-status':
          return handleUpdateStatus(request, env);
        case '/api/inbox/generate-reply':
          return handleGenerateReply(request, env);
        case '/api/inbox/blacklist':
          return handleBlacklist(request, env);
        case '/api/inbox/stats':
          return handleGetStats(request, env);

        default:
          return jsonResponse({ error: 'Not found' }, 404);
      }
    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: error.message }, 500);
    }
  }
};

// =====================================================
// HELPERS
// =====================================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS
  });
}

async function getAuthUser(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.replace('Bearer ', '');

  // Vérifier le token avec Supabase
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': env.SUPABASE_SERVICE_KEY
    }
  });

  if (!response.ok) {
    throw new Error('Invalid token');
  }

  return await response.json();
}

async function supabaseQuery(env, table, options = {}) {
  const { select = '*', filters = [], order, limit, single = false } = options;

  let url = `${env.SUPABASE_URL}/rest/v1/${table}?select=${select}`;

  filters.forEach(f => {
    url += `&${f.column}=${f.operator}.${f.value}`;
  });

  if (order) {
    url += `&order=${order.column}.${order.ascending ? 'asc' : 'desc'}`;
  }

  if (limit) {
    url += `&limit=${limit}`;
  }

  const response = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Prefer': single ? 'return=representation, count=exact' : undefined
    }
  });

  const data = await response.json();
  return single && Array.isArray(data) ? data[0] : data;
}

async function supabaseInsert(env, table, data) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });

  return await response.json();
}

async function supabaseUpdate(env, table, id, data) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });

  return await response.json();
}

// =====================================================
// OAUTH GMAIL
// =====================================================

async function handleGmailCallback(request, env) {
  const { code, userId, redirectUri } = await request.json();

  // Le redirect_uri doit correspondre exactement à celui utilisé lors de l'autorisation
  const finalRedirectUri = redirectUri || 'https://sosstorytelling.fr/oauth-callback.html';

  // Échanger le code contre des tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      redirect_uri: finalRedirectUri,
      grant_type: 'authorization_code'
    })
  });

  const tokens = await tokenResponse.json();

  if (tokens.error) {
    return jsonResponse({ error: tokens.error_description || tokens.error }, 400);
  }

  // Récupérer l'email de l'utilisateur
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });
  const userInfo = await userInfoResponse.json();

  // Calculer l'expiration
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Sauvegarder dans Supabase (upsert)
  const existingConnection = await supabaseQuery(env, 'email_connections', {
    filters: [
      { column: 'user_id', operator: 'eq', value: userId },
      { column: 'provider', operator: 'eq', value: 'gmail' }
    ],
    single: true
  });

  const connectionData = {
    user_id: userId,
    provider: 'gmail',
    email: userInfo.email,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: expiresAt
  };

  if (existingConnection) {
    await supabaseUpdate(env, 'email_connections', existingConnection.id, connectionData);
  } else {
    await supabaseInsert(env, 'email_connections', connectionData);
  }

  return jsonResponse({
    success: true,
    email: userInfo.email
  });
}

async function handleRefreshToken(request, env) {
  const { userId } = await request.json();

  const connection = await supabaseQuery(env, 'email_connections', {
    filters: [
      { column: 'user_id', operator: 'eq', value: userId },
      { column: 'provider', operator: 'eq', value: 'gmail' }
    ],
    single: true
  });

  if (!connection?.refresh_token) {
    return jsonResponse({ error: 'No refresh token' }, 400);
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: connection.refresh_token,
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });

  const tokens = await tokenResponse.json();

  if (tokens.error) {
    return jsonResponse({ error: 'Token refresh failed' }, 400);
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabaseUpdate(env, 'email_connections', connection.id, {
    access_token: tokens.access_token,
    token_expires_at: expiresAt
  });

  return jsonResponse({
    success: true,
    access_token: tokens.access_token,
    expires_at: expiresAt
  });
}

async function getValidAccessToken(connection, env) {
  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();

  // Si le token expire dans moins de 5 minutes, le rafraîchir
  if (expiresAt - now < 5 * 60 * 1000) {
    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: connection.refresh_token,
        client_id: env.GMAIL_CLIENT_ID,
        client_secret: env.GMAIL_CLIENT_SECRET,
        grant_type: 'refresh_token'
      })
    });

    const tokens = await refreshResponse.json();

    if (!tokens.error) {
      const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      await supabaseUpdate(env, 'email_connections', connection.id, {
        access_token: tokens.access_token,
        token_expires_at: newExpiresAt
      });
      return tokens.access_token;
    }
  }

  return connection.access_token;
}

// =====================================================
// CONNEXION EMAIL
// =====================================================

async function handleGetConnection(request, env) {
  const user = await getAuthUser(request, env);

  const connection = await supabaseQuery(env, 'email_connections', {
    select: 'id,provider,email,last_sync_at,created_at',
    filters: [{ column: 'user_id', operator: 'eq', value: user.id }],
    single: true
  });

  return jsonResponse({ connection });
}

async function handleDisconnect(request, env) {
  const user = await getAuthUser(request, env);

  await fetch(`${env.SUPABASE_URL}/rest/v1/email_connections?user_id=eq.${user.id}`, {
    method: 'DELETE',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
    }
  });

  return jsonResponse({ success: true });
}

// =====================================================
// SYNCHRONISATION EMAILS
// =====================================================

async function handleSyncEmails(request, env) {
  const user = await getAuthUser(request, env);

  // 1. Récupérer la connexion
  const connection = await supabaseQuery(env, 'email_connections', {
    filters: [{ column: 'user_id', operator: 'eq', value: user.id }],
    single: true
  });

  if (!connection) {
    return jsonResponse({ error: 'No email connected' }, 400);
  }

  // 2. Obtenir un token valide
  const accessToken = await getValidAccessToken(connection, env);

  // 3. Récupérer les emails des prospects des campagnes actives
  const prospects = await supabaseQuery(env, 'prospects', {
    select: 'email',
    filters: [{ column: 'user_id', operator: 'eq', value: user.id }]
  });

  const prospectEmails = [...new Set(prospects.map(p => p.email))];

  if (prospectEmails.length === 0) {
    return jsonResponse({ synced: 0, message: 'No prospects to check' });
  }

  // 4. Récupérer les IDs de messages déjà traités
  const existingResponses = await supabaseQuery(env, 'email_responses', {
    select: 'gmail_message_id',
    filters: [{ column: 'user_id', operator: 'eq', value: user.id }]
  });
  const existingIds = new Set(existingResponses.map(r => r.gmail_message_id));

  // 5. Chercher les nouveaux emails
  const newEmails = await fetchEmailsFromProspects(accessToken, prospectEmails, existingIds);

  // 6. Analyser et sauvegarder chaque email
  const results = [];
  for (const email of newEmails.slice(0, 20)) { // Max 20 à la fois
    try {
      const analysis = await analyzeEmailWithClaude(email, env);

      const responseData = {
        user_id: user.id,
        gmail_message_id: email.id,
        thread_id: email.threadId,
        from_email: email.fromEmail,
        from_name: email.fromName,
        subject: email.subject,
        body_text: email.body,
        body_snippet: email.snippet,
        received_at: email.date,
        category: analysis.category,
        confidence: analysis.confidence,
        summary: analysis.summary,
        suggested_action: analysis.suggested_action,
        priority: analysis.priority,
        status: 'new'
      };

      const saved = await supabaseInsert(env, 'email_responses', responseData);
      results.push(saved[0]);

      // Envoyer notification si prioritaire
      if (['MEETING', 'INTERESTED'].includes(analysis.category)) {
        await sendNotification(user, saved[0], env);
      }
    } catch (e) {
      console.error('Error processing email:', e);
    }
  }

  // 7. Mettre à jour last_sync_at
  await supabaseUpdate(env, 'email_connections', connection.id, {
    last_sync_at: new Date().toISOString()
  });

  return jsonResponse({
    synced: results.length,
    responses: results
  });
}

async function fetchEmailsFromProspects(accessToken, prospectEmails, existingIds) {
  const emails = [];

  // Construire la query Gmail (max 10 emails à la fois dans la query)
  const batchSize = 10;
  for (let i = 0; i < prospectEmails.length; i += batchSize) {
    const batch = prospectEmails.slice(i, i + batchSize);
    const fromQuery = batch.map(e => `from:${e}`).join(' OR ');
    const query = `(${fromQuery}) newer_than:7d`;

    try {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      const data = await response.json();

      if (!data.messages) continue;

      // Récupérer le contenu de chaque email non traité
      for (const msg of data.messages) {
        if (existingIds.has(msg.id)) continue;

        const fullEmail = await fetchEmailContent(accessToken, msg.id);
        if (fullEmail) {
          emails.push(fullEmail);
        }
      }
    } catch (e) {
      console.error('Gmail API error:', e);
    }
  }

  return emails;
}

async function fetchEmailContent(accessToken, messageId) {
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    const data = await response.json();

    // Parser les headers
    const headers = data.payload?.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

    // Parser le From
    const fromRaw = getHeader('From') || '';
    const fromMatch = fromRaw.match(/^(.+?)\s*<(.+?)>$/);
    const fromName = fromMatch ? fromMatch[1].replace(/"/g, '') : '';
    const fromEmail = fromMatch ? fromMatch[2] : fromRaw;

    // Extraire le body
    let bodyText = '';
    if (data.payload?.body?.data) {
      bodyText = decodeBase64(data.payload.body.data);
    } else if (data.payload?.parts) {
      const textPart = data.payload.parts.find(p => p.mimeType === 'text/plain');
      if (textPart?.body?.data) {
        bodyText = decodeBase64(textPart.body.data);
      } else {
        const htmlPart = data.payload.parts.find(p => p.mimeType === 'text/html');
        if (htmlPart?.body?.data) {
          bodyText = stripHtml(decodeBase64(htmlPart.body.data));
        }
      }
    }

    return {
      id: data.id,
      threadId: data.threadId,
      fromName,
      fromEmail,
      subject: getHeader('Subject') || '',
      date: new Date(parseInt(data.internalDate)).toISOString(),
      snippet: data.snippet || '',
      body: bodyText.substring(0, 5000) // Limiter la taille
    };
  } catch (e) {
    console.error('Error fetching email content:', e);
    return null;
  }
}

function decodeBase64(data) {
  try {
    const decoded = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    return decoded;
  } catch (e) {
    return '';
  }
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gs, '')
    .replace(/<script[^>]*>.*?<\/script>/gs, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// =====================================================
// ANALYSE IA
// =====================================================

async function analyzeEmailWithClaude(email, env) {
  const prompt = `Tu es un assistant qui analyse les réponses à des campagnes de prospection par email.

Analyse cet email de réponse :

---
De: ${email.fromName} <${email.fromEmail}>
Sujet: ${email.subject}
Contenu:
${email.body?.substring(0, 2000)}
---

Classe cette réponse dans UNE des catégories suivantes :

- MEETING : Le prospect demande un RDV, propose un créneau, veut appeler
- INTERESTED : Le prospect montre de l'intérêt, veut en savoir plus, demande des infos
- OBJECTION : Le prospect a des doutes, pose des questions sur le prix, le timing, etc. mais n'a pas dit non
- NOT_INTERESTED : Le prospect dit clairement non, pas intéressé, pas le bon moment
- UNSUBSCRIBE : Le prospect demande explicitement à ne plus être contacté
- OUT_OF_OFFICE : Réponse automatique d'absence, congés, etc.
- OTHER : Autre (question hors sujet, transfert à quelqu'un d'autre, etc.)

Réponds UNIQUEMENT avec ce JSON, sans autre texte :
{
  "category": "CATEGORY_NAME",
  "confidence": 0.95,
  "summary": "Résumé en 1 phrase courte",
  "suggested_action": "Action suggérée",
  "priority": "high/medium/low"
}

Règles de priorité :
- high : MEETING (toujours), INTERESTED avec urgence
- medium : INTERESTED standard, OBJECTION
- low : NOT_INTERESTED, OUT_OF_OFFICE, OTHER, UNSUBSCRIBE`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Extraire le JSON de la réponse
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found');
  } catch (e) {
    console.error('Analysis error:', e);
    return {
      category: 'OTHER',
      confidence: 0.5,
      summary: 'Analyse automatique échouée',
      suggested_action: 'Lire manuellement',
      priority: 'medium'
    };
  }
}

// =====================================================
// RÉPONSES
// =====================================================

async function handleGetResponses(request, env) {
  const user = await getAuthUser(request, env);
  const url = new URL(request.url);

  const filter = url.searchParams.get('filter') || 'all';
  const limit = parseInt(url.searchParams.get('limit')) || 50;

  let filters = [{ column: 'user_id', operator: 'eq', value: user.id }];

  if (filter === 'high') {
    filters.push({ column: 'priority', operator: 'eq', value: 'high' });
    filters.push({ column: 'status', operator: 'neq', value: 'done' });
  } else if (filter === 'done') {
    filters.push({ column: 'status', operator: 'eq', value: 'done' });
  } else if (['MEETING', 'INTERESTED', 'OBJECTION', 'NOT_INTERESTED'].includes(filter)) {
    filters.push({ column: 'category', operator: 'eq', value: filter });
  } else if (filter !== 'all') {
    filters.push({ column: 'status', operator: 'neq', value: 'archived' });
  }

  const responses = await supabaseQuery(env, 'email_responses', {
    filters,
    order: { column: 'received_at', ascending: false },
    limit
  });

  return jsonResponse({ responses });
}

async function handleUpdateStatus(request, env) {
  const user = await getAuthUser(request, env);
  const { responseId, status, notes } = await request.json();

  const updateData = { status };
  if (notes !== undefined) {
    updateData.notes = notes;
  }
  if (status === 'done') {
    updateData.replied_at = new Date().toISOString();
  }

  const result = await supabaseUpdate(env, 'email_responses', responseId, updateData);

  return jsonResponse({ success: true, response: result[0] });
}

// =====================================================
// GÉNÉRATION DE RÉPONSE
// =====================================================

async function handleGenerateReply(request, env) {
  const user = await getAuthUser(request, env);
  const { responseId, tone = 'professional' } = await request.json();

  // Récupérer l'email
  const emailResponse = await supabaseQuery(env, 'email_responses', {
    filters: [
      { column: 'id', operator: 'eq', value: responseId },
      { column: 'user_id', operator: 'eq', value: user.id }
    ],
    single: true
  });

  if (!emailResponse) {
    return jsonResponse({ error: 'Response not found' }, 404);
  }

  // Récupérer le profil de voix de l'utilisateur
  const userProfile = await supabaseQuery(env, 'user_profiles', {
    filters: [{ column: 'user_id', operator: 'eq', value: user.id }],
    single: true
  });

  const toneInstructions = {
    professional: 'Ton professionnel mais chaleureux',
    friendly: 'Ton amical et décontracté',
    formal: 'Ton formel et courtois'
  };

  const prompt = `Tu es un assistant qui aide à rédiger des réponses à des prospects.

Email reçu :
---
De: ${emailResponse.from_name} <${emailResponse.from_email}>
Sujet: ${emailResponse.subject}
Contenu: ${emailResponse.body_text?.substring(0, 1500)}
---

Catégorie détectée : ${emailResponse.category}
Résumé : ${emailResponse.summary}

${userProfile?.voice_profile ? `Style d'écriture de l'utilisateur : ${userProfile.voice_profile}` : ''}

Rédige une réponse appropriée avec un ${toneInstructions[tone]}.

Règles :
- Si MEETING : Propose des créneaux (mardi/jeudi à 10h ou 14h par exemple)
- Si INTERESTED : Réponds aux questions et propose un call
- Si OBJECTION : Adresse l'objection avec empathie, reformule la valeur
- Sois concis (max 150 mots)
- Termine par une question ou un call-to-action clair

Réponds UNIQUEMENT avec le texte de l'email, sans "Objet:" ni signature.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const reply = data.content?.[0]?.text || '';

    return jsonResponse({ reply });
  } catch (e) {
    return jsonResponse({ error: 'Generation failed' }, 500);
  }
}

// =====================================================
// BLACKLIST
// =====================================================

async function handleBlacklist(request, env) {
  const user = await getAuthUser(request, env);
  const { email, reason, responseId } = await request.json();

  // Ajouter à la blacklist
  await supabaseInsert(env, 'prospect_blacklist', {
    user_id: user.id,
    email,
    reason: reason || 'Désabonné via Inbox',
    source: 'inbox'
  });

  // Archiver la réponse si fournie
  if (responseId) {
    await supabaseUpdate(env, 'email_responses', responseId, {
      status: 'archived'
    });
  }

  return jsonResponse({ success: true });
}

// =====================================================
// STATS
// =====================================================

async function handleGetStats(request, env) {
  const user = await getAuthUser(request, env);

  const responses = await supabaseQuery(env, 'email_responses', {
    select: 'category,status,priority',
    filters: [{ column: 'user_id', operator: 'eq', value: user.id }]
  });

  const stats = {
    total: responses.length,
    byCategory: {},
    byStatus: {},
    byPriority: {},
    new: 0,
    needsAction: 0
  };

  responses.forEach(r => {
    stats.byCategory[r.category] = (stats.byCategory[r.category] || 0) + 1;
    stats.byStatus[r.status] = (stats.byStatus[r.status] || 0) + 1;
    stats.byPriority[r.priority] = (stats.byPriority[r.priority] || 0) + 1;

    if (r.status === 'new') stats.new++;
    if (r.status !== 'done' && r.status !== 'archived' && r.priority === 'high') {
      stats.needsAction++;
    }
  });

  return jsonResponse({ stats });
}

// =====================================================
// NOTIFICATIONS
// =====================================================

async function sendNotification(user, emailResponse, env) {
  if (!env.RESEND_API_KEY) return;

  const categoryLabels = {
    MEETING: '🎉 Demande de RDV',
    INTERESTED: '👀 Prospect intéressé'
  };

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'SOS Storytelling <notifications@myinnerquest.fr>',
        to: user.email,
        subject: `${categoryLabels[emailResponse.category]} - ${emailResponse.from_name || emailResponse.from_email}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #8b5cf6;">${categoryLabels[emailResponse.category]}</h2>
            <p><strong>De :</strong> ${emailResponse.from_email}</p>
            <p><strong>Sujet :</strong> ${emailResponse.subject}</p>
            <p><strong>Résumé IA :</strong> ${emailResponse.summary}</p>
            <p><strong>Action suggérée :</strong> ${emailResponse.suggested_action}</p>
            <br>
            <a href="https://sosstorytelling.fr/app.html#inbox"
               style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Voir dans l'Inbox →
            </a>
          </div>
        `
      })
    });
  } catch (e) {
    console.error('Notification error:', e);
  }
}
