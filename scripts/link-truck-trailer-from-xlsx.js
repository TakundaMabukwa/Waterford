/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const INPUT_FILE = path.resolve(__dirname, '..', 'Truck List & Tank Capacity.xlsx');
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

const normalizePlate = (value) =>
  String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const cleanPlate = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length ? text : null;
};

const env = readEnvFile(ENV_FILE);
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase URL or service role key in .env.local');
  process.exit(1);
}

const fetchAllVehicles = async () => {
  const out = [];
  let from = 0;
  const batchSize = 1000;
  let done = false;

  while (!done) {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/vehiclesc?select=id,registration_number&order=id&offset=${from}&limit=${batchSize}`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`
        }
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Fetch vehicles failed: ${res.status} ${res.statusText} - ${text}`);
    }

    const data = await res.json();
    out.push(...data);
    if (data.length < batchSize) done = true;
    from += batchSize;
  }

  return out;
};

const updateVehicle = async (id, trailerNo) => {
  const res = await fetch(`${supabaseUrl}/rest/v1/vehiclesc?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      trailer_no: trailerNo
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update failed for id ${id}: ${res.status} ${res.statusText} - ${text}`);
  }
};

const workbook = xlsx.readFile(INPUT_FILE);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

const pairs = [];
rows.forEach((row) => {
  const regCell = String(row[3] || '').trim();
  if (!regCell.includes('&')) return;
  const parts = regCell.split('&').map((part) => cleanPlate(part)).filter(Boolean);
  if (parts.length < 2) return;
  const truck = parts[0];
  const trailer = parts[1];
  pairs.push({ truck, trailer });
});

(async () => {
  try {
    const vehicles = await fetchAllVehicles();
    const regToId = new Map();
    vehicles.forEach((v) => {
      const key = normalizePlate(v.registration_number);
      if (key) regToId.set(key, v.id);
    });

    let updated = 0;
    let missing = 0;

    for (const pair of pairs) {
      const truckKey = normalizePlate(pair.truck);
      const truckId = regToId.get(truckKey);
      if (!truckId) {
        missing += 1;
        continue;
      }
      await updateVehicle(truckId, pair.trailer);
      updated += 1;
    }

    console.log(`Pairs found: ${pairs.length}`);
    console.log(`Updated vehicles: ${updated}`);
    console.log(`Missing trucks: ${missing}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
