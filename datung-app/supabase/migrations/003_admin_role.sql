-- ============================================================
-- Datung MVP - Admin Role & Backend Automation
-- Migration: 003_admin_role.sql
--
-- Adds:
--   1. admins table + RLS
--   2. Admin RLS policies for cross-table reads
--   3. Escalation automation function (called by cron)
--   4. Settlement automation function (called by cron)
--   5. Notification log table
-- ============================================================


-- ============================================================
-- ADMIN TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS admins (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid          NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  role        text          NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  name        text          NOT NULL,
  email       text,
  created_at  timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (user_id)
);

CREATE INDEX idx_admins_user_id ON admins(user_id);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Admins can read their own record
CREATE POLICY "admins: can select own"
  ON admins FOR SELECT
  USING (user_id = auth.uid());


-- ============================================================
-- NOTIFICATION LOG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_log (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type  text          NOT NULL CHECK (recipient_type IN ('customer', 'store', 'admin')),
  recipient_id    uuid          NOT NULL,
  channel         text          NOT NULL CHECK (channel IN ('sms', 'push', 'in_app')),
  event_type      text          NOT NULL,
  title           text          NOT NULL,
  body            text          NOT NULL,
  status          text          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at         timestamptz,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_log_recipient  ON notification_log(recipient_type, recipient_id);
CREATE INDEX idx_notification_log_status     ON notification_log(status);
CREATE INDEX idx_notification_log_created_at ON notification_log(created_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- HELPER: check if the current user is an admin
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;


-- ============================================================
-- ADMIN RLS POLICIES — read all data
-- ============================================================

-- Stores: admin can read all stores
CREATE POLICY "stores: admin can select all"
  ON stores FOR SELECT
  USING (is_admin());

-- Stores: super_admin can update any store
CREATE POLICY "stores: super_admin can update all"
  ON stores FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Customers: admin can read all customers
CREATE POLICY "customers: admin can select all"
  ON customers FOR SELECT
  USING (is_admin());

-- Customers: super_admin can update any customer
CREATE POLICY "customers: super_admin can update all"
  ON customers FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Transactions: admin can read all
CREATE POLICY "transactions: admin can select all"
  ON transactions FOR SELECT
  USING (is_admin());

-- Transactions: super_admin can update any
CREATE POLICY "transactions: super_admin can update all"
  ON transactions FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Store interviews: admin can read all
CREATE POLICY "store_interviews: admin can select all"
  ON store_interviews FOR SELECT
  USING (is_admin());

-- Repayments: admin can read all
CREATE POLICY "repayments: admin can select all"
  ON repayments FOR SELECT
  USING (is_admin());

-- Guarantee events: admin can read all, super_admin can insert
CREATE POLICY "guarantee_events: admin can select all"
  ON guarantee_events FOR SELECT
  USING (is_admin());

CREATE POLICY "guarantee_events: super_admin can insert"
  ON guarantee_events FOR INSERT
  WITH CHECK (is_super_admin());

-- Settlements: admin can read all
CREATE POLICY "settlements: admin can select all"
  ON settlements FOR SELECT
  USING (is_admin());

-- Settlements: super_admin can insert/update
CREATE POLICY "settlements: super_admin can insert"
  ON settlements FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "settlements: super_admin can update"
  ON settlements FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Notification log: admin can read all
CREATE POLICY "notification_log: admin can select all"
  ON notification_log FOR SELECT
  USING (is_admin());

CREATE POLICY "notification_log: admin can insert"
  ON notification_log FOR INSERT
  WITH CHECK (is_admin());

-- Admins: admin can read all admins
CREATE POLICY "admins: admin can select all"
  ON admins FOR SELECT
  USING (is_admin());


-- ============================================================
-- REALTIME for new tables
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE notification_log;


-- ============================================================
-- ESCALATION FUNCTION
-- Called by pg_cron or Supabase Edge Function on a schedule.
-- Processes all overdue transactions and creates guarantee_events.
-- ============================================================

CREATE OR REPLACE FUNCTION run_escalation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_txn     RECORD;
  v_days    integer;
  v_half    integer;
  v_count   integer := 0;
  v_results jsonb := '[]'::jsonb;
BEGIN
  -- Find all non-terminal overdue transactions
  FOR v_txn IN
    SELECT
      t.id,
      t.store_id,
      t.customer_id,
      t.amount_centavos,
      t.due_date,
      t.status,
      (CURRENT_DATE - t.due_date) AS days_overdue
    FROM transactions t
    WHERE t.status IN ('approved', 'settled')
      AND t.due_date < CURRENT_DATE
    ORDER BY t.due_date ASC
  LOOP
    v_days := v_txn.days_overdue;
    v_half := v_txn.amount_centavos / 2;

    -- Day 3: Notify
    IF v_days >= 3 THEN
      INSERT INTO guarantee_events (transaction_id, store_id, event_type, store_share_centavos, datung_share_centavos)
      VALUES (v_txn.id, v_txn.store_id, 'day3_notify', 0, 0)
      ON CONFLICT (transaction_id, event_type) DO NOTHING;
    END IF;

    -- Day 5: Freeze customer + store
    IF v_days >= 5 THEN
      INSERT INTO guarantee_events (transaction_id, store_id, event_type, store_share_centavos, datung_share_centavos)
      VALUES (v_txn.id, v_txn.store_id, 'day5_freeze', v_half, v_half)
      ON CONFLICT (transaction_id, event_type) DO NOTHING;

      -- Freeze the customer
      UPDATE customers SET status = 'frozen'
      WHERE id = v_txn.customer_id AND status = 'active';

      -- Freeze the store
      UPDATE stores SET status = 'frozen'
      WHERE id = v_txn.store_id AND status = 'active';
    END IF;

    -- Day 10: Reduce credit 50%
    IF v_days >= 10 THEN
      INSERT INTO guarantee_events (transaction_id, store_id, event_type, store_share_centavos, datung_share_centavos)
      VALUES (v_txn.id, v_txn.store_id, 'day10_reduce', v_half, v_half)
      ON CONFLICT (transaction_id, event_type) DO NOTHING;
    END IF;

    -- Day 30: Permanent block + mark defaulted
    IF v_days >= 30 THEN
      INSERT INTO guarantee_events (transaction_id, store_id, event_type, store_share_centavos, datung_share_centavos)
      VALUES (v_txn.id, v_txn.store_id, 'day30_permanent', v_half, v_half)
      ON CONFLICT (transaction_id, event_type) DO NOTHING;

      -- Mark transaction as defaulted
      UPDATE transactions SET status = 'defaulted'
      WHERE id = v_txn.id AND status IN ('approved', 'settled');

      -- Block the customer
      UPDATE customers SET status = 'blocked'
      WHERE id = v_txn.customer_id;

      -- Increment recent_default_count
      UPDATE customers SET recent_default_count = recent_default_count + 1
      WHERE id = v_txn.customer_id;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('processed', v_count, 'timestamp', now());
END;
$$;

COMMENT ON FUNCTION run_escalation() IS
  'Processes overdue transactions through the escalation ladder (Day 3/5/10/30). Called by cron.';


-- ============================================================
-- SETTLEMENT AUTOMATION FUNCTION
-- Creates settlement records for approved transactions.
-- Called by cron to auto-settle after 48 hours (or same-day).
-- ============================================================

CREATE OR REPLACE FUNCTION run_settlement_processing()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_txn   RECORD;
  v_count integer := 0;
BEGIN
  -- Find approved transactions that need settlement
  FOR v_txn IN
    SELECT
      t.id,
      t.store_id,
      t.amount_centavos,
      t.approved_at,
      s.settlement_type
    FROM transactions t
    JOIN stores s ON s.id = t.store_id
    WHERE t.status = 'approved'
      AND t.approved_at IS NOT NULL
      AND (
        -- 48hr stores: settle after 48 hours
        (s.settlement_type = '48hr' AND t.approved_at < now() - interval '48 hours')
        OR
        -- same_day stores: settle after end of day (6 hours grace)
        (s.settlement_type = 'same_day' AND t.approved_at < now() - interval '6 hours')
      )
      -- Don't create duplicate settlements
      AND NOT EXISTS (
        SELECT 1 FROM settlements st
        WHERE st.store_id = t.store_id
          AND st.amount_centavos = t.amount_centavos
          AND st.created_at > t.approved_at
      )
  LOOP
    -- Create pending settlement
    INSERT INTO settlements (store_id, amount_centavos, status)
    VALUES (v_txn.store_id, v_txn.amount_centavos, 'pending');

    -- Move transaction to settled
    UPDATE transactions
    SET status = 'settled', settled_at = now()
    WHERE id = v_txn.id AND status = 'approved';

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('settled', v_count, 'timestamp', now());
END;
$$;

COMMENT ON FUNCTION run_settlement_processing() IS
  'Creates settlement records for approved transactions that have passed their settlement window. Called by cron.';


-- ============================================================
-- ADMIN KPI VIEW (materialized for performance)
-- ============================================================

CREATE OR REPLACE VIEW admin_kpi_summary AS
SELECT
  (SELECT COUNT(*) FROM stores)::integer                                            AS total_stores,
  (SELECT COUNT(*) FROM stores WHERE status = 'active')::integer                    AS active_stores,
  (SELECT COUNT(*) FROM stores WHERE status = 'frozen')::integer                    AS frozen_stores,
  (SELECT COUNT(*) FROM customers)::integer                                         AS total_customers,
  (SELECT COUNT(*) FROM customers WHERE status = 'active')::integer                 AS active_customers,
  (SELECT COUNT(*) FROM customers WHERE status = 'blocked')::integer                AS blocked_customers,
  (SELECT COUNT(*) FROM customers WHERE status = 'frozen')::integer                 AS frozen_customers,
  (SELECT COUNT(*) FROM transactions)::integer                                      AS total_transactions,
  (SELECT COUNT(*) FROM transactions WHERE status = 'pending')::integer             AS pending_transactions,
  (SELECT COUNT(*) FROM transactions WHERE status IN ('approved', 'settled'))::integer AS active_transactions,
  (SELECT COUNT(*) FROM transactions WHERE status = 'repaid')::integer              AS repaid_transactions,
  (SELECT COUNT(*) FROM transactions WHERE status = 'defaulted')::integer           AS defaulted_transactions,
  (SELECT COALESCE(SUM(amount_centavos), 0) FROM transactions WHERE status IN ('approved', 'settled'))::bigint AS total_outstanding_centavos,
  (SELECT COALESCE(SUM(amount_centavos), 0) FROM transactions WHERE status = 'repaid')::bigint  AS total_repaid_centavos,
  (SELECT COALESCE(SUM(amount_centavos), 0) FROM transactions WHERE status = 'defaulted')::bigint AS total_defaulted_centavos,
  (SELECT COALESCE(SUM(interest_centavos), 0) FROM transactions WHERE status = 'repaid')::bigint  AS total_interest_earned_centavos,
  (SELECT COALESCE(SUM(amount_centavos), 0) FROM settlements WHERE status = 'pending')::bigint    AS pending_settlement_centavos,
  (SELECT COALESCE(SUM(amount_centavos), 0) FROM settlements WHERE status = 'completed')::bigint  AS completed_settlement_centavos,
  (SELECT COUNT(*) FROM transactions WHERE status IN ('approved', 'settled') AND due_date < CURRENT_DATE)::integer AS overdue_count;


-- ============================================================
-- SEED: default super_admin (placeholder — update user_id after creating user)
-- ============================================================

-- INSERT INTO admins (user_id, role, name, email)
-- VALUES ('00000000-0000-0000-0000-000000000099', 'super_admin', 'Datung Admin', 'admin@datung.ph')
-- ON CONFLICT (user_id) DO NOTHING;
