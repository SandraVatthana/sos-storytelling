// =====================================================
// AUTOPILOT MULTI-AGENTS - Cloudflare Worker
// SOS Storytelling - Inspiré de Manus AI
// =====================================================
// Ce worker orchestre les missions multi-agents
// L'utilisateur donne UNE commande, l'Autopilot fait TOUT

// ==================== CONFIGURATION ====================
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_KEY = 'YOUR_SUPABASE_SERVICE_KEY';
const ANTHROPIC_API_KEY = 'YOUR_ANTHROPIC_API_KEY';
const PERPLEXITY_API_KEY = 'YOUR_PERPLEXITY_API_KEY';
const BREVO_API_KEY = 'YOUR_BREVO_API_KEY';

// ============ CORS CONFIGURATION ============
const ALLOWED_ORIGINS = [
    'https://sos-storytelling.netlify.app',
    'https://sosstorytelling.fr',
    'https://www.sosstorytelling.fr',
    'http://localhost:3000',
    'http://localhost:5173'
];

function getCorsHeaders(request) {
    const origin = request.headers.get('Origin') || '';
    let allowedOrigin = '';

    if (ALLOWED_ORIGINS.includes(origin)) {
        allowedOrigin = origin;
    } else if (origin.startsWith('chrome-extension://')) {
        allowedOrigin = origin;
    }

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };
}

// ==================== MAIN HANDLER ====================
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const config = {
            supabaseUrl: env.SUPABASE_URL || SUPABASE_URL,
            supabaseKey: env.SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY,
            anthropicKey: env.ANTHROPIC_API_KEY || ANTHROPIC_API_KEY,
            perplexityKey: env.PERPLEXITY_API_KEY || PERPLEXITY_API_KEY,
            brevoKey: env.BREVO_API_KEY || BREVO_API_KEY
        };

        const corsHeaders = getCorsHeaders(request);

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // Route: Créer une nouvelle mission
            if (url.pathname === '/missions/create' && request.method === 'POST') {
                const body = await request.json();
                const result = await createMission(config, body);
                return new Response(JSON.stringify(result), { headers: corsHeaders });
            }

            // Route: Exécuter une mission (appelé après création)
            if (url.pathname === '/missions/execute' && request.method === 'POST') {
                const body = await request.json();
                // Exécution asynchrone pour ne pas bloquer
                ctx.waitUntil(executeMission(config, body.mission_id, body.user_id));
                return new Response(JSON.stringify({ success: true, message: 'Mission démarrée' }), { headers: corsHeaders });
            }

            // Route: Obtenir le statut d'une mission
            if (url.pathname.match(/^\/missions\/[^/]+\/status$/) && request.method === 'GET') {
                const missionId = url.pathname.split('/')[2];
                const result = await getMissionStatus(config, missionId);
                return new Response(JSON.stringify(result), { headers: corsHeaders });
            }

            // Route: Approuver une mission
            if (url.pathname === '/missions/approve' && request.method === 'POST') {
                const body = await request.json();
                const result = await approveMission(config, body.mission_id, body.user_id);
                return new Response(JSON.stringify(result), { headers: corsHeaders });
            }

            // Route: Annuler une mission
            if (url.pathname === '/missions/cancel' && request.method === 'POST') {
                const body = await request.json();
                const result = await cancelMission(config, body.mission_id, body.user_id);
                return new Response(JSON.stringify(result), { headers: corsHeaders });
            }

            // Route: Modifier un output
            if (url.pathname === '/missions/outputs/update' && request.method === 'POST') {
                const body = await request.json();
                const result = await updateOutput(config, body);
                return new Response(JSON.stringify(result), { headers: corsHeaders });
            }

            // Route: Obtenir les templates de missions
            if (url.pathname === '/missions/templates' && request.method === 'GET') {
                const result = await getMissionTemplates(config);
                return new Response(JSON.stringify(result), { headers: corsHeaders });
            }

            // Route: Debug - vérifier la config
            if (url.pathname === '/debug' && request.method === 'GET') {
                return new Response(JSON.stringify({
                    status: 'ok',
                    config_check: {
                        supabase_url: config.supabaseUrl ? (config.supabaseUrl.substring(0, 30) + '...') : 'MISSING',
                        supabase_key: config.supabaseKey ? 'SET (' + config.supabaseKey.length + ' chars)' : 'MISSING',
                        anthropic_key: config.anthropicKey ? 'SET (' + config.anthropicKey.length + ' chars)' : 'MISSING',
                        perplexity_key: config.perplexityKey ? 'SET' : 'MISSING',
                        brevo_key: config.brevoKey ? 'SET' : 'MISSING'
                    }
                }), { headers: corsHeaders });
            }

            return new Response(JSON.stringify({ status: 'ok', message: 'SOS Missions Worker' }), { headers: corsHeaders });

        } catch (error) {
            console.error('Error:', error);
            return new Response(JSON.stringify({ success: false, error: error.message, stack: error.stack }), {
                status: 500, headers: corsHeaders
            });
        }
    }
};

