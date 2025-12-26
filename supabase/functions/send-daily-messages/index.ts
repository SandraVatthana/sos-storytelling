// ============================================
// SEND DAILY MESSAGES
// Supabase Edge Function - Cron daily at 7:00 AM
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toISOString().split('T')[0];
    const results = {
      messagesProcessed: 0,
      recipientsSent: 0,
      errors: [] as string[]
    };

    // Recuperer les messages programmes pour aujourd'hui
    const { data: dailyMessages, error: msgError } = await supabase
      .from('daily_messages')
      .select('*, organizations(*), cohorts(*)')
      .eq('scheduled_date', today)
      .eq('status', 'scheduled');

    if (msgError) throw msgError;

    for (const dailyMessage of dailyMessages || []) {
      try {
        // Marquer comme "sending"
        await supabase
          .from('daily_messages')
          .update({ status: 'sending' })
          .eq('id', dailyMessage.id);

        // Recuperer les destinataires de la cohorte
        const { data: recipients } = await supabase
          .from('org_users')
          .select('*')
          .eq('cohort_id', dailyMessage.cohort_id)
          .eq('is_active', true)
          .in('role', dailyMessage.send_to_coaches ? ['client', 'coach'] : ['client']);

        let sentCount = 0;

        for (const recipient of recipients || []) {
          try {
            // Personnaliser le message
            const personalizedContent = await personalizeMessage(
              supabase,
              dailyMessage.template,
              recipient,
              dailyMessage
            );

            // Sauvegarder le message envoye
            await supabase.from('sent_messages').insert({
              daily_message_id: dailyMessage.id,
              recipient_id: recipient.id,
              personalized_content: personalizedContent,
              push_sent: recipient.push_enabled && recipient.push_token ? true : false
            });

            // Envoyer la notification push
            if (recipient.push_enabled && recipient.push_token) {
              await sendPushNotification(
                recipient.push_token,
                {
                  title: dailyMessage.organizations?.app_name || 'Message du jour',
                  body: truncate(personalizedContent, 100),
                  url: `/app-b2b.html?view=client-home`
                }
              );
            }

            sentCount++;
          } catch (recipientError) {
            results.errors.push(`Recipient ${recipient.id}: ${recipientError.message}`);
          }
        }

        // Marquer comme envoye
        await supabase
          .from('daily_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            recipients_count: sentCount
          })
          .eq('id', dailyMessage.id);

        results.messagesProcessed++;
        results.recipientsSent += sentCount;

      } catch (messageError) {
        // Marquer comme echoue
        await supabase
          .from('daily_messages')
          .update({
            status: 'failed',
            error_message: messageError.message
          })
          .eq('id', dailyMessage.id);

        results.errors.push(`Message ${dailyMessage.id}: ${messageError.message}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ==========================================
// PERSONALIZE MESSAGE
// ==========================================
async function personalizeMessage(
  supabase: any,
  template: string,
  user: any,
  dailyMessage: any
): Promise<string> {
  // Recuperer les metriques de l'utilisateur
  const { data: metrics } = await supabase
    .from('client_metrics')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(7);

  const yesterday = metrics?.[0];
  const totalPosts = metrics?.reduce((sum: number, m: any) => sum + (m.posts_published || 0), 0) || 0;

  // Recuperer le dernier contenu cree
  const { data: lastContent } = await supabase
    .from('contents')
    .select('title, type')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Calculer le jour du bootcamp
  const cohortStart = dailyMessage.cohorts?.start_date;
  let dayNumber = user.current_day || 1;
  if (cohortStart) {
    const start = new Date(cohortStart);
    const now = new Date();
    dayNumber = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  // Determiner l'etape actuelle
  const step = getStepName(dayNumber);

  // Generer le feedback personnalise
  const feedback = generateFeedback(yesterday, lastContent);

  // Objectif du jour
  const objective = getObjective(dayNumber);

  // Remplacer les variables
  const variables: Record<string, string> = {
    '{PRENOM}': user.first_name || 'Hey',
    '{JOUR}': String(dayNumber),
    '{ETAPE_ACTUELLE}': step,
    '{ACTION_HIER}': lastContent ? `publie "${lastContent.title}"` : 'prepare ton contenu',
    '{FEEDBACK_PERSONNALISE}': feedback,
    '{OBJECTIF_JOUR}': objective,
    '{NB_POSTS}': String(totalPosts),
    '{TAUX_COMPLETION}': calculateCompletion(user, dayNumber),
  };

  let message = template;
  for (const [key, value] of Object.entries(variables)) {
    message = message.replaceAll(key, value);
  }

  return message;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function getStepName(day: number): string {
  if (day <= 7) return 'Fondations';
  if (day <= 14) return 'Premier contenu';
  if (day <= 30) return 'Rythme de publication';
  if (day <= 60) return 'Croissance';
  return 'Acceleration';
}

function generateFeedback(yesterday: any, lastContent: any): string {
  if (!yesterday && !lastContent) {
    return "Aujourd'hui, on pose les bases !";
  }

  if (yesterday?.posts_published > 0) {
    const views = yesterday.linkedin_views || 0;
    if (views > 1000) {
      return `Ton dernier post a fait ${views} vues ! Continue sur cette lancee !`;
    }
    return 'Bravo pour ta regularite ! Chaque post compte.';
  }

  return 'Pas de post hier ? Pas grave, on reprend aujourd\'hui !';
}

function getObjective(day: number): string {
  const objectives: Record<number, string> = {
    1: 'Configurer ton profil et analyser ta voix',
    2: 'Ecrire ton premier hook',
    3: 'Creer ton post "origine"',
    7: 'Publier ton premier post',
    14: 'Atteindre 3 posts publies',
    30: 'Maintenir 2 posts/semaine',
    60: 'Analyser tes meilleurs posts',
    90: 'Celebrer tes resultats !'
  };

  return objectives[day] || 'Creer du contenu qui te ressemble';
}

function calculateCompletion(user: any, day: number): string {
  const expected = Math.floor(day / 3.5); // ~2 posts/semaine
  const actual = user.posts_count || 0;
  const ratio = expected > 0 ? Math.round((actual / expected) * 100) : 100;
  return `${Math.min(ratio, 100)}%`;
}

function truncate(str: string, length: number): string {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

async function sendPushNotification(
  token: string,
  data: { title: string; body: string; url: string }
): Promise<void> {
  // TODO: Integrer OneSignal ou Firebase
  console.log(`[PUSH] Sending to ${token}:`, data);

  // Exemple avec OneSignal
  // const response = await fetch('https://onesignal.com/api/v1/notifications', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Basic ${Deno.env.get('ONESIGNAL_API_KEY')}`,
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify({
  //     app_id: Deno.env.get('ONESIGNAL_APP_ID'),
  //     include_player_ids: [token],
  //     headings: { en: data.title, fr: data.title },
  //     contents: { en: data.body, fr: data.body },
  //     data: { url: data.url }
  //   })
  // });
}
