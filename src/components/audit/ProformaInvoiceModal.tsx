/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Download } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type Props = {
  open: boolean
  onClose: () => void
  record: any
}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const formatNum = (value: number) =>
  new Intl.NumberFormat('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

const formatDisplayDate = (isoDate: string) => {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function ProformaInvoiceModal({ open, onClose, record }: Props) {
  const [generating, setGenerating] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (open && record) {
      setInvoiceDate(new Date().toISOString().split('T')[0])
      setInvoiceNumber('')
    }
  }, [open, record])

  const generateProforma = async () => {
    if (!record) return

    setGenerating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const userEmail = user?.email || user?.user_metadata?.first_name || ''

      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 15
      const contentWidth = pageWidth - margin * 2

      const getClientName = () => {
        if (record.client_name) return record.client_name
        if (record.selectedclient) return record.selectedclient
        if (record.clientdetails) {
          try {
            const clientData = typeof record.clientdetails === 'string' ? JSON.parse(record.clientdetails) : record.clientdetails
            return clientData?.name || 'N/A'
          } catch { return 'N/A' }
        }
        return 'N/A'
      }

      const clientName = getClientName()

      // Waterford Logo
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 30, 66)
      doc.text('WATERFORD CARRIERS', pageWidth - margin, 20, { align: 'right' })

      // PROFORMA INVOICE title
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 30, 66)
      doc.text('PROFORMA INVOICE', margin, 20)

      // Invoice details
      let y = 30
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)

      const leftCol = margin
      const rightCol = pageWidth - margin - 60

      // Customer Details
      doc.setFont('helvetica', 'bold')
      doc.text('Customer Details:', leftCol, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.text(clientName, leftCol, y)
      y += 5
      doc.text(record.loading_point_company || record.loading_point_city || '', leftCol, y)

      // Invoice Details (right side)
      y = 30
      doc.setFont('helvetica', 'bold')
      doc.text('Invoice Details:', rightCol, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.text(`Invoice #: ${invoiceNumber || 'PENDING'}`, rightCol, y)
      y += 5
      doc.text(`Date: ${formatDisplayDate(invoiceDate)}`, rightCol, y)
      y += 5
      doc.text(`Order #: ${record.ordernumber || 'N/A'}`, rightCol, y)
      y += 5
      doc.text(`Status: PROFORMA`, rightCol, y)

      // Line Items Table
      y = 60
      doc.setFont('helvetica', 'bold')
      doc.text('Line Items', margin, y)
      y += 5

      const lineItems = [
        {
          description: `Trip ${record.ordernumber || 'N/A'} - ${record.origin || ''} to ${record.destination || ''}`,
          quantity: 1,
          unitPrice: Number(record.rate || 0),
          amount: Number(record.rate || 0)
        }
      ]

      const tableData = lineItems.map(item => [
        item.description,
        String(item.quantity),
        `R${formatNum(item.unitPrice)}`,
        `R${formatNum(item.amount)}`
      ])

      ;(doc as any).autoTable({
        startY: y,
        head: [['Description', 'Qty', 'Unit Price', 'Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [0, 30, 66], textColor: [255, 255, 255] },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 35, halign: 'right' },
          3: { cellWidth: 35, halign: 'right' }
        }
      })

      // Total
      const totalY = (doc as any).lastAutoTable.finalY + 10
      doc.setFont('helvetica', 'bold')
      doc.text('Total ZAR:', pageWidth - margin - 50, totalY)
      doc.text(`R${formatNum(lineItems[0].amount)}`, pageWidth - margin, totalY, { align: 'right' })

      // Footer
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text('This is a PROFORMA invoice - not a tax invoice.', margin, pageHeight - 20)
      doc.text('Generated by Waterford Carriers', margin, pageHeight - 15)

      const pdfBlob = doc.output('blob')
      const fileName = `proforma-${record.ordernumber || 'draft'}.pdf`
      
      // Download
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)

      onClose()
    } catch (error) {
      console.error('Error generating proforma invoice:', error)
    } finally {
      setGenerating(false)
    }
  }

  if (!record) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#001e42]">Generate Proforma Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>Order:</strong> {record.ordernumber || 'N/A'}
            </p>
            <p className="text-sm text-amber-800">
              <strong>Client:</strong> {record.client_name || record.selectedclient || 'N/A'}
            </p>
            <p className="text-sm text-amber-800">
              <strong>Route:</strong> {record.origin || 'N/A'} → {record.destination || 'N/A'}
            </p>
            <p className="text-sm text-amber-800">
              <strong>Rate:</strong> R{formatNum(Number(record.rate || 0))}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number</label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g., PROFORMA-001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={generateProforma}
              disabled={generating}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Proforma
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
