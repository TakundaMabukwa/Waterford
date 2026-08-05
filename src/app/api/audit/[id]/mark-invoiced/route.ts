import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    // 1. Update audit record
    const updateData: Record<string, any> = {
      is_invoiced: true,
      invoice_rate: body.invoiceRate ?? null,
      invoice_currency: body.invoiceCurrency ?? null,
      reference_number: body.referenceNumber ?? null,
      invoice_data: body.invoiceData ?? null,
    };
    if (body.invoiceUrl) {
      updateData.invoice_url = body.invoiceUrl;
    }

    // Try update by id first, fallback to trip_id
    let auditData = null
    let auditError = null
    let wroteToAudit = false

    if (id && id !== 'null' && !isNaN(Number(id))) {
      const result = await supabase
        .from('audit')
        .update(updateData)
        .eq('id', Number(id))
        .select()
        .single()
      auditData = result.data
      auditError = result.error
      wroteToAudit = !auditError
    } else if (body.tripId) {
      // No audit record exists (incomplete trip) — skip audit, write to trips only
      wroteToAudit = false
    }

    if (auditError) {
      console.error('Failed to mark audit invoiced:', auditError);
      return NextResponse.json({ error: auditError.message }, { status: 500 });
    }

    // 2. Update trips table (always — this is the source of truth for incomplete trips)
    if (body.tripId) {
      const tripUpdate: Record<string, any> = {
        is_invoiced: true,
        invoice_rate: body.invoiceRate ?? null,
        invoice_currency: body.invoiceCurrency ?? null,
        invoice_number: body.invoiceNumber || null,
        reference_number: body.referenceNumber ?? null,
        invoice_data: body.invoiceData ?? null,
        updated_at: new Date().toISOString(),
      };
      if (body.invoiceUrl) {
        tripUpdate.invoice_url = body.invoiceUrl;
      }
      const { error: tripError } = await supabase.from('trips').update(tripUpdate).eq('trip_id', body.tripId);
      if (tripError) {
        console.error('Failed to update trips table:', tripError);
      }
    }

    // 3. Create invoice_documents row if we wrote to audit
    const auditId = auditData?.id
    if (auditId) {
      const { data: existingDoc } = await supabase
        .from('invoice_documents')
        .select('id')
        .eq('audit_id', auditId)
        .single();

      if (!existingDoc) {
        const { error: docError } = await supabase
          .from('invoice_documents')
          .insert([{
            audit_id: auditId,
            trip_id: body.tripId || auditData.trip_id || '',
          ordernumber: body.ordernumber || auditData.ordernumber || '',
          invoice_number: body.invoiceNumber || '',
          documents: [],
          uploaded_by: body.uploadedBy || '',
        }]);

        if (docError) {
          console.error('Failed to create invoice_documents row:', docError);
        }
      }
    }

    return NextResponse.json({ success: true, audit: auditData });
  } catch (err) {
    console.error('Mark invoiced error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
