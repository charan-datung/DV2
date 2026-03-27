-- ============================================================
-- RESET DATABASE SCRIPT
-- Run this FIRST to clean up any existing tables/types
-- Then run 001_initial_schema.sql
-- ============================================================

-- Drop all tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS guarantee_events CASCADE;
DROP TABLE IF EXISTS settlements CASCADE;
DROP TABLE IF EXISTS repayments CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Drop all custom types/enums
DROP TYPE IF EXISTS transaction_status CASCADE;
DROP TYPE IF EXISTS customer_level CASCADE;
DROP TYPE IF EXISTS guarantee_event_type CASCADE;
DROP TYPE IF EXISTS settlement_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Drop all custom domains
DROP DOMAIN IF EXISTS phone_number CASCADE;
DROP DOMAIN IF EXISTS peso_amount CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS get_customer_max_transaction(customer_level) CASCADE;
DROP FUNCTION IF EXISTS calculate_interest(peso_amount, INTEGER, customer_level) CASCADE;
DROP FUNCTION IF EXISTS update_store_balance() CASCADE;
DROP FUNCTION IF EXISTS check_store_balance() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Success message
SELECT 'Database reset complete! Now run 001_initial_schema.sql' as status;
