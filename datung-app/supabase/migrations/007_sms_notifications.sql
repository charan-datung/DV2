-- ============================================================
-- Migration 007: SMS notification log
--
-- Adds a lightweight audit table so we can see which SMS messages
-- were sent for each escalation event. The run-escalation edge
-- function writes to this table after sending each message.
--
-- Prerequisites: Migration 001 (initial schema) must be applied.
-- ============================================================

-- ----------------------------------------------------------
-- sms_log — audit trail for sent (or attempted) SMS messages
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_log (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- nullable: some messages are sent outside the escalation context
  guarantee_event_id uuid      REFERENCES guarantee_events(id) ON DELETE SET NULL,
  recipient_type  text         NOT NULL CHECK (recipient_type IN ('customer', 'store_owner')),
  phone           text         NOT NULL,
  message         text         NOT NULL,
  -- Twilio SID if send succeeded, NULL if failed
  twilio_sid      text,
  -- 'sent' | 'failed' | 'skipped' (e.g. no phone on file)
  status          text         NOT NULL DEFAULT 'sent'
                               CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message   text,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_sms_log_guarantee_event ON sms_log(guarantee_event_id);
CREATE INDEX idx_sms_log_created_at      ON sms_log(created_at DESC);
CREATE INDEX idx_sms_log_status          ON sms_log(status);

-- RLS
ALTER TABLE sms_log ENABLE ROW LEVEL SECURITY;

-- Only the service role (edge functions) may insert/select.
-- No policy for authenticated users = locked down by default.
-- Admins can read via the Supabase dashboard or service-role client.

COMMENT ON TABLE sms_log IS
  'Audit log for SMS notifications sent via the Twilio integration.
   Written by the run-escalation edge function. Service role only.';

-- ----------------------------------------------------------
-- View: recent_sms_activity
-- Convenient read for admin dashboard / debugging
-- ----------------------------------------------------------
CREATE OR REPLACE VIEW recent_sms_activity AS
SELECT
  s.id,
  s.created_at,
  s.recipient_type,
  s.phone,
  left(s.message, 60) || '…' AS message_preview,
  s.status,
  s.twilio_sid,
  s.error_message,
  ge.event_type,
  t.id AS transaction_id,
  c.name AS customer_name
FROM sms_log s
LEFT JOIN guarantee_events ge ON ge.id = s.guarantee_event_id
LEFT JOIN transactions t ON t.id = ge.transaction_id
LEFT JOIN customers c   ON c.id  = t.customer_id
ORDER BY s.created_at DESC
LIMIT 500;

COMMENT ON VIEW recent_sms_activity IS
  'Last 500 SMS log entries joined with escalation context. Read-only; service role.';
