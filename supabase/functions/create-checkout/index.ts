// ============================================
// CREATE CHECKOUT SESSION - LEMON SQUEEZY
// Supabase Edge Function
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LEMONSQUEEZY_API_KEY = Deno.env.get('LEMONSQUEEZY_API_KEY');
const LEMONSQUEEZY_STORE_ID = Deno.env.get('LEMONSQUEEZY_STORE_ID');
const LEMONSQUEEZY_VARIANT_ID = Deno.env.get('LEMONSQUEEZY_VARIANT_ID'); // Product variant for subscription

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { user_id, promo_code, success_url, cancel_url } = await req.json();

    if (!user_id) {
      throw new Error('user_id is required');
    }

    // Get user info
    const { data: user, error: userError } = await supabase
      .from('org_users')
      .select('*, organizations(*)')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      throw new Error('User not found');
    }

    // Check promo code for discount
    let discountCode = null;
    if (promo_code) {
      const { data: promo } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', promo_code.toUpperCase())
        .eq('is_active', true)
        .single();

      if (promo) {
        // Use the Lemon Squeezy discount code if configured
        discountCode = promo.lemonsqueezy_discount_code || promo_code;
      }
    }

    // Create Lemon Squeezy checkout
    const checkoutData: any = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: user.email,
            name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            custom: {
              user_id: user.id,
              organization_id: user.organization_id,
              promo_code: promo_code || ''
            }
          },
          product_options: {
            redirect_url: success_url || 'https://sos-storytelling.netlify.app/transition.html?success=true',
            receipt_button_text: 'Acceder a l\'app',
            receipt_thank_you_note: 'Merci pour ton abonnement ! Tu peux maintenant continuer a utiliser SOS Storytelling.'
          }
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: LEMONSQUEEZY_STORE_ID
            }
          },
          variant: {
            data: {
              type: 'variants',
              id: LEMONSQUEEZY_VARIANT_ID
            }
          }
        }
      }
    };

    // Add discount code if available
    if (discountCode) {
      checkoutData.data.attributes.checkout_data.discount_code = discountCode;
    }

    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LEMONSQUEEZY_API_KEY}`,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json'
      },
      body: JSON.stringify(checkoutData)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Lemon Squeezy error:', result);
      throw new Error(result.errors?.[0]?.detail || 'Checkout creation failed');
    }

    const checkoutUrl = result.data?.attributes?.url;

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: checkoutUrl,
        checkout_id: result.data?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
