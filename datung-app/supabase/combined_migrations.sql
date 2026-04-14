-- ============================================================
-- Datung MVP - Initial Schema
-- Migration: 001_initial_schema.sql
--
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ============================================================


-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE transaction_status AS ENUM (
  'pending',
  'approved',
  'settled',
  'repaid',
  'defaulted'
);

CREATE TYPE settlement_type AS ENUM (
  '48hr',
  'same_day'
);

CREATE TYPE trust_reason AS ENUM (
  'neighbor_5yr',
  'regular_suki',
  'known_family',
  'referred_by_customer',
  'work_colleague',
  'other'
);

CREATE TYPE repayment_method AS ENUM (
  'gcash',
  'otc'
);

CREATE TYPE guarantee_event_type AS ENUM (
  'day3_notify',
  'day5_freeze',
  'day10_reduce',
  'day30_permanent'
);

-- customer_level stored as smallint (0-4) constrained via CHECK,
-- declared as a domain so it is self-documenting and reusable.
CREATE DOMAIN customer_level AS smallint
  CHECK (VALUE >= 0 AND VALUE <= 4);

-- store / customer status
CREATE TYPE entity_status AS ENUM (
  'active',
  'frozen',
  'suspended',
  'blocked'
);

CREATE TYPE settlement_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);


-- ============================================================
-- TABLES
-- ============================================================

-- ----------------------------------------------------------
-- stores
-- ----------------------------------------------------------
CREATE TABLE stores (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid          NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name              text          NOT NULL,
  address           text          NOT NULL,
  barangay          text          NOT NULL,
  -- credit amounts in centavos
  credit_line       integer       NOT NULL DEFAULT 0 CHECK (credit_line >= 0),
  available_balance integer       NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  settlement_type   settlement_type NOT NULL DEFAULT '48hr',
  status            entity_status NOT NULL DEFAULT 'active',
  -- tier: 1 = basic, 2 = silver, 3 = gold (for future use)
  tier              smallint      NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 3),
  created_at        timestamptz   NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- customers
