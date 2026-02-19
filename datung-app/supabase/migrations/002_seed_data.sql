-- ============================================================
-- Datung MVP - Development Seed Data
-- Migration: 002_seed_data.sql
--
-- WARNING: Run ONLY in development / staging environments.
-- These records use fixed UUIDs so they are idempotent (safe to re-run).
--
-- IMPORTANT: This seed does NOT insert rows into auth.users because
-- Supabase manages auth.users internally. In the Supabase dashboard,
-- manually create 8 users with phone auth (or use the service-role API),
-- then update the owner_id / user_id values below to match the real UUIDs.
-- Placeholder UUIDs are provided so foreign key constraints pass in CI/test
-- environments where auth.users is pre-populated with these same IDs.
--
-- Placeholder auth.users UUIDs (replace with real ones after manual creation):
--   store-owner-1 : 00000000-0000-0000-0000-000000000001
--   store-owner-2 : 00000000-0000-0000-0000-000000000002
--   store-owner-3 : 00000000-0000-0000-0000-000000000003
--   customer-1    : 00000000-0000-0000-0000-000000000011
--   customer-2    : 00000000-0000-0000-0000-000000000012
--   customer-3    : 00000000-0000-0000-0000-000000000013
--   customer-4    : 00000000-0000-0000-0000-000000000014
--   customer-5    : 00000000-0000-0000-0000-000000000015
-- ============================================================


-- ============================================================
-- TEST STORES
-- ============================================================

INSERT INTO stores (
  id,
  owner_id,
  name,
  address,
  barangay,
  credit_line,
  available_balance,
  settlement_type,
  status,
  tier
) VALUES

-- Store 1: Active store, 48-hour settlement, healthy balance
(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Aling Nena''s Sari-Sari Store',
  '123 Rizal Street, Brgy. San Isidro',
  'San Isidro',
  500000,   -- ₱5,000.00 credit line
  500000,   -- ₱5,000.00 available (full, no active txns)
  '48hr',
  'active',
  1
),

-- Store 2: Active store, same-day settlement, mid-tier
(
  'aaaaaaaa-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  'Mang Totoy General Merchandise',
  '45 Bonifacio Avenue, Brgy. Poblacion',
  'Poblacion',
  1000000,  -- ₱10,000.00 credit line
  850000,   -- ₱8,500.00 available (some transactions active)
  'same_day',
  'active',
  2
),

-- Store 3: Active store, frozen status (testing freeze scenario), 48-hour
(
  'aaaaaaaa-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000003',
  'Ate Cora''s Mini Store',
  '7 Mabini St., Brgy. Santa Cruz',
  'Santa Cruz',
  300000,   -- ₱3,000.00 credit line
  250000,   -- ₱2,500.00 available
  '48hr',
  'frozen',
  1
)

ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- TEST CUSTOMERS
-- ============================================================

INSERT INTO customers (
  id,
  user_id,
  phone,
  name,
  selfie_url,
  id_photo_url,
  datung_score,
  level,
  status,
  on_time_repayment_count,
  recent_default_count
) VALUES

-- Customer 1: New customer, Level 0, no history
(
  'cccccccc-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',
  '+639171111111',
  'Juan dela Cruz',
  NULL,
  NULL,
  0,      -- no score yet
  0,      -- Level 0
  'active',
  0,
  0
),

-- Customer 2: Level 1, 2 on-time repayments, eligible for ₱500 / 5-day
(
  'cccccccc-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000012',
  '+639172222222',
  'Maria Santos',
  'https://placeholder.datung.ph/selfies/maria.jpg',
  NULL,
  120,
  1,      -- Level 1
  'active',
  2,
  0
),

-- Customer 3: Level 2, 5 on-time repayments, eligible for ₱2,000 / 14-day
(
  'cccccccc-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000013',
  '+639173333333',
  'Pedro Reyes',
  'https://placeholder.datung.ph/selfies/pedro.jpg',
  'https://placeholder.datung.ph/ids/pedro_id.jpg',
  310,
  2,      -- Level 2
  'active',
  5,
  0
),

-- Customer 4: Level 3, 10 on-time repayments + valid ID, eligible for ₱5,000 / 30-day
(
  'cccccccc-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000014',
  '+639174444444',
  'Ana Villanueva',
  'https://placeholder.datung.ph/selfies/ana.jpg',
  'https://placeholder.datung.ph/ids/ana_id.jpg',
  580,
  3,      -- Level 3
  'active',
  10,
  0
),

