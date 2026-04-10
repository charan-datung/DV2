-- ============================================================
-- Migration 006: Automate escalation and settlement via pg_cron
--
-- Prerequisites:
--   1. Enable the pg_cron extension in Supabase Dashboard:
--      Database > Extensions > pg_cron → Enable
--   2. Enable the pg_net extension (used by pg_cron HTTP calls):
--      Database > Extensions > pg_net → Enable
--   3. Set your project ref and service_role key in the schedule
--      calls below (replace <PROJECT_REF> and <SERVICE_ROLE_KEY>)
--
-- What this does:
--   • Runs run_escalation() every hour at :05 past the hour
--     (Day 3 notify → Day 5 freeze → Day 10 reduce → Day 30 block)
--   • Runs run_settlement_processing() every hour at :15 past the hour
--     (48hr and same_day settlements)
--
-- Run this migration AFTER enabling the extensions above.
-- ============================================================

-- Ensure pg_cron is available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ----------------------------------------------------------
-- Remove any existing schedules (idempotent re-run safety)
-- ----------------------------------------------------------
SELECT cron.unschedule('datung-escalation') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'datung-escalation'
);
SELECT cron.unschedule('datung-settlement') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'datung-settlement'
);

-- ----------------------------------------------------------
-- Schedule 1: Run escalation every hour at HH:05
-- Calls the run_escalation() RPC directly via pg_cron
-- ----------------------------------------------------------
SELECT cron.schedule(
  'datung-escalation',
  '5 * * * *',   -- At minute 5 of every hour
  $$
    SELECT run_escalation();
  $$
);

-- ----------------------------------------------------------
-- Schedule 2: Run settlement processing every hour at HH:15
-- ----------------------------------------------------------
SELECT cron.schedule(
  'datung-settlement',
  '15 * * * *',  -- At minute 15 of every hour
  $$
    SELECT run_settlement_processing();
  $$
);

-- ----------------------------------------------------------
-- Verify schedules were created
-- ----------------------------------------------------------
-- SELECT jobid, jobname, schedule, command, active
--   FROM cron.job
--  WHERE jobname IN ('datung-escalation', 'datung-settlement');

COMMENT ON SCHEMA cron IS
  'pg_cron job definitions. datung-escalation runs at :05/hr, datung-settlement at :15/hr.';