-- ----------------------------------------------------------
CREATE TABLE customers (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid            NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  phone           text            NOT NULL UNIQUE,
  name            text            NOT NULL,
  selfie_url      text,
  id_photo_url    text,
  datung_score    integer         NOT NULL DEFAULT 0 CHECK (datung_score >= 0),
  level           customer_level  NOT NULL DEFAULT 0,
  status          entity_status   NOT NULL DEFAULT 'active',
  -- track on-time repayments for level upgrades
  on_time_repayment_count  integer NOT NULL DEFAULT 0 CHECK (on_time_repayment_count >= 0),
  -- track defaults in rolling 60-day window (enforced in app logic)
  recent_default_count     integer NOT NULL DEFAULT 0 CHECK (recent_default_count >= 0),
  created_at      timestamptz     NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- transactions
-- ----------------------------------------------------------
CREATE TABLE transactions (
  id                uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid               NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  customer_id       uuid               NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount_centavos   integer            NOT NULL CHECK (amount_centavos > 0),
  interest_centavos integer            NOT NULL DEFAULT 0 CHECK (interest_centavos >= 0),
  status            transaction_status NOT NULL DEFAULT 'pending',
  due_date          date               NOT NULL,
  approved_at       timestamptz,
  settled_at        timestamptz,
  repaid_at         timestamptz,
  created_at        timestamptz        NOT NULL DEFAULT now(),

  -- basic consistency: settled/repaid timestamps only when status warrants
  CONSTRAINT chk_approved_at  CHECK (approved_at  IS NULL OR status IN ('approved','settled','repaid','defaulted')),
  CONSTRAINT chk_settled_at   CHECK (settled_at   IS NULL OR status IN ('settled','repaid','defaulted')),
  CONSTRAINT chk_repaid_at    CHECK (repaid_at    IS NULL OR status = 'repaid')
);

-- ----------------------------------------------------------
-- store_interviews  (store owner vouches for customer)
-- ----------------------------------------------------------
CREATE TABLE store_interviews (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid         NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  store_id      uuid          NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  customer_id   uuid          NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  trust_reason  trust_reason  NOT NULL,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- repayments
-- ----------------------------------------------------------
CREATE TABLE repayments (
  id                  uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id      uuid              NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  amount_centavos     integer           NOT NULL CHECK (amount_centavos > 0),
  method              repayment_method  NOT NULL,
  -- GCash reference number or OTC receipt number
  reference_no        text,
  created_at          timestamptz       NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- guarantee_events  (escalation ladder tracking)
-- ----------------------------------------------------------
CREATE TABLE guarantee_events (
  id                    uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id        uuid                  NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  store_id              uuid                  NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  event_type            guarantee_event_type  NOT NULL,
  store_share_centavos  integer               NOT NULL DEFAULT 0 CHECK (store_share_centavos >= 0),
  datung_share_centavos integer               NOT NULL DEFAULT 0 CHECK (datung_share_centavos >= 0),
  created_at            timestamptz           NOT NULL DEFAULT now(),

  -- each escalation step fires once per transaction
  UNIQUE (transaction_id, event_type)
);

-- ----------------------------------------------------------
-- settlements  (Datung pays store for approved transactions)
-- ----------------------------------------------------------
CREATE TABLE settlements (
  id              uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid               NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  amount_centavos integer            NOT NULL CHECK (amount_centavos > 0),
  status          settlement_status  NOT NULL DEFAULT 'pending',
  settled_at      timestamptz,
  created_at      timestamptz        NOT NULL DEFAULT now(),

  CONSTRAINT chk_settled_at CHECK (settled_at IS NULL OR status IN ('completed','failed'))
);


-- ============================================================
-- INDEXES
-- ============================================================

-- transactions - required indexes
CREATE INDEX idx_transactions_store_id   ON transactions(store_id);
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX idx_transactions_status     ON transactions(status);
CREATE INDEX idx_transactions_due_date   ON transactions(due_date);

-- additional useful indexes
CREATE INDEX idx_transactions_created_at        ON transactions(created_at DESC);
CREATE INDEX idx_repayments_transaction_id      ON repayments(transaction_id);
CREATE INDEX idx_guarantee_events_transaction_id ON guarantee_events(transaction_id);
CREATE INDEX idx_guarantee_events_store_id      ON guarantee_events(store_id);
CREATE INDEX idx_settlements_store_id           ON settlements(store_id);
CREATE INDEX idx_settlements_status             ON settlements(status);
CREATE INDEX idx_store_interviews_store_id      ON store_interviews(store_id);
CREATE INDEX idx_store_interviews_customer_id   ON store_interviews(customer_id);
CREATE INDEX idx_customers_user_id             ON customers(user_id);
CREATE INDEX idx_stores_owner_id               ON stores(owner_id);

-- partial index: overdue transactions for the escalation cron
CREATE INDEX idx_transactions_overdue ON transactions(due_date, status)
  WHERE status IN ('approved', 'settled');


-- ============================================================
-- FUNCTIONS
-- ============================================================

-- ----------------------------------------------------------
-- calculate_interest(amount_centavos, days)
-- Returns prorated 6% monthly interest (integer centavos, rounded up).
--
-- Formula: amount × 0.06 × (days / 30)
-- We multiply before dividing to stay in integer arithmetic.
-- CEILING ensures we never under-charge by rounding fractions down.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_interest(
  p_amount_centavos integer,
  p_days            integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CEILING(p_amount_centavos::numeric * 0.06 * p_days / 30)::integer;
$$;

COMMENT ON FUNCTION calculate_interest(integer, integer) IS
  'Returns prorated 6%/month interest in centavos (rounded up). Args: amount in centavos, loan term in days.';


-- ----------------------------------------------------------
-- get_customer_max_transaction(customer_level)
-- Returns the maximum transaction amount in centavos for a given level.
--
-- Level 0:  50_000 centavos (₱500,  3 days)
-- Level 1:  50_000 centavos (₱500,  5 days)
-- Level 2: 200_000 centavos (₱2000, 14 days)
-- Level 3: 500_000 centavos (₱5000, 30 days)
-- Level 4: 1_000_000 centavos (₱10000, 90 days)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_customer_max_transaction(
  p_level customer_level
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE p_level
    WHEN 0 THEN    50000
    WHEN 1 THEN    50000
    WHEN 2 THEN   200000
    WHEN 3 THEN   500000
    WHEN 4 THEN  1000000
  END;
$$;

COMMENT ON FUNCTION get_customer_max_transaction(customer_level) IS
  'Returns max transaction amount in centavos for a customer level (0-4).';


-- ----------------------------------------------------------
-- get_customer_term_days(customer_level)
-- Returns the loan term in days for a given customer level.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_customer_term_days(
  p_level customer_level
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE p_level
    WHEN 0 THEN  3
    WHEN 1 THEN  5
    WHEN 2 THEN 14
    WHEN 3 THEN 30
    WHEN 4 THEN 90
  END;
$$;

COMMENT ON FUNCTION get_customer_term_days(customer_level) IS
  'Returns loan term in days for a customer level (0-4).';


-- ============================================================
-- TRIGGERS
-- ============================================================

-- ----------------------------------------------------------
-- Trigger: auto-update store available_balance
--
-- Rules:
--   INSERT pending  → no change (not yet approved)
--   pending → approved   → deduct amount_centavos from available_balance
--   approved → settled   → no change (Datung has already reserved the funds)
--   settled → repaid     → restore amount_centavos to available_balance
--   any → defaulted      → restore amount_centavos (store absorbs 50% via guarantee_events)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_update_store_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ---- INSERT: new transaction (always starts as 'pending') ----
  IF TG_OP = 'INSERT' THEN
    -- Nothing to do until the store owner approves.
    RETURN NEW;
  END IF;

  -- ---- UPDATE: status transition ----
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN

    -- pending → approved: reserve funds (deduct from available_balance)
    IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
      UPDATE stores
        SET available_balance = available_balance - NEW.amount_centavos
      WHERE id = NEW.store_id;

      -- Guard against overdraft (should be caught in app layer too)
      IF (SELECT available_balance FROM stores WHERE id = NEW.store_id) < 0 THEN
        RAISE EXCEPTION 'Insufficient store available_balance for store %', NEW.store_id;
      END IF;

    -- settled → repaid: customer paid back → restore store balance
    ELSIF OLD.status = 'settled' AND NEW.status = 'repaid' THEN
      UPDATE stores
        SET available_balance = available_balance + NEW.amount_centavos
      WHERE id = NEW.store_id;

    -- any active status → defaulted: release the reserved amount back
    -- (the 50/50 guarantee deduction is recorded separately in guarantee_events)
    ELSIF NEW.status = 'defaulted'
          AND OLD.status IN ('pending', 'approved', 'settled') THEN
      -- Only restore if the balance was actually deducted (i.e. was approved)
      IF OLD.status IN ('approved', 'settled') THEN
        UPDATE stores
          SET available_balance = available_balance + NEW.amount_centavos
        WHERE id = NEW.store_id;
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transactions_store_balance
  AFTER INSERT OR UPDATE OF status
  ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION trg_update_store_balance();

COMMENT ON FUNCTION trg_update_store_balance() IS
  'Keeps stores.available_balance in sync as transactions move through their lifecycle.';


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on every table (no exceptions per architecture rules)
ALTER TABLE stores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE repayments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE guarantee_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements      ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------
-- Helper: is the current user the owner of a given store?
-- Used inline in policies to keep them readable.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION is_store_owner(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM stores
    WHERE id = p_store_id
      AND owner_id = auth.uid()
  );
$$;

-- Helper: get the customer row id for the current authenticated user
CREATE OR REPLACE FUNCTION my_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM customers WHERE user_id = auth.uid() LIMIT 1;
$$;


-- ----------------------------------------------------------
-- STORES policies
-- ----------------------------------------------------------

-- Store owners can read their own store only
CREATE POLICY "stores: owner can select own store"
  ON stores FOR SELECT
  USING (owner_id = auth.uid());

-- Store owners can update their own store
CREATE POLICY "stores: owner can update own store"
  ON stores FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Only service role / backend inserts new stores
-- (no INSERT policy for authenticated users → app uses service key for onboarding)


-- ----------------------------------------------------------
-- CUSTOMERS policies
-- ----------------------------------------------------------

-- Customers can read their own profile
CREATE POLICY "customers: user can select own profile"
  ON customers FOR SELECT
  USING (user_id = auth.uid());

-- Customers can update their own profile
CREATE POLICY "customers: user can update own profile"
  ON customers FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Store owners can see customer profiles for customers who have
-- transacted at their store (needed to show balance info on store app)
CREATE POLICY "customers: store owner can view transacted customers"
  ON customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      JOIN stores s ON s.id = t.store_id
      WHERE t.customer_id = customers.id
        AND s.owner_id = auth.uid()
    )
  );


-- ----------------------------------------------------------
-- TRANSACTIONS policies
-- ----------------------------------------------------------

-- Store owners see transactions at their own store(s)
CREATE POLICY "transactions: store owner can select own store txns"
  ON transactions FOR SELECT
  USING (is_store_owner(store_id));

-- Store owners can insert transactions (i.e. approve a customer request)
CREATE POLICY "transactions: store owner can insert"
  ON transactions FOR INSERT
  WITH CHECK (is_store_owner(store_id));

-- Store owners can update transaction status for their store
CREATE POLICY "transactions: store owner can update"
  ON transactions FOR UPDATE
  USING (is_store_owner(store_id))
  WITH CHECK (is_store_owner(store_id));

-- Customers see only their own transactions
CREATE POLICY "transactions: customer can select own txns"
  ON transactions FOR SELECT
  USING (customer_id = my_customer_id());

-- Customers can insert a transaction request (pending approval by store)
CREATE POLICY "transactions: customer can insert"
  ON transactions FOR INSERT
  WITH CHECK (customer_id = my_customer_id());


-- ----------------------------------------------------------
-- STORE_INTERVIEWS policies
-- ----------------------------------------------------------

-- Store owners can read/insert interviews for their store
CREATE POLICY "store_interviews: store owner select"
  ON store_interviews FOR SELECT
  USING (is_store_owner(store_id));

CREATE POLICY "store_interviews: store owner insert"
  ON store_interviews FOR INSERT
  WITH CHECK (is_store_owner(store_id));

-- Customers can see their own interview records
CREATE POLICY "store_interviews: customer can select own"
  ON store_interviews FOR SELECT
  USING (customer_id = my_customer_id());


-- ----------------------------------------------------------
-- REPAYMENTS policies
-- ----------------------------------------------------------

-- Customers can see their own repayments
CREATE POLICY "repayments: customer can select own"
  ON repayments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = repayments.transaction_id
        AND t.customer_id = my_customer_id()
    )
  );

-- Customers can insert repayments against their own transactions
CREATE POLICY "repayments: customer can insert"
  ON repayments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id
        AND t.customer_id = my_customer_id()
    )
  );

