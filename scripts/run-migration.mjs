import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Supabase credentials
const SUPABASE_URL = 'https://yjuqcbtdykdazdgrwxht.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Get it from Supabase Dashboard > Settings > API > service_role key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  console.log('Reading migration file...');
  const migrationPath = join(__dirname, '../datung-app/supabase/migrations/001_initial_schema.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  
  console.log('Running migration on Supabase...');
  console.log('SQL length:', sql.length, 'characters');
  
  // Execute the SQL using the Supabase REST API
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    // If exec_sql doesn't exist, we need to run via SQL Editor manually
    console.log('\n-------------------------------------------');
    console.log('NOTE: Database migrations need to be run manually.');
    console.log('-------------------------------------------\n');
    console.log('Please go to your Supabase Dashboard:');
    console.log('https://supabase.com/dashboard/project/yjuqcbtdykdazdgrwxht/sql/new');
    console.log('\nThen paste the contents of:');
    console.log('datung-app/supabase/migrations/001_initial_schema.sql');
    console.log('\nAnd click "Run" to execute the migration.');
    console.log('\n-------------------------------------------');
    return;
  }
  
  console.log('Migration completed successfully!');
  console.log(data);
}

runMigration().catch(console.error);
