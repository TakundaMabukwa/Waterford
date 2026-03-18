/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const INPUT_JSON = path.resolve(__dirname, 'vehiclesc_import.json');
const ENV_FILE = path.resolve(__dirname, '..', '.env.local');

const readEnvFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

const env = readEnvFile(ENV_FILE);
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase URL or service role key in .env.local');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf8'));

const COLUMNS = [
  'registration_number',
  'make',
  'model',
  'manufactured_year',
  'vehicle_year',
  'vehicle_type',
  'type',
  'tank_capacity',
  'vehicle_type_descrip',
  'vehicle_category'
];

const normalizedPayload = payload.map((row) => {
  const out = {};
  COLUMNS.forEach((key) => {
    out[key] = row[key] ?? null;
  });
  return out;
});

const insertBatch = async (rows) => {
  const res = await fetch(`${supabaseUrl}/rest/v1/vehiclesc`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(rows)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Insert failed: ${res.status} ${res.statusText} - ${text}`);
  }
};

(async () => {
  try {
    const batches = chunk(normalizedPayload, 500);
    let inserted = 0;

    for (const [index, batch] of batches.entries()) {
      await insertBatch(batch);
      inserted += batch.length;
      console.log(`Inserted batch ${index + 1}/${batches.length} (${inserted}/${normalizedPayload.length})`);
    }

    console.log(`Done. Inserted ${inserted} records into vehiclesc.`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
