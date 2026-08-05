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

    const { data: auditData, error: auditError } = await supabase
      .from('audit')
      .update(updateData)
      .eq('id', Number(id))
      .select()
      .single();

    if (auditError) {
      console.error('Failed to mark audit invoiced:', auditError);
      return NextResponse.json({ error: auditError.message }, { status: 500 });
    }

    // 2. Create invoice_documents row if it doesn't exist
    const { data: existingDoc } = await supabase
      .from('invoice_documents')
      .select('id')
      .eq('audit_id', Number(id))
      .single();

    if (!existingDoc) {
      const { error: docError } = await supabase
        .from('invoice_documents')
        .insert([{
          audit_id: Number(id),
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

    return NextResponse.json({ success: true, audit: auditData });
  } catch (err) {
    console.error('Mark invoiced error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
