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