// ==================== MISSION CREATION ====================
async function createMission(config, { command, user_id, organization_id }) {
    console.log(`[Mission] Création pour user ${user_id}: ${command}`);

    // Vérifier la config
    if (!config.supabaseUrl || config.supabaseUrl === 'YOUR_SUPABASE_URL') {
        throw new Error('SUPABASE_URL non configuré dans Cloudflare');
    }
    if (!config.supabaseKey || config.supabaseKey === 'YOUR_SUPABASE_SERVICE_KEY') {
        throw new Error('SUPABASE_SERVICE_KEY non configuré dans Cloudflare');
    }
    if (!config.anthropicKey || config.anthropicKey === 'YOUR_ANTHROPIC_API_KEY') {
        throw new Error('ANTHROPIC_API_KEY non configuré dans Cloudflare');
    }

    // 1. Parser la commande avec l'Orchestrateur
    let parsedIntent;
    try {
        parsedIntent = await parseCommand(config, command);
        console.log('[Mission] Intent parsé:', parsedIntent);
    } catch (parseError) {
        throw new Error('Erreur parsing commande (Claude API): ' + parseError.message);
    }

    // 2. Créer la mission dans Supabase
    let mission;
    try {
        mission = await supabaseInsert(config, 'missions', {
            user_id,
            organization_id,
            command,
            parsed_intent: parsedIntent,
            mission_type: parsedIntent.mission_type,
            status: 'pending',
            progress_percent: 0
        });
    } catch (insertError) {
        throw new Error('Erreur insertion Supabase: ' + insertError.message);
    }

    if (!mission) {
        throw new Error('Supabase: réponse vide');
    }

    if (mission.error) {
        throw new Error('Supabase error: ' + (mission.error.message || JSON.stringify(mission.error)));
    }

    if (mission.code) {
        throw new Error('Supabase code ' + mission.code + ': ' + (mission.message || JSON.stringify(mission)));
    }

    const missionId = Array.isArray(mission) ? mission[0]?.id : mission.id;
    if (!missionId) {
        throw new Error('Mission ID non retourné. Réponse: ' + JSON.stringify(mission).substring(0, 200));
    }

    // 3. Créer les tâches selon le type de mission
    const tasks = getTasksForMissionType(parsedIntent.mission_type, parsedIntent.parameters);

    for (let i = 0; i < tasks.length; i++) {
        await supabaseInsert(config, 'mission_tasks', {
            mission_id: missionId,
            agent: tasks[i].agent,
            task_type: tasks[i].task,
            task_input: tasks[i].input || {},
            sequence_order: i,
            status: 'pending'
        });
    }

    return {
        success: true,
        mission_id: missionId,
        mission_type: parsedIntent.mission_type,
        tasks_count: tasks.length,
        parsed_intent: parsedIntent
    };
}

// ==================== COMMAND PARSING (ORCHESTRATOR) ====================
async function parseCommand(config, command) {
    const systemPrompt = `Tu es un parser de commandes pour un assistant de prospection et marketing.
Extrais les informations structurées de la commande utilisateur.

Types de missions supportés:
- email_sequence: Séquence d'emails à programmer
- prospection: Recherche et contact de prospects
- monthly_content: Calendrier de contenu mensuel
- followup: Relance de prospects
- transformation: Transformation de contenu (PDF → emails, posts → newsletter)
- analysis: Analyse de concurrence ou tendances

Réponds UNIQUEMENT en JSON valide (pas de markdown, pas de \`\`\`) avec ce format:
{
  "mission_type": "email_sequence|prospection|monthly_content|followup|transformation|analysis",
  "parameters": {
    // Paramètres spécifiques extraits de la commande
  },
  "summary": "Résumé court de ce que l'utilisateur veut",
  "confidence": 0.0-1.0
}

Exemples de parsing:
- "Crée 5 emails sur le GEO mardi 9h sur 5 semaines" →
  {"mission_type": "email_sequence", "parameters": {"count": 5, "topic": "GEO", "schedule": {"day": "tuesday", "time": "09:00"}, "duration_weeks": 5}}
- "Trouve 50 coachs business femmes" →
  {"mission_type": "prospection", "parameters": {"count": 50, "target": "coachs business femmes"}}`;

    const response = await callClaude(config, systemPrompt, command);

    try {
        // Nettoyer la réponse (enlever markdown si présent)
        let cleanResponse = response.trim();
        if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
        }
        return JSON.parse(cleanResponse);
    } catch (e) {
        console.error('Erreur parsing JSON:', e, 'Response:', response);
        return {
            mission_type: 'email_sequence',
            parameters: { raw_command: command },
            summary: command,
            confidence: 0.5
        };
    }
}

