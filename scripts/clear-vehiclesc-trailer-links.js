/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

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

const env = readEnvFile(ENV_FILE);
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase URL or service role key in .env.local');
  process.exit(1);
}

const fetchIdsWithLinks = async () => {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/vehiclesc?select=id&trailer_no=not.is.null`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`
      }
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fetch failed: ${res.status} ${res.statusText} - ${text}`);
  }

  return res.json();
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const clearLinks = async (ids) => {
  if (ids.length === 0) return 0;
  const idList = ids.join(',');
  const res = await fetch(`${supabaseUrl}/rest/v1/vehiclesc?id=in.(${idList})`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      trailer_no: null,
      trailer_no2: null,
      trailer_name: null,
      trailer_name2: null
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clear failed: ${res.status} ${res.statusText} - ${text}`);
  }
  return ids.length;
};

(async () => {
  try {
    const rows = await fetchIdsWithLinks();
    const ids = rows.map((row) => row.id);
    const batches = chunk(ids, 200);
    let cleared = 0;
    for (const batch of batches) {
      cleared += await clearLinks(batch);
    }
    console.log(`Cleared trailer links for ${cleared} vehicles.`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
