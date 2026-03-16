/**
 * Supabase Edge Function: run-settlements
 *
 * Processes approved transactions into settlements:
 *   - 48hr stores: settle after 48 hours from approval
 *   - same_day stores: settle after 6 hours from approval
 *
 * Creates settlement records and moves transactions to 'settled' status.
 *
 * Schedule: Run via pg_cron every hour, or call manually from admin dashboard.
 *
 * Cron setup:
 *   SELECT cron.schedule(
 *     'settlements-hourly',
 *     '0 * * * *',
 *     $$SELECT run_settlement_processing()$$
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
    const { data, error } = await supabase.rpc('run_settlement_processing');

    if (error) {
      console.error('Settlement error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('Settlement result:', data);

    return new Response(
      JSON.stringify({ success: true, result: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Settlement exception:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