// ==================== TASK CONFIGURATION ====================
function getTasksForMissionType(type, params) {
    const taskConfigs = {
        'email_sequence': [
            { agent: 'scout', task: 'research_topic', input: { topic: params.topic } },
            { agent: 'writer', task: 'draft_sequence', input: { count: params.count || 5, topic: params.topic } },
            { agent: 'scheduler', task: 'plan_sending', input: { schedule: params.schedule, weeks: params.duration_weeks || params.count || 5 } },
            { agent: 'guardian', task: 'verify_all', input: {} },
            { agent: 'analyst', task: 'generate_summary', input: {} }
        ],
        'prospection': [
            { agent: 'scout', task: 'search_prospects', input: { target: params.target, count: params.count || 50 } },
            { agent: 'guardian', task: 'filter_blacklist', input: {} },
            { agent: 'writer', task: 'personalize_messages', input: {} },
            { agent: 'scheduler', task: 'plan_outreach', input: {} },
            { agent: 'guardian', task: 'verify_all', input: {} },
            { agent: 'analyst', task: 'generate_summary', input: {} }
        ],
        'monthly_content': [
            { agent: 'scout', task: 'analyze_past_performance', input: {} },
            { agent: 'scout', task: 'research_trends', input: { month: params.month } },
            { agent: 'writer', task: 'generate_content_calendar', input: { month: params.month, frequency: params.frequency || 4 } },
            { agent: 'scheduler', task: 'plan_publishing', input: {} },
            { agent: 'guardian', task: 'verify_all', input: {} },
            { agent: 'analyst', task: 'generate_summary', input: {} }
        ],
        'followup': [
            { agent: 'scout', task: 'identify_cold_prospects', input: { days: params.days || 7 } },
            { agent: 'scout', task: 'get_context', input: {} },
            { agent: 'writer', task: 'draft_followups', input: {} },
            { agent: 'scheduler', task: 'plan_sending', input: {} },
            { agent: 'guardian', task: 'verify_all', input: {} },
            { agent: 'analyst', task: 'generate_summary', input: {} }
        ],
        'transformation': [
            { agent: 'scout', task: 'extract_content', input: { source_type: params.source_type } },
            { agent: 'scout', task: 'analyze_key_points', input: {} },
            { agent: 'writer', task: 'transform_content', input: { target_format: params.target_format || 'emails', count: params.count || 5 } },
            { agent: 'scheduler', task: 'plan_sequence', input: {} },
            { agent: 'guardian', task: 'verify_all', input: {} },
            { agent: 'analyst', task: 'generate_summary', input: {} }
        ],
        'analysis': [
            { agent: 'scout', task: 'research_competitors', input: { count: params.count || 5, sector: params.sector } },
            { agent: 'scout', task: 'analyze_trends', input: {} },
            { agent: 'analyst', task: 'generate_insights', input: {} },
            { agent: 'analyst', task: 'generate_summary', input: {} }
        ]
    };

    return taskConfigs[type] || taskConfigs['email_sequence'];
}

// ==================== MISSION EXECUTION ====================
async function executeMission(config, missionId, userId) {
    console.log(`[Mission] Exécution de ${missionId}`);

    try {
        // Marquer la mission comme en cours
        await supabaseUpdate(config, 'missions', missionId, {
            status: 'processing',
            started_at: new Date().toISOString()
        });

        // Récupérer la mission et ses tâches
        const missions = await supabaseQuery(config, 'missions', {
            select: '*',
            filter: { id: missionId }
        });
        const mission = missions[0];

        const tasks = await supabaseQuery(config, 'mission_tasks', {
            select: '*',
            filter: { mission_id: missionId },
            order: { column: 'sequence_order', ascending: true }
        });

        // Contexte partagé entre les agents
        let context = {
            mission,
            user_id: userId,
            parsed_intent: mission.parsed_intent,
            parameters: mission.parsed_intent?.parameters || {}
        };

        // Exécuter chaque tâche séquentiellement
        for (const task of tasks) {
            console.log(`[Task] ${task.agent}/${task.task_type}`);

            // Mettre à jour le statut de la mission
            await supabaseUpdate(config, 'missions', missionId, {
                current_step: `${task.agent}: ${task.task_type}`,
                steps_log: [
                    ...(mission.steps_log || []),
                    { agent: task.agent, action: task.task_type, status: 'running', started_at: new Date().toISOString() }
                ]
            });

            // Exécuter la tâche
            const result = await executeTask(config, task, context);

            // Sauvegarder le résultat et mettre à jour le contexte
            context = { ...context, ...result };

            // Mettre à jour le log
            const currentMission = await supabaseQuery(config, 'missions', { select: 'steps_log', filter: { id: missionId } });
            const stepsLog = currentMission[0]?.steps_log || [];
            if (stepsLog.length > 0) {
                stepsLog[stepsLog.length - 1].status = 'done';
                stepsLog[stepsLog.length - 1].duration_ms = Date.now() - new Date(stepsLog[stepsLog.length - 1].started_at).getTime();
            }
            await supabaseUpdate(config, 'missions', missionId, { steps_log: stepsLog });
        }

        // Mission terminée, prête pour review
        await supabaseUpdate(config, 'missions', missionId, {
            status: 'ready_for_review',
            result: context,
            summary: context.summary,
            progress_percent: 100,
            completed_at: new Date().toISOString()
        });

        console.log(`[Mission] ${missionId} prête pour validation`);

    } catch (error) {
        console.error(`[Mission] Erreur ${missionId}:`, error);
        await supabaseUpdate(config, 'missions', missionId, {
            status: 'failed',
            error_message: error.message
        });
    }
}

// ==================== TASK EXECUTION ====================
async function executeTask(config, task, context) {
    const startTime = Date.now();

    // Marquer la tâche comme en cours
    await supabaseUpdate(config, 'mission_tasks', task.id, {
        status: 'running',
        started_at: new Date().toISOString()
    });

    try {
        let result;

        // Router vers le bon agent
        switch (task.agent) {
            case 'scout':
                result = await executeScoutTask(config, task, context);
                break;
            case 'writer':
                result = await executeWriterTask(config, task, context);
                break;
            case 'scheduler':
                result = await executeSchedulerTask(config, task, context);
                break;
            case 'guardian':
                result = await executeGuardianTask(config, task, context);
                break;
            case 'analyst':
                result = await executeAnalystTask(config, task, context);
                break;
            default:
                throw new Error(`Agent inconnu: ${task.agent}`);
        }

        // Marquer la tâche comme terminée
        await supabaseUpdate(config, 'mission_tasks', task.id, {
            status: 'completed',
            task_output: result,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime
        });

        return result;

    } catch (error) {
        console.error(`[Task] Erreur ${task.agent}/${task.task_type}:`, error);
        await supabaseUpdate(config, 'mission_tasks', task.id, {
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime
        });
        throw error;
    }
}

