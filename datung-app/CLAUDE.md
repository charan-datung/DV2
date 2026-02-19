# Datung - Embedded Credit Network MVP

## What This App Does
Datung is a merchant-guaranteed embedded credit system for Philippine sari-sari stores.
- Store owners get revolving credit lines from Datung (B2B loan)
- Customers scan QR at store to buy goods on credit
- Datung settles with store within 48 hours (upgradable to same-day)
- Customer repays via GCash or cash at store
- Default risk is split 50/50 between Datung and the store
- Graduated escalation: Day 3 notify > Day 5 freeze > Day 10 reduce (50%) > Day 30 permanent

## Two App Roles (Same Codebase)
1. STORE APP: Store owner manages credit line, approves transactions, views customer balances, completes Store Interview
2. CUSTOMER APP: Customer scans QR, registers, views balance, repays

## Tech Stack
- React Native with Expo (TypeScript)
- Supabase (Postgres DB, Auth, Realtime, Row Level Security)
- GCash API for payments (stubbed in MVP)
- Zustand for state management
- React Hook Form for forms

## Architecture Rules
- All monetary amounts stored as integers (centavos) to avoid floating point
- All timestamps in UTC, display in Asia/Manila timezone
- Supabase Row Level Security on EVERY table - no exceptions
- Store owners authenticate with phone + OTP
- Customers authenticate with phone + OTP
- All Filipino-facing text in Tagalog/Taglish
- App must work on Android 8+ with 3G connection
- Offline-first where possible: queue transactions, sync when connected

## Database Tables (Supabase)
- stores: id, owner_id, name, address, barangay, credit_line, available_balance, settlement_type (48hr|same_day), status, tier, created_at
- customers: id, user_id, phone, name, selfie_url, id_photo_url, datung_score, level (0-4), status, created_at
- transactions: id, store_id, customer_id, amount_centavos, interest_centavos, status (pending|approved|settled|repaid|defaulted), due_date, approved_at, settled_at, repaid_at, created_at
- store_interviews: id, transaction_id, store_id, customer_id, trust_reason (enum), created_at
- repayments: id, transaction_id, amount_centavos, method (gcash|otc), reference_no, created_at
- guarantee_events: id, transaction_id, store_id, event_type (day3_notify|day5_freeze|day10_reduce|day30_permanent), store_share_centavos, datung_share_centavos, created_at
- settlements: id, store_id, amount_centavos, status, settled_at, created_at

## Business Rules (CRITICAL - never violate these)
- New customer max transaction: 500 pesos (50000 centavos), 3-day term
- Level 1: 500 pesos, 5 days (after 2 on-time repayments)
- Level 2: 2000 pesos, 14 days (after 5 on-time)
- Level 3: 5000 pesos, 30 days (after 10 on-time + valid ID)
- Level 4: 10000 pesos, 90 days (after 20 on-time + GCash history)
- Interest: 6% per month (prorated daily)
- Store commission: 1% of transaction amount
- Default risk split: 50% store, 50% Datung
- Late payment resets customer back one level
- Two defaults within 60 days = system-wide block
- Store freeze at Day 5 of any customer default
- Customer-facing text NEVER uses: "loan", "credit", "lend", "borrow"
- Customer-facing text ONLY uses: "balance", "bayad", "due date", "amount"

## Code Style
- Functional components only, no class components
- Use TypeScript strict mode
- Name files in kebab-case
- Use Zustand stores in src/stores/ (not to be confused with physical stores)
- All API calls go through src/services/
- Custom hooks in src/hooks/
- Shared types in src/types/

## Testing
- Test on low-end Android (Expo Go)
- All forms must handle: no internet, slow connection, back button
- Currency always displayed as "₱X,XXX.XX" format
