/**
 * Supabase Edge Function: send-sms
 *
 * Thin wrapper around the Twilio SMS API.
 * Called internally by other edge functions (run-escalation, etc.)
 * — NOT intended to be called directly from the client app.
 *
 * Required Supabase secrets (set once per project):
 *   supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   supabase secrets set TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   supabase secrets set TWILIO_FROM_NUMBER=+639XXXXXXXXX
 *
 * Request body:
 *   { "to": "+639XXXXXXXXX", "message": "..." }
 *
 * Response:
 *   200 { "sid": "SMxxx", "status": "queued" }
 *   400 { "error": "Missing to/message" }
 *   500 { "error": "Twilio API error: ..." }
 *
 * Deploy: supabase functions deploy send-sms
 */

const TWILIO_BASE = 'https://api.twilio.com/2010-04-01/Accounts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken  = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      console.error('Missing Twilio credentials. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER via supabase secrets set.');
      return new Response(
        JSON.stringify({ error: 'SMS not configured — set Twilio credentials as Supabase secrets.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json() as { to?: string; message?: string };
    const { to, message } = body;

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Twilio Messages API uses application/x-www-form-urlencoded
    const params = new URLSearchParams();
    params.set('To',   to);
    params.set('From', fromNumber);
    params.set('Body', message);

    const credentials = btoa(`${accountSid}:${authToken}`);
    const twilioRes = await fetch(
      `${TWILIO_BASE}/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type':  'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );

    const twilioData = await twilioRes.json() as { sid?: string; status?: string; message?: string; code?: number };

    if (!twilioRes.ok) {
      console.error('Twilio error:', twilioData);
      return new Response(
        JSON.stringify({ error: `Twilio API error: ${twilioData.message ?? twilioRes.status}`, code: twilioData.code }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`SMS sent to ${to}: SID ${twilioData.sid}`);

    return new Response(
      JSON.stringify({ sid: twilioData.sid, status: twilioData.status }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('send-sms exception:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
