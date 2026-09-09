type InvoiceEmailData = {
  orderNumber: string
  customerName: string
  amount: string
  currency: string
  invoiceDate: string
  invoicePdfUrl: string
  isCreditNote?: boolean
  attachments?: { name: string; url: string }[]
}

export function buildInvoiceEmailHtml(data: InvoiceEmailData): string {
  const { orderNumber, customerName, amount, currency, invoiceDate, invoicePdfUrl, isCreditNote, attachments } = data
  const amountLabel = isCreditNote ? 'Credit Amount' : 'Amount Due'

  const attachmentRows = (attachments || []).filter(a => a && a.name && a.url).map(a =>
    `<tr>
      <td style="padding: 6px 4px;">
        <a href="${a.url}" style="display: inline-block; background: #0C1E3D; color: #ffffff; padding: 8px 14px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 12px;">Download: ${a.name}</a>
      </td>
    </tr>`
  ).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8f6f2; font-family: 'Segoe UI', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #ece6dc; border-radius: 12px; overflow: hidden;">
    
    <!-- Top gradient bar -->
    <div style="width: 100%; height: 8px; background: linear-gradient(to right, #0C1E3D, #E79B54, #0C1E3D);"></div>
    
    <!-- Header -->
    <div style="padding: 28px 24px 16px; text-align: center;">
      <img src="https://waterfordcarriers.online/waterford%20logo.png" alt="Waterford Carriers" style="height: 50px; margin-bottom: 8px;" />
      <h1 style="color: #0C1E3D; font-size: 24px; margin: 10px 0 0 0;">Waterford Carriers</h1>
      <p style="color: #5b6573; font-size: 13px; margin: 2px 0 0 0;">Fleet Operations Platform</p>
    </div>

    <!-- Body -->
    <div style="padding: 0 24px 24px;">
      <h2 style="color: #0C1E3D; font-size: 18px; margin: 0 0 16px 0; text-align: center;">${isCreditNote ? 'Credit Note Notification' : 'Invoice Notification'}</h2>
      
      <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
        Hello,
      </p>
      <p style="color: #374151; font-size: 14px; margin: 0 0 20px 0;">
        A new ${isCreditNote ? 'credit note' : 'invoice'} has been generated for the following trip. Please find the details below.
      </p>

      <!-- Trip Details Card -->
      <div style="background: #f8f6f2; padding: 18px; margin: 0 0 20px 0; border-radius: 10px; border-left: 4px solid #E79B54;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
<tr>
            <td style="padding: 6px 0; color: #5b6573;">Order Number</td>
            <td style="padding: 6px 0; color: #1f2937; font-weight: 600;">${orderNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #5b6573;">Client</td>
            <td style="padding: 6px 0; color: #1f2937; font-weight: 600;">${customerName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #5b6573;">Address</td>
            <td style="padding: 6px 0; color: #1f2937;">96 Cavaleros Drive<br>Industries West<br>Germiston, 1401<br>SOUTH AFRICA</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #5b6573;">Invoice Date</td>
            <td style="padding: 6px 0; color: #1f2937;">${invoiceDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #5b6573; border-top: 1px solid #e5e7eb;">${amountLabel}</td>
            <td style="padding: 6px 0; color: #0C1E3D; font-weight: 800; font-size: 16px; border-top: 1px solid #e5e7eb;">${currency} ${amount}</td>
          </tr>
        </table>
      </div>

      <!-- Download Button -->
      <div style="text-align: center; margin: 20px 0;">
        <a href="${invoicePdfUrl}" style="display: inline-block; background: #0C1E3D; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">Download ${isCreditNote ? 'Credit Note' : 'Invoice'}</a>
      </div>

      ${attachmentRows ? `
      <!-- Attached Documents -->
      <div style="background: #f8f6f2; padding: 14px 16px; margin: 0 0 20px 0; border-radius: 10px; border-left: 4px solid #0C1E3D;">
        <p style="color: #0C1E3D; font-size: 14px; font-weight: 700; margin: 0 0 10px 0;">Attached Documents</p>
        <table style="width: 100%; border-collapse: collapse;">
          ${attachmentRows}
        </table>
      </div>` : ''}

      <p style="color: #9ca3af; font-size: 12px; margin: 20px 0 0 0; text-align: center;">
        If you have any questions, please contact us at <a href="mailto:debtors@waterfordcarriers.co.za" style="color: #E79B54;">debtors@waterfordcarriers.co.za</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background: linear-gradient(135deg, #0C1E3D 0%, #15305f 65%, #E79B54 100%); padding: 20px; text-align: center;">
      <p style="font-size: 12px; color: #ffffff; margin: 0;">
        This is an automated message from Waterford Carriers.<br>
        &copy; ${new Date().getFullYear()} Waterford Carriers. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`
}