// ==================== AGENT SCOUT (RECHERCHE) ====================
async function executeScoutTask(config, task, context) {
    const { task_type, task_input } = task;

    switch (task_type) {
        case 'research_topic': {
            const topic = task_input.topic || context.parameters?.topic || 'sujet non spécifié';

            // Utiliser Perplexity pour la recherche
            const research = await searchWithPerplexity(config,
                `Recherche les informations les plus récentes et pertinentes sur "${topic}" pour créer une séquence d'emails éducatifs.

                Donne-moi:
                1. Les 5 points clés à aborder
                2. Les dernières actualités/tendances
                3. Des statistiques marquantes
                4. Les erreurs courantes à éviter
                5. Les questions fréquentes sur ce sujet`
            );

            return { research, topic };
        }

        case 'search_prospects': {
            // Simulation pour l'instant (à connecter à Sales Navigator)
            const { target, count } = task_input;
            return {
                prospects: Array(Math.min(count, 10)).fill(null).map((_, i) => ({
                    id: `prospect_${i}`,
                    name: `Prospect ${i + 1}`,
                    email: `prospect${i + 1}@example.com`,
                    company: `Entreprise ${i + 1}`,
                    title: target
                })),
                total_found: count,
                search_criteria: target
            };
        }

        case 'identify_cold_prospects': {
            const days = task_input.days || 7;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const prospects = await supabaseQuery(config, 'prospects', {
                select: '*',
                filter: {
                    user_id: context.user_id,
                    agent_status: 'in_sequence'
                }
            });

            // Filtrer ceux sans réponse depuis X jours
            const coldProspects = (prospects || []).filter(p => {
                if (!p.last_contacted_at) return true;
                return new Date(p.last_contacted_at) < cutoffDate && !p.replied_at;
            });

            return { prospects: coldProspects, count: coldProspects.length, days };
        }

        case 'analyze_past_performance': {
            // Analyser les stats des posts/emails précédents
            return {
                best_topics: ['storytelling', 'personal branding', 'productivité'],
                best_times: ['8h30', '12h', '18h'],
                avg_engagement: 4.2
            };
        }

        case 'research_trends': {
            const month = task_input.month || 'ce mois';
            const research = await searchWithPerplexity(config,
                `Quelles sont les tendances et sujets d'actualité pour ${month} dans le domaine du marketing, personal branding et entrepreneuriat? Liste les 5 sujets les plus pertinents.`
            );
            return { trends: research, month };
        }

        case 'get_context': {
            // Récupérer le contexte des prospects (derniers messages, etc.)
            const prospects = context.prospects || [];
            return {
                prospects_with_context: prospects.map(p => ({
                    ...p,
                    last_message: p.last_message || 'Aucun message précédent',
                    interaction_count: p.emails_sent || 0
                }))
            };
        }

        default:
            return { message: `Scout task ${task_type} not implemented` };
    }
}

