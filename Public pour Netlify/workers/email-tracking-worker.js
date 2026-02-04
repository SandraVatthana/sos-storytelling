/**
 * EMAIL TRACKING WORKER
 * Cloudflare Worker pour le tracking des ouvertures et clics
 *
 * Endpoints :
 * - GET /open/:emailId - Pixel de tracking d'ouverture
 * - GET /click/:emailId/:linkId - Tracking de clic avec redirection
 * - GET /stats/:campaignId - Stats d'une campagne
 */

const SUPABASE_URL = 'https://pyxidmnckpnrargygwnf.supabase.co';

// Pixel transparent 1x1 en base64
const TRACKING_PIXEL = new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
    0x01, 0x00, 0x80, 0x00, 0x00, 0xFF, 0xFF, 0xFF,
    0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
    0x01, 0x00, 0x3B
]);

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // Health check
            if (path === '/health') {
                return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }, corsHeaders);
            }

            // Tracking d'ouverture : /open/:emailId
            if (path.startsWith('/open/')) {
                const emailId = path.replace('/open/', '').replace('.gif', '');
                ctx.waitUntil(trackOpen(env, emailId, request));
                return pixelResponse();
            }

            // Tracking de clic : /click/:emailId?url=...
            if (path.startsWith('/click/')) {
                const emailId = path.replace('/click/', '');
                const targetUrl = url.searchParams.get('url');

                if (!targetUrl) {
                    return new Response('Missing URL', { status: 400 });
                }

                ctx.waitUntil(trackClick(env, emailId, targetUrl, request));
                return Response.redirect(decodeURIComponent(targetUrl), 302);
            }

            // Stats d'une campagne : /stats/:campaignId
            if (path.startsWith('/stats/')) {
                const campaignId = path.replace('/stats/', '');
                const stats = await getCampaignStats(env, campaignId);
                return jsonResponse(stats, corsHeaders);
            }

            // Page d'accueil
            return new Response('Email Tracking Worker - SOS Storytelling', {
                headers: { 'Content-Type': 'text/plain', ...corsHeaders }
            });

        } catch (error) {
            console.error('Tracking error:', error);
            // Toujours retourner le pixel même en cas d'erreur
            if (path.startsWith('/open/')) {
                return pixelResponse();
            }
            return jsonResponse({ error: error.message }, corsHeaders, 500);
        }
    }
};

// ==================== TRACKING OUVERTURE ====================

async function trackOpen(env, emailId, request) {
    if (!emailId || emailId.length < 10) return;

    try {
        const now = new Date().toISOString();
        const userAgent = request.headers.get('user-agent') || '';
        const ip = request.headers.get('cf-connecting-ip') || '';
        const country = request.cf?.country || '';
        const city = request.cf?.city || '';

        // Mettre à jour l'email dans la queue
        const response = await fetch(`${SUPABASE_URL}/rest/v1/email_queue?id=eq.${emailId}`, {
            method: 'PATCH',
            headers: {
                'apikey': env.SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                opened_at: now,
                open_count: 1, // On pourrait incrémenter avec une fonction RPC
                last_open_ip: ip,
                last_open_country: country,
                last_open_city: city,
                last_open_user_agent: userAgent
            })
        });

        if (response.ok) {
            console.log(`[Track] Email ${emailId} ouvert depuis ${country}`);
        }

        // Logger dans une table séparée pour historique détaillé (optionnel)
        await logTrackingEvent(env, {
            email_id: emailId,
            event_type: 'open',
            ip_address: ip,
            user_agent: userAgent,
            country: country,
            city: city,
            created_at: now
        });

    } catch (error) {
        console.error('[Track] Erreur ouverture:', error);
    }
}

// ==================== TRACKING CLIC ====================

async function trackClick(env, emailId, targetUrl, request) {
    if (!emailId || emailId.length < 10) return;

    try {
        const now = new Date().toISOString();
        const ip = request.headers.get('cf-connecting-ip') || '';
        const country = request.cf?.country || '';

        // Mettre à jour l'email dans la queue
        await fetch(`${SUPABASE_URL}/rest/v1/email_queue?id=eq.${emailId}`, {
            method: 'PATCH',
            headers: {
                'apikey': env.SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                clicked_at: now,
                last_click_url: decodeURIComponent(targetUrl)
            })
        });

        console.log(`[Track] Email ${emailId} clic vers ${targetUrl}`);

        // Logger l'événement
        await logTrackingEvent(env, {
            email_id: emailId,
            event_type: 'click',
            ip_address: ip,
            country: country,
            target_url: decodeURIComponent(targetUrl),
            created_at: now
        });

    } catch (error) {
        console.error('[Track] Erreur clic:', error);
    }
}

// ==================== LOGGING ====================

async function logTrackingEvent(env, event) {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/email_tracking_events`, {
            method: 'POST',
            headers: {
                'apikey': env.SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(event)
        });
    } catch (e) {
        // Ignorer les erreurs de logging
    }
}

// ==================== STATS ====================

async function getCampaignStats(env, campaignId) {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/email_queue?campaign_id=eq.${campaignId}&select=status,opened_at,clicked_at,replied_at`,
            {
                headers: {
                    'apikey': env.SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
                }
            }
        );

        const emails = await response.json();

        const stats = {
            total: emails.length,
            sent: emails.filter(e => e.status === 'sent').length,
            opened: emails.filter(e => e.opened_at).length,
            clicked: emails.filter(e => e.clicked_at).length,
            replied: emails.filter(e => e.replied_at).length,
            open_rate: 0,
            click_rate: 0
        };

        if (stats.sent > 0) {
            stats.open_rate = Math.round((stats.opened / stats.sent) * 100);
            stats.click_rate = Math.round((stats.clicked / stats.sent) * 100);
        }

        return stats;

    } catch (error) {
        return { error: error.message };
    }
}

// ==================== HELPERS ====================

function pixelResponse() {
    return new Response(TRACKING_PIXEL, {
        headers: {
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    });
}

function jsonResponse(data, corsHeaders = {}, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
}
