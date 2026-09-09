# WATERFORD DASHBOARD — IMPLEMENTATION PLAN
> Created: 2026-09-07
> Status: NOT STARTED
> Last reviewed: 2026-09-07

---

## Phase 1: Clients Page (4 changes)

### 1A. Migration: `pod_required` column
```sql
ALTER TABLE public.eps_client_list ADD COLUMN IF NOT EXISTS pod_required BOOLEAN DEFAULT false;
```
- Run in Supabase SQL editor

### 1B. `pod_required` toggle
- **`src/components/ui/client-form-dialog.tsx`**: Add `pod_required: false` to default form state (~line 52). Add toggle switch in Basic Details section (after Blocked toggle, ~line 366). Wire to save payload.
- **`src/app/api/eps-client-list/route.js`**: Add `pod_required` to GET select, POST insert, PUT update.

### 1C. Delete client + delete stop
- **`src/app/(protected)/clients/page.tsx`**: Add `Trash2` delete button in client Actions column (after Edit, ~line 360). On click → confirmation dialog → hard delete via `DELETE /api/eps-client-list?id={id}`. Same for stops: add delete button in stops Actions column (~line 415) → direct Supabase delete from `fuel_stops`.
- **`src/app/api/eps-client-list/route.js`**: Add DELETE handler — `supabase.from('eps_client_list').delete().eq('id', id)`.

### 1D. Move Invoice Contact Emails to top of modal
- **`src/components/ui/client-form-dialog.tsx`**: Cut the Invoice Contact Emails section (lines 629-724) and paste it before the Basic Details section (before line 316). No logic changes — just reorder JSX blocks.

---

## Phase 2: Audit Page (4 changes)

### 2A. Trip Invoices: add created_at, vehicle, driver; remove fuel
- **`src/app/(protected)/audit/page.tsx`**: Add `vehicleassignments` to the trips query select (~line 422). Remove the Fuel column. Add:
  - **Created At** — `formatDate(record.created_at)`
  - **Vehicle** — `vehicleassignments[0]?.vehicle?.name`
  - **Driver** — `vehicleassignments[0]?.drivers[0]?.first_name + ' ' + surname`

### 2B. Unified Invoices tab
- **`src/app/(protected)/audit/page.tsx`**: Merge the existing split Trip/Sundry sections in the Invoices tab (lines 1816-2095) into ONE `<Table>` with columns: Invoice #, Order, Customer, Reference, Date, Amount, Currency, Status, Actions. Sort by `invoice_number` ascending. Group by client with a separator row per client name.

### 2C. Drafts tab search
- Add search input (same pattern as Trip Invoices search at line 1436). Filter client-side by invoice number, customer name, or order number.

### 2D. Invoices tab search
- Same search input added to the Invoices tab.

---

## Phase 3: Invoice PDF + Modal (6 changes)

### 3A. PDF: Remove Sales Code, Vehicle, Driver from client-facing PDF
- **`src/lib/generate-invoice-pdf.ts`**: Remove columns 4 (Sales Code), 5 (Vehicle), 6 (Driver) from line items table (~lines 201-258).
- New PDF columns: **Description | Qty | Unit Price | VAT | Amount**
- Redistribute widths: Description=55, Qty=14, Unit Price=22, VAT=22, Amount=22 (total ~135mm).

### 3B. PDF: Bank details page break
- **`src/lib/generate-invoice-pdf.ts`**: After `autoTable` renders (~line 260), check if `lastAutoTable.finalY + 80 > pageH - 50`. If yes, call `doc.addPage()` and draw bank details at `y = 20` on the new page. Ensure bank details are always fully visible on their own page when content overflows.

### 3C. UI: Reorder Sales Code, remove Vehicle/Driver from trip invoices
- **`src/components/audit/GenerateInvoiceModal.tsx`** line items table columns become:
  **Description | Qty | Unit Price | Sales Code | VAT | Amount | Delete**