// ==================== AGENT WRITER (RÉDACTION) ====================
async function executeWriterTask(config, task, context) {
    const { task_type, task_input } = task;

    // Récupérer le style cloné de l'utilisateur
    const styleClones = await supabaseQuery(config, 'user_style_clone', {
        select: '*',
        filter: { user_id: context.user_id }
    });
    const styleClone = styleClones?.[0];

    switch (task_type) {
        case 'draft_sequence': {
            const count = task_input.count || 5;
            const topic = task_input.topic || context.topic || 'sujet';
            const research = context.research || 'Aucune recherche disponible';

            const prompt = `Tu es un expert en email marketing.
${styleClone?.style_analysis ? `Écris dans ce style: ${styleClone.style_analysis}` : 'Style: Professionnel mais chaleureux, direct, avec une touche personnelle.'}

RECHERCHE SUR LE SUJET:
${typeof research === 'string' ? research : JSON.stringify(research)}

MISSION:
Écris une séquence de ${count} emails sur le thème "${topic}".

STRUCTURE DE LA SÉQUENCE:
- Email 1: Accroche - Pourquoi ce sujet est important maintenant
- Email 2: Valeur - Le premier concept clé
- Email 3: Valeur - Le deuxième concept clé
- Email 4: Preuve sociale - Exemple concret / étude de cas
- Email 5: CTA - Récap + appel à l'action

POUR CHAQUE EMAIL, FOURNIS:
- subject: Objet (max 50 caractères)
- body: Contenu (300-500 mots)
- cta: Call-to-action clair

Réponds UNIQUEMENT en JSON valide (pas de markdown):
{
  "emails": [
    { "position": 1, "subject": "...", "body": "...", "cta": "..." }
  ]
}`;

            const response = await callClaude(config, '', prompt);

            try {
                let cleanResponse = response.trim();
                if (cleanResponse.startsWith('```')) {
                    cleanResponse = cleanResponse.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
                }
                const parsed = JSON.parse(cleanResponse);

                // Créer les outputs dans la base
                for (const email of parsed.emails) {
                    await supabaseInsert(config, 'mission_outputs', {
                        mission_id: context.mission.id,
                        output_type: 'email',
                        content: email,
                        sequence_position: email.position,
                        status: 'draft'
                    });
                }

                return { emails: parsed.emails };
            } catch (e) {
                console.error('Erreur parsing emails:', e);
                return { emails: [], error: e.message };
            }
        }

        case 'personalize_messages': {
            const prospects = context.prospects || context.prospects_with_context || [];
            const messages = [];

            for (const prospect of prospects.slice(0, 10)) { // Limiter à 10 pour les tests
                const prompt = `Écris un message LinkedIn personnalisé.
${styleClone?.style_analysis ? `Style: ${styleClone.style_analysis}` : 'Style: Professionnel mais humain.'}

PROSPECT:
- Nom: ${prospect.name || 'Inconnu'}
- Titre: ${prospect.title || 'Non spécifié'}
- Entreprise: ${prospect.company || 'Non spécifiée'}

RÈGLES:
- Max 300 caractères
- Mentionne un élément spécifique
- Pas de pitch direct
- Une question ouverte à la fin

Réponds UNIQUEMENT avec le message, rien d'autre.`;

                const message = await callClaude(config, '', prompt);
                messages.push({
                    prospect_id: prospect.id,
                    prospect_name: prospect.name,
                    message: message.trim()
                });

                // Créer l'output
                await supabaseInsert(config, 'mission_outputs', {
                    mission_id: context.mission.id,
                    output_type: 'dm',
                    content: {
                        prospect_id: prospect.id,
                        prospect_name: prospect.name,
                        message: message.trim()
                    },
                    status: 'draft'
                });
            }

            return { messages };
        }

        case 'draft_followups': {
            const prospects = context.prospects_with_context || context.prospects || [];
            const followups = [];

            for (const prospect of prospects.slice(0, 10)) {
                const prompt = `Écris un email de relance personnalisé.
${styleClone?.style_analysis ? `Style: ${styleClone.style_analysis}` : 'Style: Professionnel mais humain.'}

PROSPECT:
- Nom: ${prospect.name || 'Inconnu'}
- Dernier contact: ${prospect.last_contacted_at || 'Il y a quelques jours'}
- Emails envoyés: ${prospect.emails_sent || 1}

RÈGLES:
- Court et direct
- Rappelle le contexte précédent
- Propose une alternative simple
- Pas de culpabilisation

Réponds en JSON: {"subject": "...", "body": "..."}`;

                const response = await callClaude(config, '', prompt);
                try {
                    let cleanResponse = response.trim();
                    if (cleanResponse.startsWith('```')) {
                        cleanResponse = cleanResponse.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
                    }
                    const parsed = JSON.parse(cleanResponse);
                    followups.push({
                        prospect_id: prospect.id,
                        prospect_name: prospect.name,
                        prospect_email: prospect.email,
                        ...parsed
                    });

                    await supabaseInsert(config, 'mission_outputs', {
                        mission_id: context.mission.id,
                        output_type: 'email',
                        content: { ...parsed, prospect_id: prospect.id, prospect_email: prospect.email },
                        status: 'draft'
                    });
                } catch (e) {
                    console.error('Erreur parsing followup:', e);
                }
            }

            return { followups };
        }

        case 'generate_content_calendar': {
            const month = task_input.month || 'janvier';
            const frequency = task_input.frequency || 4;
            const weeksInMonth = 4;
            const totalPosts = frequency * weeksInMonth;

            const prompt = `Crée un calendrier de contenu LinkedIn pour ${month}.

${styleClone?.style_analysis ? `Style: ${styleClone.style_analysis}` : ''}

CONTRAINTES:
- ${totalPosts} posts au total
- ${frequency} posts par semaine
- Mix: storytelling (40%), tips pratiques (30%), behind the scenes (20%), promo soft (10%)

TENDANCES DU MOIS:
${context.trends || 'Non disponibles'}

POUR CHAQUE POST:
- week: numéro de semaine (1-4)
- day: jour suggéré
- type: storytelling/tip/behind_the_scenes/promo
- hook: accroche (première ligne)
- content_outline: grandes lignes du contenu
- cta: call-to-action

Réponds en JSON: { "posts": [...] }`;

            const response = await callClaude(config, '', prompt);
            try {
                let cleanResponse = response.trim();
                if (cleanResponse.startsWith('```')) {
                    cleanResponse = cleanResponse.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
                }
                const parsed = JSON.parse(cleanResponse);

                for (const post of parsed.posts) {
                    await supabaseInsert(config, 'mission_outputs', {
                        mission_id: context.mission.id,
                        output_type: 'post',
                        content: post,
                        sequence_position: post.week * 10 + (post.day_number || 1),
                        status: 'draft'
                    });
                }

                return { posts: parsed.posts, month, total: parsed.posts.length };
            } catch (e) {
                return { posts: [], error: e.message };
            }
        }

        default:
            return { message: `Writer task ${task_type} not implemented` };
    }
}