-- Store owners can see repayments for transactions at their store
-- (needed to reconcile OTC cash payments)
CREATE POLICY "repayments: store owner can select"
  ON repayments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = repayments.transaction_id
        AND is_store_owner(t.store_id)
    )
  );

-- Store owners can insert OTC repayments on behalf of customers
CREATE POLICY "repayments: store owner can insert otc"
  ON repayments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id
        AND is_store_owner(t.store_id)
    )
  );


-- ----------------------------------------------------------
-- GUARANTEE_EVENTS policies
-- ----------------------------------------------------------

-- Store owners can see guarantee events for their store
CREATE POLICY "guarantee_events: store owner can select"
  ON guarantee_events FOR SELECT
  USING (is_store_owner(store_id));

-- Only service role inserts guarantee events (backend cron job)
-- No INSERT policy for authenticated users here.


-- ----------------------------------------------------------
-- SETTLEMENTS policies
-- ----------------------------------------------------------

-- Store owners can see settlements for their own store
CREATE POLICY "settlements: store owner can select"
  ON settlements FOR SELECT
  USING (is_store_owner(store_id));

-- Only service role inserts/updates settlements (backend process)


-- ============================================================
-- REALTIME (enable for tables the app subscribes to)
-- ============================================================

-- Allow realtime subscriptions on these tables.
-- RLS policies above still apply to realtime channels.
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE repayments;
ALTER PUBLICATION supabase_realtime ADD TABLE settlements;
ALTER PUBLICATION supabase_realtime ADD TABLE guarantee_events;
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
-- Add bank_qr as a repayment method (replaces GCash API requirement)
ALTER TYPE repayment_method ADD VALUE IF NOT EXISTS 'bank_qr';


