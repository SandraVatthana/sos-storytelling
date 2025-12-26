// ============================================
// LEMON SQUEEZY WEBHOOK HANDLER
// Supabase Edge Function
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature',
};

// Verify Lemon Squeezy webhook signature
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const expectedSignature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  const expectedHex = Array.from(new Uint8Array(expectedSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === expectedHex;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const signature = req.headers.get('x-signature');
    const payload = await req.text();
    const webhookSecret = Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET');

    // Verify signature in production
    if (webhookSecret && signature) {
      const isValid = await verifySignature(payload, signature, webhookSecret);
      if (!isValid) {
        console.error('Invalid Lemon Squeezy signature');
        return new Response('Invalid signature', { status: 400 });
      }
    }

    const event = JSON.parse(payload);
    const eventName = event.meta?.event_name;
    const customData = event.meta?.custom_data || {};

    console.log(`[LEMONSQUEEZY] Event received: ${eventName}`);

    switch (eventName) {
      // ==========================================
      // SUBSCRIPTION CREATED
      // ==========================================
      case 'subscription_created': {
        const subscription = event.data?.attributes;
        const userId = customData.user_id;

        if (!userId) {
          console.error('No user_id in custom data');
          break;
        }

        // Update user to individual subscription
        const { error: updateError } = await supabase
          .from('org_users')
          .update({
            subscription_type: 'individual',
            lemonsqueezy_customer_id: subscription.customer_id?.toString(),
            lemonsqueezy_subscription_id: event.data?.id?.toString(),
            subscription_status: subscription.status,
            subscription_starts_at: subscription.created_at,
            subscription_ends_at: subscription.ends_at || null,
            current_period_end: subscription.renews_at,
            transitioned_at: new Date().toISOString(),
            is_active: subscription.status === 'active'
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Error updating user:', updateError);
          throw updateError;
        }

        // Log the transition
        await supabase.from('transition_reminders').insert({
          user_id: userId,
          reminder_type: 'converted',
          email_sent: false,
          notes: `Converted via Lemon Squeezy. Promo: ${customData.promo_code || 'none'}`
        });

        // Update promo code usage if applicable
        if (customData.promo_code) {
          await supabase.rpc('increment_promo_usage', { p_code: customData.promo_code });
        }

        console.log(`[LEMONSQUEEZY] User ${userId} subscribed successfully`);
        break;
      }

      // ==========================================
      // SUBSCRIPTION UPDATED
      // ==========================================
      case 'subscription_updated': {
        const subscription = event.data?.attributes;
        const customerId = subscription.customer_id?.toString();

        // Find user by Lemon Squeezy customer ID
        const { data: user } = await supabase
          .from('org_users')
          .select('id')
          .eq('lemonsqueezy_customer_id', customerId)
          .single();

        if (user) {
          await supabase
            .from('org_users')
            .update({
              subscription_status: subscription.status,
              current_period_end: subscription.renews_at,
              is_active: subscription.status === 'active'
            })
            .eq('id', user.id);

          console.log(`[LEMONSQUEEZY] Subscription updated for user ${user.id}`);
        }
        break;
      }

      // ==========================================
      // SUBSCRIPTION CANCELLED
      // ==========================================
      case 'subscription_cancelled': {
        const subscription = event.data?.attributes;
        const customerId = subscription.customer_id?.toString();

        const { data: user } = await supabase
          .from('org_users')
          .select('id')
          .eq('lemonsqueezy_customer_id', customerId)
          .single();

        if (user) {
          await supabase
            .from('org_users')
            .update({
              subscription_status: 'cancelled',
              // Keep active until end of period
              subscription_ends_at: subscription.ends_at || new Date().toISOString()
            })
            .eq('id', user.id);

          // Log the cancellation
          await supabase.from('transition_reminders').insert({
            user_id: user.id,
            reminder_type: 'cancelled',
            email_sent: false
          });

          console.log(`[LEMONSQUEEZY] Subscription cancelled for user ${user.id}`);
        }
        break;
      }

      // ==========================================
      // SUBSCRIPTION EXPIRED
      // ==========================================
      case 'subscription_expired': {
        const subscription = event.data?.attributes;
        const customerId = subscription.customer_id?.toString();

        const { data: user } = await supabase
          .from('org_users')
          .select('id')
          .eq('lemonsqueezy_customer_id', customerId)
          .single();

        if (user) {
          await supabase
            .from('org_users')
            .update({
              subscription_status: 'expired',
              is_active: false
            })
            .eq('id', user.id);

          console.log(`[LEMONSQUEEZY] Subscription expired for user ${user.id}`);
        }
        break;
      }

      // ==========================================
      // SUBSCRIPTION PAYMENT SUCCESS
      // ==========================================
      case 'subscription_payment_success': {
        const subscription = event.data?.attributes;
        const customerId = subscription.customer_id?.toString();

        const { data: user } = await supabase
          .from('org_users')
          .select('id')
          .eq('lemonsqueezy_customer_id', customerId)
          .single();

        if (user) {
          await supabase
            .from('org_users')
            .update({
              subscription_status: 'active',
              is_active: true
            })
            .eq('id', user.id);

          console.log(`[LEMONSQUEEZY] Payment success for user ${user.id}`);
        }
        break;
      }

      // ==========================================
      // SUBSCRIPTION PAYMENT FAILED
      // ==========================================
      case 'subscription_payment_failed': {
        const subscription = event.data?.attributes;
        const customerId = subscription.customer_id?.toString();

        const { data: user } = await supabase
          .from('org_users')
          .select('id, email, first_name')
          .eq('lemonsqueezy_customer_id', customerId)
          .single();

        if (user) {
          await supabase
            .from('org_users')
            .update({
              subscription_status: 'past_due'
            })
            .eq('id', user.id);

          // TODO: Send email notification about failed payment
          console.log(`[LEMONSQUEEZY] Payment failed for user ${user.id} (${user.email})`);
        }
        break;
      }

      // ==========================================
      // ORDER CREATED (one-time purchase)
      // ==========================================
      case 'order_created': {
        const order = event.data?.attributes;
        const customData = event.meta?.custom_data || {};
        const userId = customData.user_id;

        if (userId && order.status === 'paid') {
          // Could be used for one-time purchases or lifetime deals
          console.log(`[LEMONSQUEEZY] Order created for user ${userId}`);
        }
        break;
      }

      default:
        console.log(`[LEMONSQUEEZY] Unhandled event type: ${eventName}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
