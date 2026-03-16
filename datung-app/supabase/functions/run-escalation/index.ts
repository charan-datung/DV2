/**
 * Supabase Edge Function: run-escalation
 *
 * Processes overdue transactions through the escalation ladder:
 *   Day 3  → Notify customer
 *   Day 5  → Freeze customer + store accounts
 *   Day 10 → Record 50% credit reduction
 *   Day 30 → Permanent block + mark as defaulted
 *
 * Schedule: Run via pg_cron every hour, or call manually from admin dashboard.
 *
 * Deploy: supabase functions deploy run-escalation
 * Invoke: supabase functions invoke run-escalation
 *
 * Cron setup (in Supabase Dashboard > Database > Extensions > pg_cron):
 *   SELECT cron.schedule(
 *     'escalation-hourly',
 *     '0 * * * *',  -- every hour
 *     $$SELECT run_escalation()$$
 *   );
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the database function that does all the work
    const { data, error } = await supabase.rpc('run_escalation');

    if (error) {
      console.error('Escalation error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('Escalation result:', data);

    return new Response(
      JSON.stringify({ success: true, result: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Escalation exception:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
