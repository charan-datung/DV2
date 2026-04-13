/**
 * Supabase Edge Function: run-escalation
 *
 * Processes overdue transactions through the escalation ladder:
 *   Day 3  → Notify customer via SMS
 *   Day 5  → Freeze customer + store accounts, SMS both
 *   Day 10 → Record 50% credit reduction, SMS customer
 *   Day 30 → Permanent block + mark as defaulted, SMS customer
 *
 * SMS notifications require Twilio credentials set as Supabase secrets:
 *   supabase secrets set TWILIO_ACCOUNT_SID=ACxxx
 *   supabase secrets set TWILIO_AUTH_TOKEN=xxx
 *   supabase secrets set TWILIO_FROM_NUMBER=+639XXXXXXXXX
 *
 * If credentials are missing, escalation still runs — SMS is best-effort.
 *
 * Schedule: Runs via pg_cron every hour at :05.
 * Deploy: supabase functions deploy run-escalation
 * Manual test: supabase functions invoke run-escalation
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// -----------------------------------------------------------------------
// SMS message templates (Taglish — Philippine market)
// -----------------------------------------------------------------------
const CUSTOMER_SMS: Record<string, (amount: string) => string> = {
  day3_notify: (amount) =>
    `Kumusta! Mayroon kang overdue na bayad sa Datung na P${amount}. Mangyaring bayaran na agad para maiwasan ang pagkakatanggal ng iyong account. -Datung`,
  day5_freeze: (amount) =>
    `BABALA: Na-freeze ang iyong Datung account dahil sa overdue na P${amount}. Bayaran agad para ma-unfreeze ang iyong account. -Datung`,
  day10_reduce: (amount) =>
    `Abiso mula sa Datung: Nabawasan ang iyong credit limit dahil sa hindi pa nabayarang P${amount}. Makipag-ugnayan sa Datung support. -Datung`,
  day30_permanent: (_amount) =>
    `Ang iyong Datung account ay permanenteng na-block dahil sa default. Para sa tulong, makipag-ugnayan sa Datung support. -Datung`,
};

const STORE_SMS: Record<string, (customerName: string, amount: string) => string> = {
  day5_freeze: (customerName, amount) =>
    `BABALA: Na-freeze ang inyong tindahan sa Datung dahil sa customer na may overdue na P${amount} (${customerName}). Makipag-ugnayan sa Datung support. -Datung`,
};

// -----------------------------------------------------------------------
// Send a single SMS via the send-sms edge function (best-effort)
// Returns { ok, sid, error }
// -----------------------------------------------------------------------
async function sendSms(
  supabaseUrl: string,
  serviceRoleKey: string,
  to: string,
  message: string,
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey':        serviceRoleKey,
      },
      body: JSON.stringify({ to, message }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`SMS to ${to} failed (${res.status}): ${body}`);
      return { ok: false, error: `HTTP ${res.status}: ${body}` };
    }
    const data = await res.json() as { sid?: string; error?: string };
    if (data.error) {
      console.warn(`SMS to ${to} not delivered: ${data.error}`);
      return { ok: false, error: data.error };
    }
    console.log(`SMS sent to ${to}: SID ${data.sid}`);
    return { ok: true, sid: data.sid };
  } catch (e) {
    console.warn(`SMS to ${to} exception:`, e);
    return { ok: false, error: String(e) };
  }
}

// Format centavos as "X,XXX.XX" for SMS body
function fmtAmount(centavos: number): string {
  return (centavos / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// -----------------------------------------------------------------------
// Main handler
// -----------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ---- 1. Run the escalation DB function ----
    const { data: escalationResult, error: escalationError } = await supabase.rpc('run_escalation');

    if (escalationError) {
      console.error('Escalation RPC error:', escalationError);
      return new Response(
        JSON.stringify({ error: escalationError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('Escalation result:', escalationResult);

    // ---- 2. Query guarantee_events created in the last 2 hours ----
    //    ON CONFLICT DO NOTHING means each event is inserted exactly once,
    //    so events from the past 2h are "new" for notification purposes.
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: newEvents, error: eventsError } = await supabase
      .from('guarantee_events')
      .select(`
        id,
        event_type,
        store_id,
        transactions!inner (
          amount_centavos,
          customer_id,
          customers!inner (
            phone,
            name
          )
        ),
        stores!inner (
          name,
          owner_id
        )
      `)
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (eventsError) {
      console.error('Failed to fetch new guarantee_events:', eventsError);
      // Escalation succeeded; SMS is best-effort — return success with warning
      return new Response(
        JSON.stringify({
          success: true,
          result: escalationResult,
          sms: { sent: 0, failed: 0, error: eventsError.message },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let smsSent   = 0;
    let smsFailed = 0;

    if (newEvents && newEvents.length > 0) {
      // Prefetch store owner phone numbers (auth.admin API, service role only)
      const ownerIds = [...new Set(
        (newEvents as Array<{ stores: { owner_id: string } }>)
          .map(e => e.stores.owner_id)
          .filter(Boolean),
      )];

      const ownerPhones: Record<string, string> = {};
      for (const ownerId of ownerIds) {
        try {
          const { data: { user } } = await supabase.auth.admin.getUserById(ownerId);
          if (user?.phone) ownerPhones[ownerId] = user.phone;
        } catch (_) { /* best-effort */ }
      }

      // ---- 3. Send SMS for each escalation event ----
      for (const event of newEvents as Array<{
        id: string;
        event_type: string;
        store_id: string;
        transactions: { amount_centavos: number; customers: { phone: string; name: string } };
        stores: { name: string; owner_id: string };
      }>) {
        const { id: eventId, event_type, stores: store } = event;
        const { amount_centavos, customers: customer } = event.transactions;
        const amount = fmtAmount(amount_centavos);

        // Customer SMS
        const customerTpl = CUSTOMER_SMS[event_type];
        if (customerTpl && customer?.phone) {
          const { ok, sid, error } = await sendSms(supabaseUrl, serviceRoleKey, customer.phone, customerTpl(amount));
          ok ? smsSent++ : smsFailed++;
          // Write to audit log (best-effort, ignore errors)
          await supabase.from('sms_log').insert({
            guarantee_event_id: eventId,
            recipient_type: 'customer',
            phone: customer.phone,
            message: customerTpl(amount),
            twilio_sid: sid ?? null,
            status: ok ? 'sent' : 'failed',
            error_message: error ?? null,
          }).then(({ error: e }) => { if (e) console.warn('sms_log insert failed:', e.message); });
        }

        // Store owner SMS (Day 5 freeze only)
        const storeTpl = STORE_SMS[event_type];
        if (storeTpl && store?.owner_id) {
          const ownerPhone = ownerPhones[store.owner_id];
          if (ownerPhone) {
            const smsBody = storeTpl(customer?.name ?? 'Customer', amount);
            const { ok, sid, error } = await sendSms(supabaseUrl, serviceRoleKey, ownerPhone, smsBody);
            ok ? smsSent++ : smsFailed++;
            await supabase.from('sms_log').insert({
              guarantee_event_id: eventId,
              recipient_type: 'store_owner',
              phone: ownerPhone,
              message: smsBody,
              twilio_sid: sid ?? null,
              status: ok ? 'sent' : 'failed',
              error_message: error ?? null,
            }).then(({ error: e }) => { if (e) console.warn('sms_log insert failed:', e.message); });
          }
        }
      }
    }

    console.log(`SMS: ${smsSent} sent, ${smsFailed} failed (${newEvents?.length ?? 0} events)`);

    return new Response(
      JSON.stringify({
        success: true,
        result: escalationResult,
        sms: {
          events: newEvents?.length ?? 0,
          sent: smsSent,
          failed: smsFailed,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('run-escalation exception:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