- Sales Code moves from between Qty/Unit Price to between Unit Price/VAT.
- Vehicle and Driver columns are removed from the UI table.
- Auto-fill of `item.vehicle` and `item.driver` from `vehicleassignments` still happens silently (saved to DB for export/audit), just not displayed.
- **`src/components/audit/SundryInvoiceModal.tsx`**: No vehicle/driver columns (already has none).

### 3D. Fix POD drag & drop (both modals)
- **`src/components/audit/GenerateInvoiceModal.tsx`** (~line 1197) and **`SundryInvoiceModal.tsx`** (~line 595):
  - Add `onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}`
  - Add `onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFiles(e.dataTransfer.files); }}`
  - Extract existing file processing into shared `handleFiles(files)` function.

### 3E. Move Add Line below Description bar
- **`src/components/audit/GenerateInvoiceModal.tsx`**: Move the "+ Add Line" button from above the table (line 1044) to below the last row of the line items table (before the summary section).

### 3F. Invoice preview before closing
- **`src/components/audit/GenerateInvoiceModal.tsx`**: After PDF is generated (finalize or edit with invoice number), instead of auto-closing:
  - Create a blob URL from the generated PDF
  - Show it in an `<iframe>` inside a preview overlay
  - User clicks "Close" to dismiss → then `onClose()` is called
  - For draft mode: show toast with "View PDF" link

---

## Phase 4: Edit Invoice — PDF Overwrite + DB Sync (2 changes)

### 4A. PDF regeneration on edit (overwrite original)
- **`src/components/audit/GenerateInvoiceModal.tsx`** (edit mode, lines 681-773): Already regenerates PDF for finalized invoices — verify upload path is `invoices/{invoiceNumber}.pdf` (same path = overwrite). Confirm `invoice_url` is updated in PATCH.

### 4B. Full DB field sync on edit
- **`src/components/audit/GenerateInvoiceModal.tsx`**: Ensure edit PATCH body includes ALL fields: `lineItems`, `invoiceData` (full blob), `salesCode`, `subtotal`, `vatAmount`, `totalAmount`, `amountDue`, `currency`, `referenceNumber`, `customerName`, `customerAddress`, `customerVat`, `invoiceDate`, `dueDate`.

---

## Files Changed

| # | File | Changes |
|---|---|---|
| 1 | `src/app/(protected)/clients/page.tsx` | Delete buttons for clients + stops |
| 2 | `src/components/ui/client-form-dialog.tsx` | pod_required toggle + reorder invoice email section |
| 3 | `src/app/api/eps-client-list/route.js` | DELETE handler + pod_required field |
| 4 | `src/app/(protected)/audit/page.tsx` | Trip columns, unified invoices, search panels |
| 5 | `src/components/audit/GenerateInvoiceModal.tsx` | Reorder Sales Code, remove Vehicle/Driver, drag-drop, Add Line position, preview, edit PDF sync |
| 6 | `src/components/audit/SundryInvoiceModal.tsx` | Drag-drop fix |
| 7 | `src/lib/generate-invoice-pdf.ts` | Remove internal columns from PDF, bank details page break |
| 8 | `supabase/migrations/20260907_add_pod_required.sql` | New migration |

## Migration
```sql
ALTER TABLE public.eps_client_list ADD COLUMN IF NOT EXISTS pod_required BOOLEAN DEFAULT false;
```

---

## Progress Tracker

- [ ] 1A. Migration: pod_required column
- [ ] 1B. pod_required toggle in client form
- [ ] 1C. Delete client + delete stop
- [ ] 1D. Move Invoice Contact Emails to top
- [ ] 2A. Trip Invoices: created_at, vehicle, driver columns
- [ ] 2B. Unified Invoices tab
- [ ] 2C. Drafts tab search
- [ ] 2D. Invoices tab search
- [ ] 3A. PDF: remove internal columns
- [ ] 3B. PDF: bank details page break
- [ ] 3C. UI: reorder Sales Code, remove Vehicle/Driver
- [ ] 3D. Fix POD drag & drop
- [ ] 3E. Move Add Line below Description
- [ ] 3F. Invoice preview before closing
- [ ] 4A. PDF regeneration on edit
- [ ] 4B. Full DB field sync on edit
- [ ] Build + verify
