/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const INPUT_FILE = path.resolve(__dirname, '..', 'Truck List & Tank Capacity.xlsx');
const outDir = path.resolve(__dirname);
const OUTPUT_JSON = path.join(outDir, 'vehiclesc_import.json');
const OUTPUT_SQL = path.join(outDir, 'vehiclesc_import.sql');

const cleanText = (value) => {
  const text = String(value ?? '').trim();
  return text.length ? text : null;
};

const parseLiters = (value) => {
  const text = cleanText(value);
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
};

const normalizeSpaces = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const splitMakeModel = (raw) => {
  const text = normalizeSpaces(raw);
  if (!text) return { make: null, model: null };
  const parts = text.split(' ');
  if (parts.length === 1) return { make: parts[0], model: null };

  const first = parts[0].toLowerCase();
  const second = parts[1]?.toLowerCase();
  if (first === 'mercedes' && second === 'benz') {
    return { make: 'Mercedes Benz', model: parts.slice(2).join(' ') || null };
  }

  return { make: parts[0], model: parts.slice(1).join(' ') || null };
};

const toSqlString = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' && Number.isFinite(value)) return value.toString();
  const text = String(value).replace(/'/g, "''");
  return `'${text}'`;
};

const workbook = xlsx.readFile(INPUT_FILE);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

const trucks = [];
const trailers = [];

let mode = 'trucks';
let currentSection = null;

const isBlankRow = (row) => row.every((cell) => String(cell || '').trim() === '');

rows.forEach((row) => {
  const col0 = String(row[0] || '').trim();
  const col2 = String(row[2] || '').trim();
  const col3 = String(row[3] || '').trim();

  if (col0.toUpperCase() === 'TRAILERS') {
    mode = 'trailers';
    currentSection = null;
    return;
  }

  if (mode === 'trucks') {
    if (col2 && !col0 && !Number.isFinite(Number(col0))) {
      currentSection = col2;
      return;
    }

    const index = Number(row[0]);
    const year = cleanText(row[1]);
    const makeModel = cleanText(row[2]);
    const reg = cleanText(row[3]);
    const leftTank = parseLiters(row[4]);
    const rightTank = parseLiters(row[5]);

    if (!Number.isFinite(index) || !makeModel || !reg) return;

    const { make, model } = splitMakeModel(makeModel);
    const tankCapacity = [leftTank, rightTank].filter((n) => Number.isFinite(n)).reduce((sum, n) => sum + n, 0) || null;

    trucks.push({
      registration_number: normalizeSpaces(reg),
      make,
      model,
      manufactured_year: year,
      vehicle_year: year,
      vehicle_type: 'vehicle',
      type: 'truck',
      tank_capacity: tankCapacity,
      vehicle_type_descrip: currentSection,
      vehicle_category: currentSection
    });
    return;
  }

  // trailers mode
  if (mode === 'trailers') {
    if (isBlankRow(row)) return;

    if (col0 === 'NO.' || col2.toUpperCase() === 'MAKE & MODEL') {
      return;
    }

    if (!Number.isFinite(Number(col0)) && col2) {
      currentSection = col2;
      return;
    }

    const index = Number(row[0]);
    const year = cleanText(row[1]);
    const makeModel = cleanText(row[2]);
    const reg = cleanText(row[3]);

    if (!Number.isFinite(index) || !makeModel || !reg) return;

    const { make, model } = splitMakeModel(makeModel);

    trailers.push({
      registration_number: normalizeSpaces(reg),
      make,
      model,
      manufactured_year: year,
      vehicle_year: year,
      vehicle_type: 'trailer',
      type: 'trailer',
      vehicle_type_descrip: currentSection,
      vehicle_category: currentSection
    });
  }
});

const records = [...trucks, ...trailers];

fs.writeFileSync(OUTPUT_JSON, JSON.stringify(records, null, 2), 'utf8');

const columns = [
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

const valuesSql = records
  .map((record) => {
    const values = columns.map((col) => toSqlString(record[col]));
    return `(${values.join(', ')})`;
  })
  .join(',\n');

const sql = `-- Generated from Truck List & Tank Capacity.xlsx\nINSERT INTO public.vehiclesc (${columns.join(', ')})\nVALUES\n${valuesSql};\n`;

fs.writeFileSync(OUTPUT_SQL, sql, 'utf8');

console.log(`Parsed ${trucks.length} trucks and ${trailers.length} trailers.`);
console.log(`Output JSON: ${OUTPUT_JSON}`);
console.log(`Output SQL: ${OUTPUT_SQL}`);
