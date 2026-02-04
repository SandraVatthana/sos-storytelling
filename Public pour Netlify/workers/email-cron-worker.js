/**
 * EMAIL CRON WORKER
 * Cloudflare Worker pour l'envoi automatique des emails de campagne
 *
 * Fonctionnalités :
 * - Exécution toutes les 15 minutes via cron trigger
 * - Envoi des emails programmés (J+0, J+3, J+7...)
 * - Respect des limites quotidiennes par adresse
 * - Exclusion automatique des désinscrits
 * - Conditions d'envoi (no_reply, no_open, etc.)
 */

// ==================== CONFIGURATION ====================

const SUPABASE_URL = 'https://pyxidmnckpnrargygwnf.supabase.co';
// La clé service sera dans les secrets Cloudflare
// SUPABASE_SERVICE_KEY doit être configurée dans wrangler.toml ou dashboard

const RESEND_API_URL = 'https://api.resend.com/emails';
// RESEND_API_KEY doit être configurée dans les secrets

const CONFIG = {
    MAX_EMAILS_PER_RUN: 50,        // Max emails par exécution du cron
    DEFAULT_DAILY_LIMIT: 20,       // Limite par défaut par adresse/jour
    BATCH_SIZE: 5,                 // Emails envoyés en parallèle
    DELAY_BETWEEN_BATCHES: 2000,   // 2 secondes entre chaque batch
};

// ==================== MAIN HANDLER ====================