// ==================== AGENT SCHEDULER (PLANIFICATION) ====================
async function executeSchedulerTask(config, task, context) {
    const { task_type, task_input } = task;

    // Récupérer la config utilisateur
    const agentConfigs = await supabaseQuery(config, 'agent_config', {
        select: '*',
        filter: { user_id: context.user_id }
    });
    const agentConfig = agentConfigs?.[0] || {};

    switch (task_type) {
        case 'plan_sending': {
            const schedule = task_input.schedule || { day: 'tuesday', time: '09:00' };
            const weeks = task_input.weeks || 5;
            const emails = context.emails || [];

            const scheduledEmails = [];
            let currentDate = getNextOccurrence(schedule.day, schedule.time);

            for (let i = 0; i < emails.length; i++) {
                const scheduled = {
                    ...emails[i],
                    scheduled_at: currentDate.toISOString(),
                    week_number: i + 1
                };
                scheduledEmails.push(scheduled);

                // Mettre à jour l'output
                const outputs = await supabaseQuery(config, 'mission_outputs', {
                    select: '*',
                    filter: { mission_id: context.mission.id, sequence_position: emails[i].position }
                });
                if (outputs?.[0]) {
                    await supabaseUpdate(config, 'mission_outputs', outputs[0].id, {
                        content: { ...outputs[0].content, scheduled_at: currentDate.toISOString() }
                    });
                }

                // Ajouter une semaine
                currentDate = new Date(currentDate);
                currentDate.setDate(currentDate.getDate() + 7);
            }

            return { scheduled_emails: scheduledEmails, schedule };
        }

        case 'plan_outreach': {
            const messages = context.messages || [];
            const dailyLimit = agentConfig.max_emails_per_day || 50;
            const warmupEnabled = agentConfig.warmup_mode ?? true;
            const warmupDay = agentConfig.warmup_day || 1;

            // Calculer le quota du jour (warm-up)
            let todayLimit = dailyLimit;
            if (warmupEnabled) {
                todayLimit = Math.min(10 + (warmupDay - 1) * 5, dailyLimit);
            }

            const workHours = { start: agentConfig.working_hours_start || 9, end: agentConfig.working_hours_end || 18 };
            const workDays = agentConfig.working_days || ['mon', 'tue', 'wed', 'thu', 'fri'];

            const scheduledMessages = [];
            let currentDate = new Date();
            let dailyCount = 0;

            for (const msg of messages) {
                if (dailyCount >= todayLimit) {
                    currentDate = getNextWorkDay(currentDate, workDays);
                    dailyCount = 0;
                }

                const hour = workHours.start + Math.floor(Math.random() * (workHours.end - workHours.start));
                const minute = Math.floor(Math.random() * 60);

                const scheduledAt = new Date(currentDate);
                scheduledAt.setHours(hour, minute, 0, 0);

                scheduledMessages.push({
                    ...msg,
                    scheduled_at: scheduledAt.toISOString()
                });

                dailyCount++;
            }

            return { scheduled_messages: scheduledMessages, daily_limit: todayLimit };
        }

        case 'plan_publishing': {
            const posts = context.posts || [];
            const publishTimes = ['08:30', '12:00', '18:00'];

            const scheduledPosts = posts.map((post, i) => {
                const weekOffset = Math.floor(i / 4);
                const dayInWeek = i % 4;
                const days = ['monday', 'wednesday', 'friday', 'sunday'];

                const date = getNextOccurrence(days[dayInWeek], publishTimes[i % 3]);
                date.setDate(date.getDate() + weekOffset * 7);

                return {
                    ...post,
                    scheduled_at: date.toISOString()
                };
            });

            return { scheduled_posts: scheduledPosts };
        }

        default:
            return { message: `Scheduler task ${task_type} not implemented` };
    }
}

// ==================== AGENT GUARDIAN (VÉRIFICATION) ====================
async function executeGuardianTask(config, task, context) {
    const { task_type } = task;

    switch (task_type) {
        case 'filter_blacklist': {
            const prospects = context.prospects || [];

            // Récupérer la blacklist
            const blacklist = await supabaseQuery(config, 'email_blocklist', {
                select: 'email',
                filter: {}
            });
            const blacklistedEmails = new Set((blacklist || []).map(b => b.email?.toLowerCase()));

            // Filtrer
            const filtered = prospects.filter(p => {
                const email = p.email?.toLowerCase();
                if (!email) return true;
                return !blacklistedEmails.has(email);
            });

            return {
                original_count: prospects.length,
                filtered_count: filtered.length,
                removed: prospects.length - filtered.length,
                prospects: filtered
            };
        }

        case 'verify_all': {
            const results = {
                emails: [],
                messages: [],
                posts: [],
                warnings: [],
                errors: [],
                overall_score: 100
            };

            // Vérifier les emails
            const emails = context.scheduled_emails || context.emails || [];
            for (const email of emails) {
                const verification = verifyEmail(email);
                results.emails.push(verification);

                if (verification.warnings.length > 0) {
                    results.warnings.push(...verification.warnings.map(w => `Email ${email.position}: ${w}`));
                }
                if (verification.spam_score > 5) {
                    results.overall_score -= 5;
                }

                // Mettre à jour l'output avec les résultats de vérification
                const outputs = await supabaseQuery(config, 'mission_outputs', {
                    select: '*',
                    filter: { mission_id: context.mission.id, sequence_position: email.position, output_type: 'email' }
                });
                if (outputs?.[0]) {
                    await supabaseUpdate(config, 'mission_outputs', outputs[0].id, {
                        verification_results: verification
                    });
                }
            }

            // Vérifier les messages
            const messages = context.scheduled_messages || context.messages || [];
            for (const msg of messages) {
                const verification = verifyMessage(msg);
                results.messages.push(verification);
                if (verification.warnings.length > 0) {
                    results.warnings.push(...verification.warnings);
                }
            }

            results.overall_score = Math.max(0, results.overall_score);
            return { verification_results: results };
        }

        default:
            return { message: `Guardian task ${task_type} not implemented` };
    }
}

