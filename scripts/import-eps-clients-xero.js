const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

function normalizeHeaderKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function buildRowObject(headerRow, row) {
  const out = {}
  for (let i = 0; i < headerRow.length; i++) {
    out[normalizeHeaderKey(headerRow[i])] = row[i]
  }
  return out
}

function stringValue(val) {
  if (val === null || val === undefined) return ''
  return String(val).trim()
}

function composeAddress(record, prefix) {
  const parts = [
    record[`${prefix}addressline1`],
    record[`${prefix}addressline2`],
    record[`${prefix}addressline3`],
    record[`${prefix}addressline4`],
    record[`${prefix}city`],
    record[`${prefix}region`],
    record[`${prefix}postalcode`],
    record[`${prefix}country`],
  ]
    .map(stringValue)
    .filter(Boolean)

  return parts.join(', ')
}

function buildClientRecord(record, rowIndex) {
  const rawName = stringValue(record.contactname || record.legalname)
  const name = rawName.replace(/^\(\$\)\s*/, '').trim()
  const accountNumber = stringValue(record.accountnumber)
  const fallbackClientId = name

  const saAddress = composeAddress(record, 'sa')
  const poAddress = composeAddress(record, 'po')
  const address = saAddress || poAddress

  const firstName = stringValue(record.firstname)
  const lastName = stringValue(record.lastname)
  const contactPerson = [firstName, lastName].filter(Boolean).join(' ').trim()

  return {
    rowIndex,
    client_id: fallbackClientId || accountNumber,
    used_contact_name_id: !!fallbackClientId,
    name,
    address,
    contact_person: contactPerson || null,
    email: stringValue(record.emailaddress) || null,
    phone: stringValue(record.phonenumber || record.mobilenumber || record.ddinumber) || null,
    vat_number: stringValue(record.taxnumber) || null,
  }
}

function mergePreferred(current, candidate) {
  const score = (r) =>
    (r.address ? 5 : 0) +
    (r.email ? 2 : 0) +
    (r.phone ? 1 : 0) +
    (r.contact_person ? 1 : 0)

  return score(candidate) >= score(current) ? candidate : current
}

async function fetchExistingClientMap(supabase) {
  const map = new Map()
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('eps_client_list')
      .select('id, client_id')
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    for (const row of data) {
      const key = stringValue(row.client_id)
      if (key) map.set(key, row.id)
    }

    if (data.length < pageSize) break
    from += pageSize
  }

  return map
}

async function run() {
  const inputPath = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')

  if (!inputPath) {
    console.error('Usage: node scripts/import-eps-clients-xero.js <file.xlsx|file.csv|file.tsv> [--dry-run]')
    process.exit(1)
  }

  loadEnvFile(path.resolve(process.cwd(), '.env.local'))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY in environment/.env.local')
    process.exit(1)
  }

  const fullPath = path.resolve(process.cwd(), inputPath)
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`)
    process.exit(1)
  }

  const workbook = XLSX.readFile(fullPath, { raw: false })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (!rows.length) {
    console.error('Input file has no rows')
    process.exit(1)
  }

  const header = rows[0]
  const normalizedHeader = header.map(normalizeHeaderKey)
  if (!normalizedHeader.includes('contactname') || !normalizedHeader.includes('accountnumber')) {
    console.error('Input headers do not look like the expected Xero contact export (missing ContactName/AccountNumber)')
    process.exit(1)
  }

  const byAccount = new Map()
  const missingAccountRows = []
  const missingAddressRows = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue

    const rowObj = buildRowObject(header, row)
    const mapped = buildClientRecord(rowObj, i + 1)

    if (!mapped.name) continue
    if (!mapped.client_id) {
      missingAccountRows.push(mapped.rowIndex)
      continue
    }
    if (mapped.used_contact_name_id) {
      missingAccountRows.push(mapped.rowIndex)
    }
    if (!mapped.address) {
      missingAddressRows.push(mapped.rowIndex)
    }

    const existing = byAccount.get(mapped.client_id)
    byAccount.set(mapped.client_id, existing ? mergePreferred(existing, mapped) : mapped)
  }

  const records = Array.from(byAccount.values()).map((r) => ({
    client_id: r.client_id,
    name: r.name,
    address: r.address || null,
    contact_person: r.contact_person,
    email: r.email,
    phone: r.phone,
    vat_number: r.vat_number,
  }))

  console.log(`Parsed rows: ${rows.length - 1}`)
  console.log(`Valid unique clients (by client_id): ${records.length}`)
  console.log(`Rows that used ContactName as client_id: ${missingAccountRows.length}`)
  console.log(`Rows with missing address (still imported with null address): ${missingAddressRows.length}`)

  if (dryRun) {
    console.log('Dry run complete. No DB changes made.')
    return
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const existingMap = await fetchExistingClientMap(supabase)

  const updates = []
  const inserts = []
  for (const rec of records) {
    const existingId = existingMap.get(rec.client_id)
    if (existingId) updates.push({ id: existingId, ...rec })
    else inserts.push(rec)
  }

  console.log(`Will update existing: ${updates.length}`)
  console.log(`Will insert new: ${inserts.length}`)

  const batchSize = 200
  let updatedCount = 0
  let insertedCount = 0

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize)
    for (const row of batch) {
      const { id, ...payload } = row
      const { error } = await supabase.from('eps_client_list').update(payload).eq('id', id)
      if (error) {
        console.error(`Update failed for client_id=${payload.client_id}:`, error.message)
      } else {
        updatedCount += 1
      }
    }
    console.log(`Updated ${Math.min(i + batch.length, updates.length)}/${updates.length}`)
  }

  for (let i = 0; i < inserts.length; i += batchSize) {
    const batch = inserts.slice(i, i + batchSize)
    const { error } = await supabase.from('eps_client_list').insert(batch)
    if (error) {
      console.error(`Insert batch failed (${i}-${i + batch.length - 1}):`, error.message)
    } else {
      insertedCount += batch.length
      console.log(`Inserted ${Math.min(i + batch.length, inserts.length)}/${inserts.length}`)
    }
  }

  console.log('Import finished')
  console.log(`Updated: ${updatedCount}`)
  console.log(`Inserted: ${insertedCount}`)
}

run().catch((error) => {
  console.error('Import failed:', error)
  process.exit(1)
})