export default {
    // Handler pour les requêtes HTTP (debug/manuel)
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Endpoint de santé
        if (url.pathname === '/health') {
            return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Endpoint pour déclencher manuellement
        if (url.pathname === '/trigger' && request.method === 'POST') {
            const authHeader = request.headers.get('Authorization');
            if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
                return new Response('Unauthorized', { status: 401 });
            }

            const result = await processEmailQueue(env);
            return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Endpoint pour voir les stats
        if (url.pathname === '/stats') {
            const stats = await getQueueStats(env);
            return new Response(JSON.stringify(stats), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response('Email Cron Worker - SOS Storytelling', {
            headers: { 'Content-Type': 'text/plain' }
        });
    },

    // Handler pour le cron (toutes les 15 minutes)
    async scheduled(event, env, ctx) {
        console.log('[Cron] Démarrage du traitement des emails...');
        ctx.waitUntil(processEmailQueue(env));
    }
};

// ==================== PROCESSUS PRINCIPAL ====================

async function processEmailQueue(env) {
    const startTime = Date.now();
    const results = {
        processed: 0,
        sent: 0,
        skipped: 0,
        errors: [],
        campaigns: []
    };

    try {
        const supabase = createSupabaseClient(env);

        // 1. Récupérer les campagnes actives
        const campaigns = await getActiveCampaigns(supabase);
        console.log(`[Cron] ${campaigns.length} campagne(s) active(s) trouvée(s)`);

        for (const campaign of campaigns) {
            try {
                const campaignResult = await processCampaign(supabase, env, campaign);
                results.campaigns.push({
                    id: campaign.id,
                    name: campaign.name,
                    ...campaignResult
                });
                results.sent += campaignResult.sent;
                results.skipped += campaignResult.skipped;
                results.processed += campaignResult.processed;

                // Limite globale atteinte ?
                if (results.sent >= CONFIG.MAX_EMAILS_PER_RUN) {
                    console.log('[Cron] Limite globale atteinte, arrêt');
                    break;
                }
            } catch (err) {
                console.error(`[Cron] Erreur campagne ${campaign.id}:`, err);
                results.errors.push({ campaign_id: campaign.id, error: err.message });
            }
        }

        results.duration_ms = Date.now() - startTime;
        console.log(`[Cron] Terminé: ${results.sent} envoyés, ${results.skipped} ignorés en ${results.duration_ms}ms`);

        return results;

    } catch (error) {
        console.error('[Cron] Erreur globale:', error);
        results.errors.push({ global: true, error: error.message });
        return results;
    }
}

// ==================== GESTION DES CAMPAGNES ====================

async function getActiveCampaigns(supabase) {
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('email_campaigns')
        .select(`
            *,
            sequence_emails:campaign_sequence_emails(*)
        `)
        .in('status', ['active', 'scheduled'])
        .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[Cron] Erreur chargement campagnes:', error);
        return [];
    }

    return data || [];
}

async function processCampaign(supabase, env, campaign) {
    const result = { processed: 0, sent: 0, skipped: 0, errors: [] };

    // Récupérer les prospects de la campagne qui doivent recevoir un email
    const pendingEmails = await getPendingEmails(supabase, campaign);
    console.log(`[Campaign ${campaign.id}] ${pendingEmails.length} email(s) en attente`);

    // Récupérer les adresses d'envoi disponibles
    const senders = await getAvailableSenders(supabase, campaign.user_id, campaign.sender_email_ids);

    if (senders.length === 0) {
        console.log(`[Campaign ${campaign.id}] Aucune adresse d'envoi disponible`);
        return result;
    }

    // Récupérer la liste des désinscrits
    const unsubscribedEmails = await getUnsubscribedEmails(supabase, campaign.user_id);

    // Traiter les emails par batch
    let senderIndex = 0;
    const batches = chunkArray(pendingEmails, CONFIG.BATCH_SIZE);

    for (const batch of batches) {
        const batchPromises = batch.map(async (emailTask) => {
            result.processed++;

            // Vérifier si désinscrit
            if (unsubscribedEmails.has(emailTask.prospect_email?.toLowerCase())) {
                result.skipped++;
                await markEmailSkipped(supabase, emailTask.id, 'unsubscribed');
                return;
            }

            // Vérifier les conditions d'envoi
            if (!await checkSendCondition(supabase, emailTask)) {
                result.skipped++;
                await markEmailSkipped(supabase, emailTask.id, 'condition_not_met');
                return;
            }

            // Sélectionner l'expéditeur (rotation)
            const sender = senders[senderIndex % senders.length];
            senderIndex++;

            // Vérifier la limite quotidienne
            if (sender.emails_sent_today >= sender.effective_limit) {
                result.skipped++;
                return;
            }

            // Envoyer l'email
            try {
                await sendEmail(env, {
                    from: `${sender.display_name} <${sender.email}>`,
                    to: emailTask.prospect_email,
                    subject: emailTask.subject,
                    html: formatEmailBody(emailTask.body, emailTask.prospect_email, campaign.user_id, campaign.id, emailTask.prospect_id),
                    reply_to: sender.email
                });

                result.sent++;
                await markEmailSent(supabase, emailTask.id, sender.id);
                await incrementSenderCount(supabase, sender.id);

            } catch (err) {
                console.error(`[Email] Erreur envoi:`, err);
                result.errors.push({ email_id: emailTask.id, error: err.message });
                await markEmailFailed(supabase, emailTask.id, err.message);
            }
        });

        await Promise.all(batchPromises);

        // Pause entre les batches
        if (batches.indexOf(batch) < batches.length - 1) {
            await sleep(CONFIG.DELAY_BETWEEN_BATCHES);
        }
    }

    // Mettre à jour le statut de la campagne si nécessaire
    await updateCampaignStatus(supabase, campaign.id);

    return result;
}

// ==================== EMAILS EN ATTENTE ====================

async function getPendingEmails(supabase, campaign) {
    const now = new Date();

    // Récupérer les emails de la queue qui sont prêts à être envoyés
    const { data, error } = await supabase
        .from('email_queue')
        .select(`
            *,
            prospect:hub_prospects(id, email, first_name, last_name, company)
        `)
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .lte('scheduled_for', now.toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(CONFIG.MAX_EMAILS_PER_RUN);

    if (error) {
        console.error('[Cron] Erreur chargement queue:', error);
        return [];
    }

    return (data || []).map(item => ({
        ...item,
        prospect_email: item.prospect?.email || item.to_email,
        prospect_name: item.prospect?.first_name || 'there'
    }));
}

// ==================== CONDITIONS D'ENVOI ====================

async function checkSendCondition(supabase, emailTask) {
    const condition = emailTask.send_condition || 'always';

    if (condition === 'always') return true;

    // Vérifier les emails précédents de cette séquence pour ce prospect
    const { data: previousEmails } = await supabase
        .from('email_queue')
        .select('status, opened_at, replied_at, clicked_at')
        .eq('campaign_id', emailTask.campaign_id)
        .eq('prospect_id', emailTask.prospect_id)
        .lt('sequence_position', emailTask.sequence_position)
        .order('sequence_position', { ascending: false })
        .limit(1);

    if (!previousEmails || previousEmails.length === 0) return true;

    const prevEmail = previousEmails[0];

    switch (condition) {
        case 'no_reply':
            return !prevEmail.replied_at;
        case 'no_open':
            return !prevEmail.opened_at;
        case 'no_click':
            return !prevEmail.clicked_at;
        default:
            return true;
    }
}

// ==================== GESTION DES EXPÉDITEURS ====================

async function getAvailableSenders(supabase, userId, senderIds) {
    let query = supabase
        .from('sender_emails')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

    if (senderIds && senderIds.length > 0) {
        query = query.in('id', senderIds);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    // Calculer la limite effective (warmup ou normale)
    return data.map(sender => ({
        ...sender,
        effective_limit: sender.warmup_enabled
            ? (sender.warmup_current_limit || CONFIG.DEFAULT_DAILY_LIMIT)
            : (sender.daily_limit || CONFIG.DEFAULT_DAILY_LIMIT)
    })).filter(s => s.emails_sent_today < s.effective_limit);
}

async function incrementSenderCount(supabase, senderId) {
    await supabase.rpc('increment_sender_email_count', { sender_id: senderId });
}

// ==================== DÉSINSCRITS ====================

async function getUnsubscribedEmails(supabase, userId) {
    const { data } = await supabase
        .from('email_unsubscribes')
        .select('email')
        .eq('user_id', userId);

    return new Set((data || []).map(u => u.email.toLowerCase()));
}

// ==================== ENVOI EMAIL ====================

async function sendEmail(env, emailData) {
    const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: emailData.from,
            to: [emailData.to],
            subject: emailData.subject,
            html: emailData.html,
            reply_to: emailData.reply_to
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Resend API error: ${response.status} - ${error}`);
    }

    return await response.json();
}

function formatEmailBody(body, prospectEmail, userId, campaignId, prospectId) {
    // Convertir les sauts de ligne en <br>
    let htmlBody = body.replace(/\n/g, '<br>');

    // Ajouter le lien de désinscription
    const unsubscribeUrl = `https://sosstorytelling.fr/unsubscribe.html?email=${encodeURIComponent(prospectEmail)}&uid=${userId}&cid=${campaignId || ''}&pid=${prospectId || ''}`;

    htmlBody += `
        <br><br>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #888; text-align: center;">
            Si tu ne souhaites plus recevoir mes emails,
            <a href="${unsubscribeUrl}" style="color: #888;">clique ici pour te désinscrire</a>.
        </p>
    `;

    return htmlBody;
}

// ==================== MISE À JOUR STATUTS ====================

async function markEmailSent(supabase, emailId, senderId) {
    await supabase
        .from('email_queue')
        .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            sender_email_id: senderId
        })
        .eq('id', emailId);
}

async function markEmailSkipped(supabase, emailId, reason) {
    await supabase
        .from('email_queue')
        .update({
            status: 'skipped',
            skip_reason: reason,
            updated_at: new Date().toISOString()
        })
        .eq('id', emailId);
}

async function markEmailFailed(supabase, emailId, errorMessage) {
    await supabase
        .from('email_queue')
        .update({
            status: 'failed',
            error_message: errorMessage,
            updated_at: new Date().toISOString()
        })
        .eq('id', emailId);
}

async function updateCampaignStatus(supabase, campaignId) {
    // Vérifier s'il reste des emails à envoyer
    const { count } = await supabase
        .from('email_queue')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', 'pending');

    if (count === 0) {
        await supabase
            .from('email_campaigns')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', campaignId);
    }
}

// ==================== STATS ====================

async function getQueueStats(env) {
    const supabase = createSupabaseClient(env);

    const { data: pending } = await supabase
        .from('email_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

    const { data: sent } = await supabase
        .from('email_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return {
        pending_emails: pending?.count || 0,
        sent_last_24h: sent?.count || 0,
        timestamp: new Date().toISOString()
    };
}

// ==================== HELPERS ====================

function createSupabaseClient(env) {
    return {
        from: (table) => ({
            select: (columns = '*', options = {}) => createQuery(env, table, 'SELECT', columns, options),
            insert: (data) => createQuery(env, table, 'INSERT', data),
            update: (data) => createQuery(env, table, 'UPDATE', data),
            delete: () => createQuery(env, table, 'DELETE'),
            rpc: (fn, params) => callRpc(env, fn, params)
        }),
        rpc: (fn, params) => callRpc(env, fn, params)
    };
}

function createQuery(env, table, method, data, options = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    let queryParams = [];
    let filters = [];
    let body = null;
    let httpMethod = 'GET';

    const query = {
        eq: (col, val) => { filters.push(`${col}=eq.${val}`); return query; },
        neq: (col, val) => { filters.push(`${col}=neq.${val}`); return query; },
        in: (col, vals) => { filters.push(`${col}=in.(${vals.join(',')})`); return query; },
        lt: (col, val) => { filters.push(`${col}=lt.${val}`); return query; },
        lte: (col, val) => { filters.push(`${col}=lte.${val}`); return query; },
        gt: (col, val) => { filters.push(`${col}=gt.${val}`); return query; },
        gte: (col, val) => { filters.push(`${col}=gte.${val}`); return query; },
        or: (condition) => { filters.push(`or=(${condition})`); return query; },
        order: (col, opts = {}) => { queryParams.push(`order=${col}.${opts.ascending ? 'asc' : 'desc'}`); return query; },
        limit: (n) => { queryParams.push(`limit=${n}`); return query; },
        single: () => { queryParams.push('limit=1'); query._single = true; return query; },

        async then(resolve, reject) {
            try {
                if (filters.length) url += '?' + filters.join('&');
                if (queryParams.length) url += (filters.length ? '&' : '?') + queryParams.join('&');

                if (method === 'SELECT') {
                    if (data !== '*') url += (url.includes('?') ? '&' : '?') + `select=${data}`;
                } else if (method === 'INSERT') {
                    httpMethod = 'POST';
                    body = JSON.stringify(data);
                } else if (method === 'UPDATE') {
                    httpMethod = 'PATCH';
                    body = JSON.stringify(data);
                } else if (method === 'DELETE') {
                    httpMethod = 'DELETE';
                }

                const response = await fetch(url, {
                    method: httpMethod,
                    headers: {
                        'apikey': env.SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': method === 'INSERT' ? 'return=representation' : undefined
                    },
                    body
                });

                const result = await response.json();

                if (!response.ok) {
                    resolve({ data: null, error: result });
                } else {
                    resolve({
                        data: query._single ? (result[0] || null) : result,
                        error: null,
                        count: options.count ? parseInt(response.headers.get('content-range')?.split('/')[1] || '0') : undefined
                    });
                }
            } catch (err) {
                resolve({ data: null, error: err });
            }
        }
    };

    return query;
}

async function callRpc(env, functionName, params) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
    });

    return await response.json();
}

function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
