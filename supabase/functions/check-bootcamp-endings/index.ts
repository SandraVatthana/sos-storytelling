// ============================================
// CHECK BOOTCAMP ENDINGS
// Supabase Edge Function - Cron daily at 8:00 AM
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    const results = {
      j7: 0,
      j3: 0,
      j1: 0,
      j0: 0,
      errors: [] as string[]
    };

    // ==========================================
    // J-7 : 7 jours avant la fin
    // ==========================================
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysDate = sevenDaysFromNow.toISOString().split('T')[0];

    const { data: usersJ7 } = await supabase
      .from('org_users')
      .select('*, organizations(*)')
      .eq('subscription_type', 'bootcamp_included')
      .eq('role', 'client')
      .gte('subscription_ends_at', `${sevenDaysDate}T00:00:00`)
      .lte('subscription_ends_at', `${sevenDaysDate}T23:59:59`);

    for (const user of usersJ7 || []) {
      // Verifier si reminder deja envoye
      const { data: existing } = await supabase
        .from('transition_reminders')
        .select('id')
        .eq('user_id', user.id)
        .eq('reminder_type', 'j-7')
        .single();

      if (!existing) {
        await sendTransitionReminder(supabase, user, 'j-7');
        results.j7++;
      }
    }

    // ==========================================
    // J-3 : 3 jours avant la fin
    // ==========================================
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysDate = threeDaysFromNow.toISOString().split('T')[0];

    const { data: usersJ3 } = await supabase
      .from('org_users')
      .select('*, organizations(*)')
      .eq('subscription_type', 'bootcamp_included')
      .eq('role', 'client')
      .gte('subscription_ends_at', `${threeDaysDate}T00:00:00`)
      .lte('subscription_ends_at', `${threeDaysDate}T23:59:59`);

    for (const user of usersJ3 || []) {
      const { data: existing } = await supabase
        .from('transition_reminders')
        .select('id')
        .eq('user_id', user.id)
        .eq('reminder_type', 'j-3')
        .single();

      if (!existing) {
        await sendTransitionReminder(supabase, user, 'j-3');
        results.j3++;
      }
    }

    // ==========================================
    // J-1 : 1 jour avant la fin
    // ==========================================
    const oneDayFromNow = new Date(now);
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
    const oneDayDate = oneDayFromNow.toISOString().split('T')[0];

    const { data: usersJ1 } = await supabase
      .from('org_users')
      .select('*, organizations(*)')
      .eq('subscription_type', 'bootcamp_included')
      .eq('role', 'client')
      .gte('subscription_ends_at', `${oneDayDate}T00:00:00`)
      .lte('subscription_ends_at', `${oneDayDate}T23:59:59`);

    for (const user of usersJ1 || []) {
      const { data: existing } = await supabase
        .from('transition_reminders')
        .select('id')
        .eq('user_id', user.id)
        .eq('reminder_type', 'j-1')
        .single();

      if (!existing) {
        await sendTransitionReminder(supabase, user, 'j-1');
        results.j1++;
      }
    }

    // ==========================================
    // J0 : Jour de la fin - Desactiver l'acces
    // ==========================================
    const todayDate = now.toISOString().split('T')[0];

    const { data: usersJ0 } = await supabase
      .from('org_users')
      .select('*, organizations(*)')
      .eq('subscription_type', 'bootcamp_included')
      .eq('role', 'client')
      .lte('subscription_ends_at', `${todayDate}T23:59:59`)
      .eq('is_active', true);

    for (const user of usersJ0 || []) {
      // Verifier si deja traite
      const { data: existing } = await supabase
        .from('transition_reminders')
        .select('id')
        .eq('user_id', user.id)
        .eq('reminder_type', 'j0')
        .single();

      if (!existing) {
        // Desactiver l'acces (mais garder le compte)
        await supabase
          .from('org_users')
          .update({
            is_active: false,
            // Garder referred_by pour tracker l'origine
            referred_by: user.organization_id
          })
          .eq('id', user.id);

        await sendTransitionReminder(supabase, user, 'j0');
        results.j0++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        timestamp: now.toISOString()
      }),
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
// SEND TRANSITION REMINDER
// ==========================================
async function sendTransitionReminder(
  supabase: any,
  user: any,
  reminderType: string
) {
  const org = user.organizations;

  // Sauvegarder le reminder
  await supabase.from('transition_reminders').insert({
    user_id: user.id,
    reminder_type: reminderType,
    email_sent: true
  });

  // Recuperer les stats de l'utilisateur
  const { data: metrics } = await supabase
    .from('client_metrics')
    .select('*')
    .eq('user_id', user.id);

  const stats = {
    posts: metrics?.reduce((sum: number, m: any) => sum + (m.posts_published || 0), 0) || 0,
    newsletters: metrics?.reduce((sum: number, m: any) => sum + (m.newsletters_sent || 0), 0) || 0,
    hooks: metrics?.reduce((sum: number, m: any) => sum + (m.hooks_generated || 0), 0) || 0,
    prospects: metrics?.reduce((sum: number, m: any) => sum + (m.prospects_added || 0), 0) || 0
  };

  // Recuperer le code promo de l'org
  const { data: promoCode } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('organization_id', user.organization_id)
    .eq('is_active', true)
    .single();

  // Construire le contenu de l'email
  let emailSubject = '';
  let emailBody = '';

  const daysLeft = reminderType === 'j-7' ? 7 : reminderType === 'j-3' ? 3 : reminderType === 'j-1' ? 1 : 0;

  if (reminderType === 'j0') {
    emailSubject = `${org?.app_name || 'SOS Storytelling'} - Ton acces bootcamp est termine`;
    emailBody = `
Hey ${user.first_name || 'toi'} !

Ton acces bootcamp ${org?.app_name || 'SOS Storytelling'} est maintenant termine.

Pendant ces 90 jours, tu as accompli :
- ${stats.posts} posts crees
- ${stats.newsletters} newsletters envoyees
- ${stats.hooks} hooks generes
- ${stats.prospects} prospects ajoutes

Tu veux continuer a utiliser l'outil ?

Offre speciale alumni : 19€/mois (au lieu de 29€)
${promoCode ? `Code ${promoCode.code} applique automatiquement (-${promoCode.discount_percent}%)` : ''}

Tu gardes :
- Tout ton historique
- Ton style clone
- Tes listes de prospection

Clique ici pour continuer : https://sos-storytelling.netlify.app/transition?user=${user.id}&promo=${promoCode?.code || ''}

A bientot !
L'equipe SOS Storytelling
    `;
  } else {
    emailSubject = `${org?.app_name || 'SOS Storytelling'} - Plus que ${daysLeft} jour${daysLeft > 1 ? 's' : ''} !`;
    emailBody = `
Hey ${user.first_name || 'toi'} !

Ton acces bootcamp ${org?.app_name || 'SOS Storytelling'} se termine dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}.

Tu as deja accompli :
- ${stats.posts} posts crees
- ${stats.newsletters} newsletters envoyees
- ${stats.hooks} hooks generes

Tu veux continuer apres le bootcamp ?

Offre speciale alumni : 19€/mois (au lieu de 29€)
${promoCode ? `Avec le code ${promoCode.code} (-${promoCode.discount_percent}%)` : ''}

Tu gardes tout ton historique et ton style !

Clique ici : https://sos-storytelling.netlify.app/transition?user=${user.id}&promo=${promoCode?.code || ''}

A bientot !
    `;
  }

  // Envoyer l'email via Resend ou autre service
  // Pour l'instant, on log juste
  console.log(`[TRANSITION] ${reminderType} - ${user.email}: ${emailSubject}`);

  // TODO: Integrer Resend ou autre service d'email
  // await sendEmail(user.email, emailSubject, emailBody);

  // Envoyer une notification push si disponible
  if (user.push_token && user.push_enabled) {
    // TODO: Envoyer push notification via OneSignal
    console.log(`[PUSH] ${reminderType} - ${user.id}`);
  }
}