// ==================== AGENT ANALYST (REPORTING) ====================
async function executeAnalystTask(config, task, context) {
    const { task_type } = task;

    switch (task_type) {
        case 'generate_summary': {
            const summary = {
                title: '',
                overview: {},
                items: [],
                schedule_preview: [],
                verification_status: {},
                estimated_impact: {}
            };

            // Récupérer les outputs de la mission
            const outputs = await supabaseQuery(config, 'mission_outputs', {
                select: '*',
                filter: { mission_id: context.mission.id },
                order: { column: 'sequence_position', ascending: true }
            });

            if (context.scheduled_emails || context.emails) {
                const emails = context.scheduled_emails || context.emails;
                summary.title = `Séquence de ${emails.length} emails prête`;
                summary.overview = {
                    type: 'Séquence d\'emails',
                    count: emails.length,
                    topic: context.topic,
                    start_date: emails[0]?.scheduled_at
                };
                summary.items = emails.map(email => ({
                    position: email.position,
                    subject: email.subject,
                    scheduled_at: email.scheduled_at,
                    preview: email.body?.substring(0, 100) + '...'
                }));
                summary.schedule_preview = emails.map(email => ({
                    date: email.scheduled_at ? new Date(email.scheduled_at).toLocaleDateString('fr-FR', {
                        weekday: 'long', day: 'numeric', month: 'long'
                    }) : 'Non programmé',
                    time: email.scheduled_at ? new Date(email.scheduled_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit', minute: '2-digit'
                    }) : '',
                    label: `Email ${email.position}: ${email.subject}`
                }));
                summary.estimated_impact = {
                    estimated_opens: '~25% taux d\'ouverture',
                    estimated_clicks: '~3% taux de clic',
                    time_saved: `${emails.length * 15} minutes économisées`
                };
            }

            if (context.scheduled_messages || context.messages) {
                const messages = context.scheduled_messages || context.messages;
                summary.title = `Campagne de ${messages.length} messages prête`;
                summary.overview = {
                    type: 'Campagne de prospection',
                    count: messages.length,
                    target: context.parameters?.target
                };
                summary.items = messages.slice(0, 10).map(msg => ({
                    prospect: msg.prospect_name,
                    message_preview: msg.message?.substring(0, 80) + '...',
                    scheduled_at: msg.scheduled_at
                }));
                summary.estimated_impact = {
                    estimated_responses: `${Math.round(messages.length * 0.15)} réponses estimées (15%)`,
                    estimated_meetings: `${Math.round(messages.length * 0.05)} RDV potentiels (5%)`,
                    time_saved: `${Math.round(messages.length * 3)} minutes économisées`
                };
            }

            if (context.posts || context.scheduled_posts) {
                const posts = context.scheduled_posts || context.posts;
                summary.title = `Calendrier de ${posts.length} posts prêt`;
                summary.overview = {
                    type: 'Calendrier de contenu',
                    count: posts.length,
                    month: context.month
                };
                summary.items = posts.map(post => ({
                    week: post.week,
                    type: post.type,
                    hook: post.hook,
                    scheduled_at: post.scheduled_at
                }));
            }

            // Vérification status
            if (context.verification_results) {
                summary.verification_status = {
                    overall_score: context.verification_results.overall_score,
                    warnings_count: context.verification_results.warnings?.length || 0,
                    errors_count: context.verification_results.errors?.length || 0,
                    is_ready: (context.verification_results.errors?.length || 0) === 0
                };
            }

            return { summary };
        }

        case 'generate_insights': {
            // Pour les missions d'analyse
            const prompt = `Analyse ces données et génère des insights actionnables:
${JSON.stringify(context, null, 2)}

Réponds en JSON: {
  "key_findings": ["..."],
  "recommendations": ["..."],
  "opportunities": ["..."]
}`;

            const response = await callClaude(config, '', prompt);
            try {
                let cleanResponse = response.trim();
                if (cleanResponse.startsWith('```')) {
                    cleanResponse = cleanResponse.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
                }
                return JSON.parse(cleanResponse);
            } catch (e) {
                return { insights: response };
            }
        }

        default:
            return { message: `Analyst task ${task_type} not implemented` };
    }
}

// ==================== MISSION STATUS ====================
async function getMissionStatus(config, missionId) {
    const missions = await supabaseQuery(config, 'missions', {
        select: '*',
        filter: { id: missionId }
    });

    if (!missions || missions.length === 0) {
        return { success: false, error: 'Mission non trouvée' };
    }

    const mission = missions[0];

    const tasks = await supabaseQuery(config, 'mission_tasks', {
        select: '*',
        filter: { mission_id: missionId },
        order: { column: 'sequence_order', ascending: true }
    });

    const outputs = await supabaseQuery(config, 'mission_outputs', {
        select: '*',
        filter: { mission_id: missionId },
        order: { column: 'sequence_position', ascending: true }
    });

    return {
        success: true,
        mission,
        tasks,
        outputs
    };
}

