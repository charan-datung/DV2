-- ============================================================
-- Migration 005: Atomic repayment processing RPCs
--
-- Fixes:
--   1. process_on_time_repayment — atomically increments
--      on_time_repayment_count and upgrades level when threshold
--      is reached, avoiding read-then-write races.
--   2. process_late_repayment — atomically decrements level
--      (floor 0) on late payment.
--   3. trg_update_store_balance — extend to also restore
--      available_balance on approved → repaid (direct repayment
--      path that bypasses the 'settled' state).
-- ============================================================

-- ----------------------------------------------------------
-- 1. Atomic on-time repayment processing
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION process_on_time_repayment(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count  integer;
  v_level  integer;
  -- Level upgrade thresholds: current_level → required on_time count
  v_threshold integer;
BEGIN
  SELECT on_time_repayment_count, level
    INTO v_count, v_level
    FROM customers
   WHERE id = p_customer_id
     FOR UPDATE;   -- row-level lock prevents concurrent updates

  v_count := v_count + 1;

  -- Determine upgrade threshold for current level
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

COMMENT ON FUNCTION process_on_time_repayment(uuid) IS
  'Atomically increments on_time_repayment_count and upgrades level when threshold reached.';

-- ----------------------------------------------------------
-- 2. Atomic late repayment processing
-- ----------------------------------------------------------
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

COMMENT ON FUNCTION process_late_repayment(uuid) IS
  'Atomically decrements customer level on late payment (floor 0).';

-- ----------------------------------------------------------
-- 3. Extend trg_update_store_balance to cover approved → repaid
--    (direct repayment path that skips the 'settled' state)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_update_store_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Nothing to do until the store owner approves.
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN

    -- pending → approved: atomically reserve funds
    IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
      UPDATE stores
         SET available_balance = available_balance - NEW.amount_centavos
       WHERE id = NEW.store_id;

      IF (SELECT available_balance FROM stores WHERE id = NEW.store_id) < 0 THEN
        RAISE EXCEPTION 'Insufficient store available_balance for store %', NEW.store_id;
      END IF;

    -- settled → repaid OR approved → repaid: restore store balance
    ELSIF NEW.status = 'repaid'
          AND OLD.status IN ('approved', 'settled') THEN
      UPDATE stores
         SET available_balance = available_balance + NEW.amount_centavos
       WHERE id = NEW.store_id;

    -- any active status → defaulted: release reserved amount
    ELSIF NEW.status = 'defaulted'
          AND OLD.status IN ('pending', 'approved', 'settled') THEN
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

COMMENT ON FUNCTION trg_update_store_balance() IS
  'Keeps stores.available_balance in sync as transactions move through their lifecycle.
   Handles: pending→approved (deduct), approved/settled→repaid (restore), →defaulted (restore if was active).';