-- ============================================================
-- Migration 005: Atomic repayment processing RPCs
-- ============================================================

CREATE OR REPLACE FUNCTION process_on_time_repayment(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count  integer;
  v_level  integer;
  v_threshold integer;
BEGIN
  SELECT on_time_repayment_count, level
    INTO v_count, v_level
    FROM customers
   WHERE id = p_customer_id
     FOR UPDATE;

  v_count := v_count + 1;

  v_threshold := CASE v_level
    WHEN 0 THEN 2
    WHEN 1 THEN 5
    WHEN 2 THEN 10
    WHEN 3 THEN 20
    ELSE NULL
  END;

  IF v_threshold IS NOT NULL AND v_count >= v_threshold AND v_level < 4 THEN
    UPDATE customers
       SET on_time_repayment_count = v_count,
           level = v_level + 1
     WHERE id = p_customer_id;
  ELSE
    UPDATE customers
       SET on_time_repayment_count = v_count
     WHERE id = p_customer_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION process_late_repayment(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_level integer;
BEGIN
  SELECT level INTO v_level
    FROM customers
   WHERE id = p_customer_id
     FOR UPDATE;

  IF v_level > 0 THEN
    UPDATE customers
       SET level = v_level - 1
     WHERE id = p_customer_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trg_update_store_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
      UPDATE stores
         SET available_balance = available_balance - NEW.amount_centavos
       WHERE id = NEW.store_id;
      IF (SELECT available_balance FROM stores WHERE id = NEW.store_id) < 0 THEN
        RAISE EXCEPTION 'Insufficient store available_balance for store %', NEW.store_id;
      END IF;
    ELSIF NEW.status = 'repaid' AND OLD.status IN ('approved', 'settled') THEN
      UPDATE stores
         SET available_balance = available_balance + NEW.amount_centavos
       WHERE id = NEW.store_id;
    ELSIF NEW.status = 'defaulted' AND OLD.status IN ('pending', 'approved', 'settled') THEN
      IF OLD.status IN ('approved', 'settled') THEN
        UPDATE stores
           SET available_balance = available_balance + NEW.amount_centavos
         WHERE id = NEW.store_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
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
-- ============================================================
-- Migration 008: Server-side transaction amount validation
--
-- Adds a BEFORE INSERT trigger on the transactions table that
-- rejects any transaction whose amount_centavos exceeds the
-- customer's level limit or whose due_date is in the past.
--
-- This closes the gap where a modified client app could submit
-- an amount that bypasses the client-side level-limit check.
-- ============================================================

CREATE OR REPLACE FUNCTION trg_validate_transaction_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_level      customer_level;
  v_max        integer;
BEGIN
  -- Look up the customer's current level
  SELECT level INTO v_level
    FROM customers
   WHERE id = NEW.customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer % not found', NEW.customer_id;
  END IF;

  v_max := get_customer_max_transaction(v_level);

  -- Reject if amount exceeds the level cap
  IF NEW.amount_centavos > v_max THEN
    RAISE EXCEPTION
      'Transaction amount (%) exceeds Level % limit (%) for customer %',
      NEW.amount_centavos, v_level, v_max, NEW.customer_id;
  END IF;

  -- Reject if amount is zero or negative (belt-and-suspenders alongside CHECK)
  IF NEW.amount_centavos <= 0 THEN
    RAISE EXCEPTION 'Transaction amount must be positive';
  END IF;

  -- Reject if due_date is in the past
  IF NEW.due_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'due_date (%) cannot be in the past', NEW.due_date;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transactions_validate_insert
  BEFORE INSERT
  ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION trg_validate_transaction_insert();

COMMENT ON FUNCTION trg_validate_transaction_insert() IS
  'Rejects transactions that exceed the customer''s level cap or have a past due_date.
   Enforces server-side what the client scan screen checks client-side.';