-- Customer 5: Level 1 but currently blocked (2 defaults within 60 days)
(
  'cccccccc-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000015',
  '+639175555555',
  'Noel Aquino',
  NULL,
  NULL,
  0,
  1,
  'blocked',  -- system-wide block (2 defaults in 60 days)
  1,
  2
)

ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- TEST TRANSACTIONS
-- ============================================================
-- Covering the main status lifecycle and different scenarios.

INSERT INTO transactions (
  id,
  store_id,
  customer_id,
  amount_centavos,
  interest_centavos,
  status,
  due_date,
  approved_at,
  settled_at,
  repaid_at,
  created_at
) VALUES

-- Txn 1: Fully repaid (Level 1 customer at Store 1, ₱500 / 5-day, clean)
(
  'eeeeeeee-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000002',
  50000,   -- ₱500.00
  calculate_interest(50000, 5),   -- 6%/mo prorated 5 days ≈ ₱50
  'repaid',
  (now() - interval '7 days')::date,
  now() - interval '9 days',
  now() - interval '8 days',
  now() - interval '6 days',
  now() - interval '10 days'
),

-- Txn 2: Approved (pending settlement by Datung) at Store 1, ₱500 for Level 1 customer
(
  'eeeeeeee-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000002',
  50000,
  calculate_interest(50000, 5),
  'approved',
  (now() + interval '4 days')::date,
  now() - interval '1 day',
  NULL,
  NULL,
  now() - interval '2 days'
),

