// =====================================================
// AGENT AUTOPILOT - Cloudflare Worker (Cron Job)
// SOS Storytelling
// =====================================================
// Ce worker s'exécute toutes les 5 minutes via Cron Trigger
// Il gère l'envoi automatique d'emails pour chaque utilisateur

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_KEY = 'YOUR_SUPABASE_SERVICE_KEY';
const BREVO_API_KEY = 'YOUR_BREVO_API_KEY';
const ANTHROPIC_API_KEY = 'YOUR_ANTHROPIC_API_KEY';

// ==================== MAIN HANDLER ====================
export default {
    async scheduled(event, env, ctx) {
        // Utiliser les variables d'environnement de Cloudflare
        const config = {
            supabaseUrl: env.SUPABASE_URL || SUPABASE_URL,
            supabaseKey: env.SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY,
            brevoKey: env.BREVO_API_KEY || BREVO_API_KEY,
            anthropicKey: env.ANTHROPIC_API_KEY || ANTHROPIC_API_KEY
        };

        console.log(`[${new Date().toISOString()}] Agent Autopilot - Cron job démarré`);

        try {
            await processAllActiveAgents(config);
            console.log(`[${new Date().toISOString()}] Agent Autopilot - Cron job terminé`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Erreur Agent Autopilot:`, error);
        }
    },

    // Endpoint HTTP pour test manuel et envoi d'emails approuvés
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const config = {
            supabaseUrl: env.SUPABASE_URL || SUPABASE_URL,
            supabaseKey: env.SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY,
            brevoKey: env.BREVO_API_KEY || BREVO_API_KEY,
            anthropicKey: env.ANTHROPIC_API_KEY || ANTHROPIC_API_KEY
        };

        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Content-Type': 'application/json'
        };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Route: Exécuter l'agent manuellement
        if (url.pathname === '/run' && request.method === 'POST') {
            await processAllActiveAgents(config);
            return new Response(JSON.stringify({ success: true, message: 'Agent exécuté' }), {
                headers: corsHeaders
            });
        }

        // Route: Envoyer un email approuvé
        if (url.pathname === '/send-approved' && request.method === 'POST') {
            try {
                const body = await request.json();
                const { email_id, user_id } = body;

                if (!email_id || !user_id) {
                    return new Response(JSON.stringify({ success: false, error: 'email_id et user_id requis' }), {
                        status: 400, headers: corsHeaders
                    });
                }

                const result = await sendApprovedEmail(config, email_id, user_id);
                return new Response(JSON.stringify(result), { headers: corsHeaders });
            } catch (error) {
                return new Response(JSON.stringify({ success: false, error: error.message }), {
                    status: 500, headers: corsHeaders
                });
            }
        }

        // Route: Rejeter un email
        if (url.pathname === '/reject-email' && request.method === 'POST') {
            try {
                const body = await request.json();
                const { email_id, user_id } = body;

                if (!email_id || !user_id) {
                    return new Response(JSON.stringify({ success: false, error: 'email_id et user_id requis' }), {
                        status: 400, headers: corsHeaders
                    });
                }

                await supabaseUpdate(config, 'email_queue', email_id, {
                    status: 'rejected',
                    rejected_at: new Date().toISOString()
                });

                return new Response(JSON.stringify({ success: true, message: 'Email rejeté' }), {
                    headers: corsHeaders
                });
            } catch (error) {
                return new Response(JSON.stringify({ success: false, error: error.message }), {
                    status: 500, headers: corsHeaders
                });
            }
        }

        // Route: Désinscription RGPD
        if (url.pathname === '/unsubscribe') {
            const email = url.searchParams.get('email');

            if (!email) {
                return new Response(getUnsubscribePageHtml('error', 'Email non spécifié'), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                });
            }

            try {
                // Marquer le prospect comme désinscrit dans toutes les tables où il existe
                await unsubscribeEmail(config, email);

                return new Response(getUnsubscribePageHtml('success', email), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                });
            } catch (error) {
                console.error('Erreur désinscription:', error);
                return new Response(getUnsubscribePageHtml('error', 'Une erreur est survenue'), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                });
            }
        }

        return new Response('Agent Autopilot Worker - OK', { status: 200, headers: corsHeaders });
    }
};

// ==================== SEND APPROVED EMAIL ====================
async function sendApprovedEmail(config, emailId, userId) {
    // Récupérer l'email en attente
    const emails = await supabaseQuery(config, 'email_queue', {
        select: '*',
        filter: { id: emailId, user_id: userId, status: 'pending_approval' }
    });

    if (!emails || emails.length === 0) {
        return { success: false, error: 'Email non trouvé ou déjà traité' };
    }

    const email = emails[0];

    // Récupérer la config de l'agent
    const configs = await supabaseQuery(config, 'agent_config', {
        select: '*',
        filter: { user_id: userId }
    });

    const agentConfig = configs?.[0];
    if (!agentConfig) {
        return { success: false, error: 'Configuration agent non trouvée' };
    }

    // Envoyer via Brevo avec footer RGPD
    const result = await sendBrevoEmail(config, {
        to: email.prospect_email,
        toName: email.prospect_name,
        from: email.sender_email || agentConfig.sender_email,
        fromName: email.sender_name || agentConfig.sender_name,
        subject: email.subject,
        htmlContent: formatEmailHtml(email.body, {
            prospectEmail: email.prospect_email,
            senderName: email.sender_name || agentConfig.sender_name,
            senderCompany: agentConfig.company_name
        }),
        tags: ['autopilot', 'approved', `user_${userId}`]
    });

    if (result.success) {
        // Mettre à jour le statut de l'email
        await supabaseUpdate(config, 'email_queue', emailId, {
            status: 'sent',
            sent_at: new Date().toISOString(),
            message_id: result.messageId
        });

        // Mettre à jour le prospect
        if (email.prospect_id) {
            await supabaseUpdate(config, 'prospects', email.prospect_id, {
                emails_sent: (email.template_position || 1),
                last_contacted_at: new Date().toISOString()
            });
        }

        // Logger
        await logAgent(config, userId, 'action', `Email approuvé envoyé à ${email.prospect_email}`, {
            email_id: emailId,
            message_id: result.messageId
        });

        return { success: true, message: 'Email envoyé', messageId: result.messageId };
    } else {
        // Marquer comme erreur
        await supabaseUpdate(config, 'email_queue', emailId, {
            status: 'error',
            error_message: result.error
        });

        return { success: false, error: result.error };
    }
}

// ==================== PROCESS ALL AGENTS ====================
async function processAllActiveAgents(config) {
    // Récupérer tous les utilisateurs avec un agent actif
    const activeConfigs = await supabaseQuery(config, 'agent_config', {
        select: '*',
        filter: { is_active: true }
    });

    if (!activeConfigs || activeConfigs.length === 0) {
        console.log('Aucun agent actif trouvé');
        return;
    }

    console.log(`${activeConfigs.length} agent(s) actif(s) trouvé(s)`);

    // Traiter chaque agent
    for (const agentConfig of activeConfigs) {
        try {
            await processAgent(config, agentConfig);
        } catch (error) {
            console.error(`Erreur agent ${agentConfig.user_id}:`, error);
            await logAgent(config, agentConfig.user_id, 'error', `Erreur: ${error.message}`);
        }
    }
}

// ==================== PROCESS SINGLE AGENT ====================
async function processAgent(config, agentConfig) {
    const userId = agentConfig.user_id;
    const runId = crypto.randomUUID();

    await logAgent(config, userId, 'info', 'Début du cycle agent', { run_id: runId });

    // Vérifier les heures de travail
    if (!isWorkingTime(agentConfig)) {
        await logAgent(config, userId, 'info', 'Hors heures de travail - pause');
        return;
    }

    // Calculer la limite d'emails (avec warm-up si activé)
    const dailyLimit = calculateDailyLimit(agentConfig);

    // Vérifier le quota journalier
    const emailsSentToday = await getEmailsSentToday(config, userId);
    if (emailsSentToday >= dailyLimit) {
        await logAgent(config, userId, 'info', `Quota journalier atteint (${emailsSentToday}/${dailyLimit}${agentConfig.warmup_mode ? ' - mode warm-up' : ''})`);
        return;
    }

    // Récupérer les templates
    const templates = await supabaseQuery(config, 'agent_templates', {
        select: '*',
        filter: { user_id: userId, is_active: true },
        order: { column: 'position', ascending: true }
    });

    if (!templates || templates.length === 0) {
        await logAgent(config, userId, 'decision', 'Aucun template configuré - pas d\'action');
        return;
    }

    // 1. Traiter les prospects "hot" en priorité
    await processHotProspects(config, agentConfig, templates, runId);

    // 2. Traiter la suite des séquences en cours
    await processSequences(config, agentConfig, templates, runId);

    // 3. Démarrer de nouvelles séquences si nécessaire
    await startNewSequences(config, agentConfig, templates, runId);

    await logAgent(config, userId, 'info', 'Fin du cycle agent', { run_id: runId });
}

// ==================== PROCESS HOT PROSPECTS ====================
async function processHotProspects(config, agentConfig, templates, runId) {
    const userId = agentConfig.user_id;

    // Trouver les prospects qui ont ouvert plusieurs fois ou cliqué
    const hotProspects = await supabaseQuery(config, 'prospects', {
        select: '*',
        filter: {
            user_id: userId,
            agent_status: 'hot'
        },
        order: { column: 'updated_at', ascending: false },
        limit: 5
    });

    if (!hotProspects || hotProspects.length === 0) return;

    const hotTemplate = templates.find(t => t.send_condition === 'opened_no_reply') || templates[templates.length - 1];

    for (const prospect of hotProspects) {
        // Vérifier si on a déjà envoyé un email "hot" récemment (moins de 24h)
        if (prospect.last_contacted_at) {
            const lastContact = new Date(prospect.last_contacted_at);
            const hoursSinceContact = (Date.now() - lastContact.getTime()) / (1000 * 60 * 60);
            if (hoursSinceContact < 24) continue;
        }

        await logAgent(config, userId, 'decision', `Prospect chaud détecté: ${prospect.email}`, {
            run_id: runId,
            prospect_id: prospect.id,
            reason: 'multiple_opens_or_click'
        });

        // Envoyer l'email "prospect chaud"
        await sendEmail(config, agentConfig, prospect, hotTemplate, runId);

        // Créer une notification
        await createNotification(config, userId, 'hot_prospect',
            '🔥 Prospect Chaud !',
            `${prospect.name || prospect.email} a montré un fort intérêt`,
            prospect.id
        );
    }
}

// ==================== PROCESS SEQUENCES ====================
async function processSequences(config, agentConfig, templates, runId) {
    const userId = agentConfig.user_id;

    // Trouver les prospects en séquence avec une action prévue
    const prospectsInSequence = await supabaseQuery(config, 'prospects', {
        select: '*',
        filter: {
            user_id: userId,
            agent_status: 'in_sequence'
        }
    });

    if (!prospectsInSequence || prospectsInSequence.length === 0) return;

    const now = new Date();

    for (const prospect of prospectsInSequence) {
        // Vérifier si c'est le moment d'envoyer
        if (prospect.next_action_at) {
            const nextAction = new Date(prospect.next_action_at);
            if (nextAction > now) continue;
        }

        // Vérifier si le prospect a répondu
        if (prospect.replied_at) {
            await updateProspectStatus(config, prospect.id, 'converted');
            await createNotification(config, userId, 'reply',
                '💬 Réponse reçue !',
                `${prospect.name || prospect.email} a répondu`,
                prospect.id
            );
            continue;
        }

        // Déterminer quel email envoyer ensuite
        const emailsSent = prospect.emails_sent || 0;
        const nextTemplate = templates.find(t => t.position === emailsSent + 1);

        if (!nextTemplate) {
            // Fin de la séquence
            await updateProspectStatus(config, prospect.id, 'dead');
            await logAgent(config, userId, 'decision', `Fin de séquence pour ${prospect.email}`, {
                run_id: runId,
                emails_sent: emailsSent
            });
            continue;
        }

        // Vérifier la condition d'envoi
        if (!checkSendCondition(nextTemplate, prospect)) {
            await logAgent(config, userId, 'decision', `Condition non remplie pour ${prospect.email}`, {
                run_id: runId,
                condition: nextTemplate.send_condition
            });
            continue;
        }

        // Envoyer l'email
        await sendEmail(config, agentConfig, prospect, nextTemplate, runId);
    }
}

// ==================== START NEW SEQUENCES ====================
async function startNewSequences(config, agentConfig, templates, runId) {
    const userId = agentConfig.user_id;

    // Compter combien on peut encore envoyer aujourd'hui
    const emailsSentToday = await getEmailsSentToday(config, userId);
    const remaining = agentConfig.max_emails_per_day - emailsSentToday;

    if (remaining <= 0) return;

    // Trouver des prospects en attente
    const pendingProspects = await supabaseQuery(config, 'prospects', {
        select: '*',
        filter: {
            user_id: userId,
            agent_status: 'pending'
        },
        order: { column: 'agent_priority', ascending: false },
        limit: Math.min(remaining, 5)
    });

    if (!pendingProspects || pendingProspects.length === 0) return;

    const firstTemplate = templates.find(t => t.position === 1);
    if (!firstTemplate) return;

    for (const prospect of pendingProspects) {
        // RGPD: Vérifier si l'email est dans la blocklist
        if (await isEmailBlocked(config, prospect.email)) {
            await logAgent(config, userId, 'info', `Email bloqué (RGPD): ${prospect.email}`, { run_id: runId });
            await updateProspectStatus(config, prospect.id, 'blocked');
            continue;
        }

        // Respecter le délai minimum entre emails
        await delay(agentConfig.min_delay_between_emails * 1000);

        await sendEmail(config, agentConfig, prospect, firstTemplate, runId);

        // Mettre à jour le statut
        await updateProspectStatus(config, prospect.id, 'in_sequence');
    }
}

// ==================== RGPD - VÉRIFICATION BLOCKLIST ====================
async function isEmailBlocked(config, email) {
    const blocked = await supabaseQuery(config, 'email_blocklist', {
        select: 'id',
        filter: { email: email }
    });
    return blocked && blocked.length > 0;
}

// ==================== ANTI-SPAM - VÉRIFICATION CONTENU ====================
function checkSpamScore(subject, body) {
    const warnings = [];
    let score = 0; // 0 = bon, plus c'est haut plus c'est risqué

    const content = (subject + ' ' + body).toLowerCase();

    // Mots spam à éviter
    const spamWords = [
        'gratuit', 'free', 'urgent', 'urgente', 'offre exceptionnelle',
        'gagner', 'gagnez', 'winner', 'félicitations', 'congratulations',
        'cliquez ici', 'click here', 'act now', 'agissez maintenant',
        'sans engagement', 'no obligation', '100%', 'garantie',
        'argent facile', 'revenus passifs', 'mlm', 'casino', 'bitcoin',
        'perdre du poids', 'weight loss', 'viagra', 'prix cassé',
        'offre limitée', 'limited offer', 'dernière chance', 'last chance',
        'ne ratez pas', "n'attendez plus", 'exceptionnel', 'incroyable'
    ];

    for (const word of spamWords) {
        if (content.includes(word)) {
            warnings.push(`Mot spam détecté: "${word}"`);
            score += 10;
        }
    }

    // Vérifier les majuscules excessives dans l'objet
    const upperCaseRatio = (subject.match(/[A-Z]/g) || []).length / subject.length;
    if (upperCaseRatio > 0.5 && subject.length > 10) {
        warnings.push('Trop de majuscules dans l\'objet');
        score += 15;
    }

    // Vérifier les points d'exclamation excessifs
    const exclamationCount = (content.match(/!/g) || []).length;
    if (exclamationCount > 3) {
        warnings.push(`Trop de points d'exclamation (${exclamationCount})`);
        score += 5 * (exclamationCount - 3);
    }

    // Vérifier le nombre de liens
    const linkCount = (body.match(/https?:\/\//gi) || []).length;
    if (linkCount > 3) {
        warnings.push(`Trop de liens (${linkCount})`);
        score += 10 * (linkCount - 3);
    }

    // Vérifier si l'email est trop court (semble automatisé)
    if (body.length < 100) {
        warnings.push('Email trop court (< 100 caractères)');
        score += 10;
    }

    // Vérifier la personnalisation
    const hasPersonalization = body.includes('{{') ||
        /bonjour\s+[a-zéèêëàâäùûüôöîï]+/i.test(body);
    if (!hasPersonalization) {
        warnings.push('Pas de personnalisation détectée');
        score += 5;
    }

    return {
        score,
        isRisky: score >= 30,
        warnings
    };
}

// ==================== SEND EMAIL (ou mise en file d'attente) ====================
async function sendEmail(config, agentConfig, prospect, template, runId) {
    const userId = agentConfig.user_id;

    // MODE VALIDATION HUMAINE : Si activé, on met l'email en file d'attente
    if (agentConfig.require_approval !== false) {
        return await queueEmailForApproval(config, agentConfig, prospect, template, runId);
    }

    // MODE AUTOMATIQUE : Envoi direct (seulement si require_approval = false)
    return await sendEmailDirectly(config, agentConfig, prospect, template, runId);
}

// ==================== QUEUE EMAIL FOR APPROVAL ====================
async function queueEmailForApproval(config, agentConfig, prospect, template, runId) {
    const userId = agentConfig.user_id;

    // Personnaliser le template
    const subject = personalizeTemplate(template.subject, prospect);
    const body = personalizeTemplate(template.body, prospect);

    // Optionnel: utiliser l'IA pour améliorer le message
    let finalBody = body;
    if (config.anthropicKey && config.anthropicKey !== 'YOUR_ANTHROPIC_API_KEY') {
        try {
            finalBody = await enhanceWithAI(config, body, prospect, agentConfig);
        } catch (e) {
            console.log('Erreur IA, utilisation du template standard');
        }
    }

    // Vérifier le score anti-spam
    const spamCheck = checkSpamScore(subject, finalBody);

    // Créer l'email en attente de validation
    const pendingEmail = {
        user_id: userId,
        prospect_id: prospect.id,
        prospect_email: prospect.email,
        prospect_name: prospect.name || prospect.first_name || prospect.email.split('@')[0],
        template_id: template.id,
        template_position: template.position,
        subject: subject,
        body: finalBody,
        sender_email: agentConfig.sender_email,
        sender_name: agentConfig.sender_name,
        status: 'pending_approval', // En attente de validation
        created_at: new Date().toISOString(),
        run_id: runId,
        // Infos anti-spam
        spam_score: spamCheck.score,
        spam_warnings: spamCheck.warnings.length > 0 ? JSON.stringify(spamCheck.warnings) : null
    };

    await supabaseInsert(config, 'email_queue', pendingEmail);

    await logAgent(config, userId, 'decision', `Email mis en attente de validation pour ${prospect.email}`, {
        run_id: runId,
        prospect_id: prospect.id,
        subject: subject
    });

    // Créer une notification pour l'utilisateur
    await createNotification(config, userId, 'pending_email',
        '📧 Email à valider',
        `Un email pour ${prospect.name || prospect.email} attend votre validation`,
        prospect.id
    );

    return { queued: true, prospect_email: prospect.email };
}

// ==================== SEND EMAIL DIRECTLY ====================
async function sendEmailDirectly(config, agentConfig, prospect, template, runId) {
    const userId = agentConfig.user_id;

    // Personnaliser le template
    const subject = personalizeTemplate(template.subject, prospect);
    const body = personalizeTemplate(template.body, prospect);

    // Optionnel: utiliser l'IA pour améliorer le message
    let finalBody = body;
    if (config.anthropicKey && config.anthropicKey !== 'YOUR_ANTHROPIC_API_KEY') {
        try {
            finalBody = await enhanceWithAI(config, body, prospect, agentConfig);
        } catch (e) {
            console.log('Erreur IA, utilisation du template standard');
        }
    }

    // Envoyer via Brevo avec footer RGPD
    const result = await sendBrevoEmail(config, {
        to: prospect.email,
        toName: prospect.name || prospect.email.split('@')[0],
        from: agentConfig.sender_email,
        fromName: agentConfig.sender_name,
        subject: subject,
        htmlContent: formatEmailHtml(finalBody, {
            prospectEmail: prospect.email,
            senderName: agentConfig.sender_name,
            senderCompany: agentConfig.company_name
        }),
        tags: ['autopilot', `user_${userId}`, `prospect_${prospect.id}`]
    });

    if (result.success) {
        // Mettre à jour le prospect
        await supabaseUpdate(config, 'prospects', prospect.id, {
            emails_sent: (prospect.emails_sent || 0) + 1,
            last_contacted_at: new Date().toISOString(),
            next_action_at: calculateNextAction(template, agentConfig)
        });

        // Logger l'action
        await supabaseInsert(config, 'agent_actions', {
            user_id: userId,
            prospect_id: prospect.id,
            action_type: 'email_sent',
            action_data: {
                template_id: template.id,
                template_name: template.name,
                message_id: result.messageId,
                subject: subject
            },
            decided_by: 'agent',
            decision_reasoning: `Email ${template.position} de la séquence envoyé automatiquement`
        });

        await logAgent(config, userId, 'action', `Email envoyé à ${prospect.email}`, {
            run_id: runId,
            template: template.name,
            message_id: result.messageId
        });

        // Mettre à jour les stats
        await updateAgentStats(config, userId, 'total_emails_sent');
    } else {
        await logAgent(config, userId, 'error', `Échec envoi email à ${prospect.email}: ${result.error}`, {
            run_id: runId
        });
    }
}

// ==================== BREVO API ====================
async function sendBrevoEmail(config, emailData) {
    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': config.brevoKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: {
                    name: emailData.fromName,
                    email: emailData.from
                },
                to: [{
                    email: emailData.to,
                    name: emailData.toName
                }],
                subject: emailData.subject,
                htmlContent: emailData.htmlContent,
                tags: emailData.tags
            })
        });

        const data = await response.json();

        if (response.ok) {
            return { success: true, messageId: data.messageId };
        } else {
            return { success: false, error: data.message || 'Erreur Brevo' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==================== AI ENHANCEMENT ====================
async function enhanceWithAI(config, body, prospect, agentConfig) {
    const prompt = `Tu es un assistant qui améliore des emails de prospection.
Voici l'email original:
---
${body}
---

Contexte du prospect:
- Nom: ${prospect.name || 'Inconnu'}
- Entreprise: ${prospect.company || 'Inconnue'}
- Poste: ${prospect.position || 'Inconnu'}

Améliore légèrement cet email pour qu'il soit plus naturel et engageant, tout en gardant:
- Le même ton (${agentConfig.tone})
- La même structure
- Les mêmes informations clés

Retourne UNIQUEMENT l'email amélioré, sans commentaire.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.anthropicKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    const data = await response.json();
    return data.content?.[0]?.text || body;
}

// ==================== HELPERS ====================
function isWorkingTime(agentConfig) {
    const now = new Date();
    const hour = now.getUTCHours() + 1; // UTC+1 pour Paris
    const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getUTCDay()];

    if (!agentConfig.working_days.includes(dayOfWeek)) return false;
    if (hour < agentConfig.working_hours_start || hour >= agentConfig.working_hours_end) return false;

    return true;
}

// ==================== WARM-UP - Augmentation progressive ====================
function calculateDailyLimit(agentConfig) {
    // Si warm-up désactivé, utiliser la limite normale
    if (!agentConfig.warmup_mode) {
        return agentConfig.max_emails_per_day || 50;
    }

    // Calculer le nombre de jours depuis l'activation de l'agent
    const activatedAt = agentConfig.warmup_started_at || agentConfig.created_at;
    if (!activatedAt) {
        return 10; // Valeur par défaut pour le premier jour
    }

    const startDate = new Date(activatedAt);
    const now = new Date();
    const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

    // Warm-up: commence à 10, augmente de 5 par jour
    // Jour 0: 10, Jour 1: 15, Jour 2: 20, etc.
    const warmupLimit = 10 + (daysSinceStart * 5);

    // Ne pas dépasser la limite configurée par l'utilisateur
    return Math.min(warmupLimit, agentConfig.max_emails_per_day || 50);
}

function checkSendCondition(template, prospect) {
    switch (template.send_condition) {
        case 'always':
            return true;
        case 'no_reply':
            return !prospect.replied_at;
        case 'opened_no_reply':
            return prospect.last_opened_at && !prospect.replied_at;
        case 'clicked':
            return prospect.last_clicked_at;
        default:
            return true;
    }
}

function personalizeTemplate(template, prospect) {
    return template
        .replace(/\{\{prénom\}\}/gi, prospect.name?.split(' ')[0] || prospect.email.split('@')[0])
        .replace(/\{\{nom\}\}/gi, prospect.name || prospect.email.split('@')[0])
        .replace(/\{\{email\}\}/gi, prospect.email)
        .replace(/\{\{entreprise\}\}/gi, prospect.company || 'votre entreprise')
        .replace(/\{\{poste\}\}/gi, prospect.position || '')
        .replace(/\{\{signature\}\}/gi, 'Cordialement');
}

function formatEmailHtml(body, options = {}) {
    const { prospectEmail, unsubscribeUrl, senderName, senderCompany } = options;

    // Encoder l'email pour le lien de désinscription
    const encodedEmail = prospectEmail ? encodeURIComponent(prospectEmail) : '';
    const unsubscribeLink = unsubscribeUrl || `https://sos-autopilot-agent.sandra-devonssay-s-account.workers.dev/unsubscribe?email=${encodedEmail}`;

    // Footer RGPD obligatoire pour le cold emailing B2B
    const rgpdFooter = `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 11px; color: #666;">
        <p style="margin: 0 0 8px 0;">
            <strong>Pourquoi ce message ?</strong> Vous recevez cet email car votre activité professionnelle correspond à notre domaine d'expertise.
            Conformément à l'article L.34-5 du CPCE, la prospection B2B est autorisée lorsqu'elle est en rapport avec votre activité professionnelle.
        </p>
        <p style="margin: 0 0 8px 0;">
            ${senderName ? `<strong>${senderName}</strong>` : ''}${senderCompany ? ` - ${senderCompany}` : ''}
        </p>
        <p style="margin: 0;">
            <a href="${unsubscribeLink}" style="color: #666; text-decoration: underline;">
                Se désinscrire / Ne plus recevoir ces emails
            </a>
        </p>
    </div>`;

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
${body.split('\n').map(line => `<p style="margin: 0 0 10px 0;">${line || '&nbsp;'}</p>`).join('')}
${rgpdFooter}
</body>
</html>`;
}

function calculateNextAction(template, agentConfig) {
    const nextDelayDays = template.delay_days || 3;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + nextDelayDays);
    nextDate.setHours(agentConfig.working_hours_start, 0, 0, 0);
    return nextDate.toISOString();
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== SUPABASE HELPERS ====================
async function supabaseQuery(config, table, options) {
    let url = `${config.supabaseUrl}/rest/v1/${table}?select=${options.select || '*'}`;

    if (options.filter) {
        for (const [key, value] of Object.entries(options.filter)) {
            url += `&${key}=eq.${value}`;
        }
    }

    if (options.order) {
        url += `&order=${options.order.column}.${options.order.ascending ? 'asc' : 'desc'}`;
    }

    if (options.limit) {
        url += `&limit=${options.limit}`;
    }

    const response = await fetch(url, {
        headers: {
            'apikey': config.supabaseKey,
            'Authorization': `Bearer ${config.supabaseKey}`
        }
    });

    return response.json();
}

async function supabaseInsert(config, table, data) {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
            'apikey': config.supabaseKey,
            'Authorization': `Bearer ${config.supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
    });

    return response.json();
}

async function supabaseUpdate(config, table, id, data) {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
            'apikey': config.supabaseKey,
            'Authorization': `Bearer ${config.supabaseKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    return response.ok;
}

async function getEmailsSentToday(config, userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await supabaseQuery(config, 'agent_actions', {
        select: 'id',
        filter: {
            user_id: userId,
            action_type: 'email_sent'
        }
    });

    // Filtrer par date côté client (Supabase REST ne supporte pas les comparaisons de date facilement)
    const todayActions = (result || []).filter(a => {
        const actionDate = new Date(a.created_at);
        return actionDate >= today;
    });

    return todayActions.length;
}

async function updateProspectStatus(config, prospectId, status) {
    return supabaseUpdate(config, 'prospects', prospectId, { agent_status: status });
}

async function updateAgentStats(config, userId, field) {
    // Récupérer les stats actuelles
    const configs = await supabaseQuery(config, 'agent_config', {
        select: field,
        filter: { user_id: userId }
    });

    if (configs && configs.length > 0) {
        const currentValue = configs[0][field] || 0;
        await supabaseUpdate(config, 'agent_config', configs[0].id, {
            [field]: currentValue + 1
        });
    }
}

async function createNotification(config, userId, type, title, message, prospectId = null) {
    return supabaseInsert(config, 'agent_notifications', {
        user_id: userId,
        type,
        title,
        message,
        prospect_id: prospectId,
        read: false
    });
}

async function logAgent(config, userId, logType, message, data = null) {
    return supabaseInsert(config, 'agent_logs', {
        user_id: userId,
        log_type: logType,
        message,
        data,
        run_id: data?.run_id || null
    });
}

// ==================== RGPD - DÉSINSCRIPTION ====================
async function unsubscribeEmail(config, email) {
    // Récupérer tous les prospects avec cet email
    const prospects = await supabaseQuery(config, 'prospects', {
        select: 'id,user_id',
        filter: { email: email }
    });

    if (prospects && prospects.length > 0) {
        // Mettre à jour chaque prospect comme désinscrit
        for (const prospect of prospects) {
            await supabaseUpdate(config, 'prospects', prospect.id, {
                agent_status: 'unsubscribed',
                unsubscribed_at: new Date().toISOString()
            });

            // Logger la désinscription
            await logAgent(config, prospect.user_id, 'info', `Désinscription RGPD: ${email}`, {
                prospect_id: prospect.id,
                reason: 'user_request'
            });
        }
    }

    // Ajouter aussi à une table de blocklist pour être sûr
    await supabaseInsert(config, 'email_blocklist', {
        email: email,
        reason: 'unsubscribed',
        created_at: new Date().toISOString()
    });

    return true;
}

function getUnsubscribePageHtml(status, info) {
    const isSuccess = status === 'success';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Désinscription${isSuccess ? ' confirmée' : ''}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }
        .card {
            background: white;
            border-radius: 16px;
            padding: 48px;
            max-width: 480px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        .icon {
            font-size: 64px;
            margin-bottom: 24px;
        }
        h1 {
            font-size: 24px;
            color: #1a1a1a;
            margin-bottom: 16px;
        }
        p {
            color: #666;
            line-height: 1.6;
            margin-bottom: 12px;
        }
        .email {
            font-weight: 600;
            color: #333;
        }
        .info {
            background: #f0f4ff;
            border-radius: 8px;
            padding: 16px;
            margin-top: 24px;
            font-size: 14px;
            color: #555;
        }
        .error-card {
            border: 2px solid #ef4444;
        }
        .error-card .icon { color: #ef4444; }
    </style>
</head>
<body>
    <div class="card ${isSuccess ? '' : 'error-card'}">
        <div class="icon">${isSuccess ? '✅' : '❌'}</div>
        ${isSuccess ? `
            <h1>Désinscription confirmée</h1>
            <p>L'adresse <span class="email">${info}</span> a bien été retirée de notre liste de diffusion.</p>
            <p>Vous ne recevrez plus d'emails de prospection de notre part.</p>
            <div class="info">
                <strong>Conformité RGPD</strong><br>
                Votre demande a été traitée immédiatement conformément au Règlement Général sur la Protection des Données.
            </div>
        ` : `
            <h1>Erreur</h1>
            <p>${info}</p>
            <p>Si le problème persiste, veuillez nous contacter directement.</p>
        `}
    </div>
</body>
</html>`;
}
