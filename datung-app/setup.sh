#!/bin/bash
# ============================================================
# Datung App — Supabase Setup Script
# Run this once to connect your app to Supabase
# ============================================================

echo ""
echo "========================================="
echo "   Datung App — Supabase Setup"
echo "========================================="
echo ""
echo "You'll need two things from your Supabase dashboard:"
echo "  1. Project URL"
echo "  2. Anon (public) key"
echo ""
echo "To find them:"
echo "  → Open your Supabase project"
echo "  → Go to Settings (gear icon) > API"
echo "  → Copy 'Project URL' and 'anon public' key"
echo ""
echo "-----------------------------------------"
echo ""

# Prompt for Project URL
read -p "Paste your Supabase Project URL: " SUPABASE_URL

# Basic validation
if [[ -z "$SUPABASE_URL" ]]; then
  echo "ERROR: URL cannot be empty. Please try again."
  exit 1
fi

if [[ ! "$SUPABASE_URL" =~ ^https://.*\.supabase\.co$ ]]; then
  echo "WARNING: That doesn't look like a Supabase URL (should be https://xxxxx.supabase.co)"
  read -p "Continue anyway? (y/n): " CONTINUE
  if [[ "$CONTINUE" != "y" ]]; then
    exit 1
  fi
fi

echo ""

# Prompt for Anon Key
read -p "Paste your Supabase Anon Key: " SUPABASE_ANON_KEY

if [[ -z "$SUPABASE_ANON_KEY" ]]; then
  echo "ERROR: Anon key cannot be empty. Please try again."
  exit 1
fi

echo ""
echo "-----------------------------------------"
echo ""

# Create .env file
ENV_FILE="$(dirname "$0")/.env"

cat > "$ENV_FILE" <<EOF
EXPO_PUBLIC_SUPABASE_URL=$SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF

echo "Created .env file with your credentials!"
echo ""
echo "========================================="
echo "   NEXT STEPS (do these in your browser)"
echo "========================================="
echo ""
echo "1. ENABLE PHONE AUTH:"
echo "   → Supabase Dashboard > Authentication > Providers > Phone"
echo "   → Toggle it ON"
echo ""
echo "2. RUN THE DATABASE MIGRATIONS:"
echo "   → Supabase Dashboard > SQL Editor > New Query"
echo "   → Copy and paste the contents of these files (in order):"
echo ""
echo "   File 1: supabase/migrations/001_initial_schema.sql"
echo "   File 2: supabase/migrations/002_seed_data.sql"
echo "   File 3: supabase/migrations/003_admin_role.sql"
echo ""
echo "   (Paste each one and click 'Run' before moving to the next)"
echo ""
echo "3. CREATE STORAGE BUCKET:"
echo "   → Supabase Dashboard > Storage > New Bucket"
echo "   → Name: customer-docs"
echo "   → Toggle 'Public bucket' ON"
echo ""
echo "4. START THE APP:"
echo "   cd datung-app && npx expo start"
echo ""
echo "========================================="
echo "   Setup complete!"
echo "========================================="
echo ""