-- Txn 3: Settled (Datung paid store, customer hasn't repaid yet) at Store 2
(
  'eeeeeeee-0000-0000-0000-000000000003',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'cccccccc-0000-0000-0000-000000000003',
  200000,  -- ₱2,000.00 (Level 2)
  calculate_interest(200000, 14),
  'settled',
  (now() + interval '10 days')::date,
  now() - interval '5 days',
  now() - interval '3 days',
  NULL,
  now() - interval '6 days'
),

-- Txn 4: Pending approval at Store 1 (new customer scanning QR)
(
  'eeeeeeee-0000-0000-0000-000000000004',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000001',
  50000,   -- ₱500.00 (Level 0 max)
  calculate_interest(50000, 3),
  'pending',
  (now() + interval '3 days')::date,
  NULL,
  NULL,
  NULL,
  now() - interval '1 hour'
),

-- Txn 5: Defaulted at Store 3 (triggers freeze scenario)
(
  'eeeeeeee-0000-0000-0000-000000000005',
  'aaaaaaaa-0000-0000-0000-000000000003',
  'cccccccc-0000-0000-0000-000000000005',
  50000,
  calculate_interest(50000, 5),
  'defaulted',
  (now() - interval '25 days')::date,
  now() - interval '33 days',
  now() - interval '30 days',
  NULL,
  now() - interval '35 days'
)

ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- TEST STORE INTERVIEWS
-- ============================================================

INSERT INTO store_interviews (
  id,
  transaction_id,
  store_id,
  customer_id,
  trust_reason,
  created_at
) VALUES

-- Interview for the repaid transaction (Txn 1)
(
  'ffffffff-0000-0000-0000-000000000001',
  'eeeeeeee-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000002',
  'regular_suki',
  now() - interval '10 days'
),

-- Interview for the approved transaction (Txn 2)
(
  'ffffffff-0000-0000-0000-000000000002',
  'eeeeeeee-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000002',
  'regular_suki',
  now() - interval '2 days'
),

-- Interview for the settled transaction (Txn 3)
(
  'ffffffff-0000-0000-0000-000000000003',
  'eeeeeeee-0000-0000-0000-000000000003',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'cccccccc-0000-0000-0000-000000000003',
  'neighbor_5yr',
  now() - interval '6 days'
),

-- Interview for the defaulted transaction (Txn 5)
(
  'ffffffff-0000-0000-0000-000000000004',
  'eeeeeeee-0000-0000-0000-000000000005',
  'aaaaaaaa-0000-0000-0000-000000000003',
  'cccccccc-0000-0000-0000-000000000005',
  'known_family',
  now() - interval '35 days'
)

ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- TEST REPAYMENTS
-- ============================================================

INSERT INTO repayments (
  id,
  transaction_id,
  amount_centavos,
  method,
  reference_no,
  created_at
) VALUES

-- Full GCash repayment for Txn 1 (principal + interest)
(
  'bbbbbbbb-0000-0000-0000-000000000001',
  'eeeeeeee-0000-0000-0000-000000000001',
  50000 + calculate_interest(50000, 5),
  'gcash',
  'GC20240101-ABC123',
  now() - interval '6 days'
)

ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- TEST GUARANTEE EVENTS
-- ============================================================
-- Show the escalation ladder for the defaulted transaction (Txn 5)

INSERT INTO guarantee_events (
  id,
  transaction_id,
  store_id,
  event_type,
  store_share_centavos,
  datung_share_centavos,
  created_at
) VALUES

-- Day 3: Notification only (no financial split yet)
(
  'dddddddd-0000-0000-0000-000000000001',
  'eeeeeeee-0000-0000-0000-000000000005',
  'aaaaaaaa-0000-0000-0000-000000000003',
  'day3_notify',
  0,
  0,
  now() - interval '32 days'
),

-- Day 5: Store frozen, 50/50 split recorded
(
  'dddddddd-0000-0000-0000-000000000002',
  'eeeeeeee-0000-0000-0000-000000000005',
  'aaaaaaaa-0000-0000-0000-000000000003',
  'day5_freeze',
  25000,  -- store owes ₱250 (50% of ₱500 principal)
  25000,  -- Datung absorbs ₱250
  now() - interval '30 days'
)

ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- TEST SETTLEMENTS
-- ============================================================

INSERT INTO settlements (
  id,
  store_id,
  amount_centavos,
  status,
  settled_at,
  created_at
) VALUES

-- Completed settlement for Store 1 (for the repaid Txn 1)
(
  '11111111-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  50000,
  'completed',
  now() - interval '8 days',
  now() - interval '9 days'
),

-- Completed settlement for Store 2 (for the settled Txn 3)
(
  '11111111-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000002',
  200000,
  'completed',
  now() - interval '3 days',
  now() - interval '4 days'
),

-- Pending settlement for Store 1 (for the approved Txn 2)
(
  '11111111-0000-0000-0000-000000000003',
  'aaaaaaaa-0000-0000-0000-000000000001',
  50000,
  'pending',
  NULL,
  now() - interval '1 day'
)

ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- VERIFICATION QUERIES
-- Run these after seeding to confirm everything looks right.
-- ============================================================

/*

-- Count rows per table
SELECT 'stores'           AS tbl, COUNT(*) FROM stores
UNION ALL SELECT 'customers',          COUNT(*) FROM customers
UNION ALL SELECT 'transactions',       COUNT(*) FROM transactions
UNION ALL SELECT 'store_interviews',   COUNT(*) FROM store_interviews
UNION ALL SELECT 'repayments',         COUNT(*) FROM repayments
UNION ALL SELECT 'guarantee_events',   COUNT(*) FROM guarantee_events
UNION ALL SELECT 'settlements',        COUNT(*) FROM settlements;

-- Verify interest calculation function
SELECT
  calculate_interest(50000, 3)   AS lvl0_interest_centavos,  -- expect 300
  calculate_interest(50000, 5)   AS lvl1_interest_centavos,  -- expect 500
  calculate_interest(200000, 14) AS lvl2_interest_centavos,  -- expect 5600
  calculate_interest(500000, 30) AS lvl3_interest_centavos,  -- expect 30000
  calculate_interest(1000000, 90) AS lvl4_interest_centavos; -- expect 180000

-- Verify max transaction limits
SELECT
  get_customer_max_transaction(0) AS lvl0_max,  -- 50000
  get_customer_max_transaction(1) AS lvl1_max,  -- 50000
  get_customer_max_transaction(2) AS lvl2_max,  -- 200000
  get_customer_max_transaction(3) AS lvl3_max,  -- 500000
  get_customer_max_transaction(4) AS lvl4_max;  -- 1000000

-- View all transactions with store and customer names
SELECT
  t.id,
  s.name  AS store_name,
  c.name  AS customer_name,
  t.amount_centavos,
  t.interest_centavos,
  t.status,
  t.due_date
FROM transactions t
JOIN stores    s ON s.id = t.store_id
JOIN customers c ON c.id = t.customer_id
ORDER BY t.created_at DESC;

*/