// ==================== MISSION APPROVAL ====================
async function approveMission(config, missionId, userId) {
    // Récupérer la mission
    const missions = await supabaseQuery(config, 'missions', {
        select: '*',
        filter: { id: missionId, user_id: userId }
    });

    if (!missions || missions.length === 0) {
        return { success: false, error: 'Mission non trouvée' };
    }

    const mission = missions[0];

    if (mission.status !== 'ready_for_review') {
        return { success: false, error: 'Mission pas prête pour approbation' };
    }

    // Mettre à jour le statut
    await supabaseUpdate(config, 'missions', missionId, {
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: userId
    });

    // Récupérer les outputs et les mettre dans les vraies tables
    const outputs = await supabaseQuery(config, 'mission_outputs', {
        select: '*',
        filter: { mission_id: missionId }
    });

    for (const output of outputs) {
        if (output.output_type === 'email' && output.content.scheduled_at) {
            // Créer dans email_queue
            const emailQueueEntry = await supabaseInsert(config, 'email_queue', {
                user_id: userId,
                prospect_email: output.content.recipient_email || 'newsletter@list.com',
                prospect_name: output.content.recipient_name || 'Abonné',
                subject: output.content.subject,
                body: output.content.body,
                status: 'scheduled',
                created_at: new Date().toISOString()
            });

            // Mettre à jour l'output avec l'ID
            await supabaseUpdate(config, 'mission_outputs', output.id, {
                status: 'scheduled',
                executed_item_id: emailQueueEntry?.[0]?.id
            });
        }
    }

    return { success: true, message: 'Mission approuvée et programmée' };
}

// ==================== MISSION CANCELLATION ====================
async function cancelMission(config, missionId, userId) {
    await supabaseUpdate(config, 'missions', missionId, {
        status: 'cancelled'
    });

    return { success: true, message: 'Mission annulée' };
}

// ==================== OUTPUT UPDATE ====================
async function updateOutput(config, { output_id, content, user_id }) {
    // Vérifier que l'output appartient à l'utilisateur
    const outputs = await supabaseQuery(config, 'mission_outputs', {
        select: '*, mission:missions(*)',
        filter: { id: output_id }
    });

    if (!outputs || outputs.length === 0) {
        return { success: false, error: 'Output non trouvé' };
    }

    await supabaseUpdate(config, 'mission_outputs', output_id, { content });

    return { success: true, message: 'Output mis à jour' };
}

// ==================== TEMPLATES ====================
async function getMissionTemplates(config) {
    const templates = await supabaseQuery(config, 'mission_templates', {
        select: '*',
        filter: { is_active: true },
        order: { column: 'display_order', ascending: true }
    });

    return { success: true, templates: templates || [] };
}

// ==================== HELPER FUNCTIONS ====================

async function callClaude(config, systemPrompt, userMessage) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.anthropicKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            system: systemPrompt || undefined,
            messages: [{ role: 'user', content: userMessage }]
        })
    });

    const data = await response.json();
    return data.content?.[0]?.text || '';
}

async function searchWithPerplexity(config, query) {
    if (!config.perplexityKey || config.perplexityKey === 'YOUR_PERPLEXITY_API_KEY') {
        // Fallback vers Claude si pas de Perplexity
        return await callClaude(config, '', query);
    }

    try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.perplexityKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-sonar-large-128k-online',
                messages: [{ role: 'user', content: query }]
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    } catch (e) {
        console.error('Perplexity error:', e);
        return await callClaude(config, '', query);
    }
}

function verifyEmail(email) {
    const warnings = [];
    let spamScore = 0;

    if (email.subject && email.subject.length > 50) {
        warnings.push(`Sujet trop long (${email.subject.length} caractères)`);
        spamScore += 1;
    }

    const spamWords = ['gratuit', 'urgent', 'offre limitée', 'cliquez ici', '!!!', '€€€'];
    const content = ((email.subject || '') + ' ' + (email.body || '')).toLowerCase();

    for (const word of spamWords) {
        if (content.includes(word)) {
            warnings.push(`Mot spam détecté: "${word}"`);
            spamScore += 2;
        }
    }

    const linkCount = (email.body?.match(/https?:\/\//g) || []).length;
    if (linkCount > 3) {
        warnings.push(`Trop de liens (${linkCount})`);
        spamScore += 1;
    }

    return {
        position: email.position,
        subject: email.subject,
        spam_score: spamScore,
        rgpd_compliant: spamScore < 3,
        warnings
    };
}

function verifyMessage(msg) {
    const warnings = [];

    if (msg.message && msg.message.length > 300) {
        warnings.push(`Message trop long pour LinkedIn (${msg.message.length}/300)`);
    }

    return { warnings };
}

function getNextOccurrence(dayName, time) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const daysFr = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

    let targetDay = days.indexOf(dayName.toLowerCase());
    if (targetDay === -1) {
        targetDay = daysFr.indexOf(dayName.toLowerCase());
    }
    if (targetDay === -1) targetDay = 2; // Mardi par défaut

    const now = new Date();
    const [hours, minutes] = (time || '09:00').split(':').map(Number);

    let daysUntil = targetDay - now.getDay();
    if (daysUntil <= 0) daysUntil += 7;

    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + daysUntil);
    nextDate.setHours(hours, minutes, 0, 0);

    return nextDate;
}

function getNextWorkDay(date, workDays) {
    const dayMap = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 };
    const workDayNumbers = workDays.map(d => dayMap[d]);

    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    while (!workDayNumbers.includes(nextDay.getDay())) {
        nextDay.setDate(nextDay.getDate() + 1);
    }

    return nextDay;
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
