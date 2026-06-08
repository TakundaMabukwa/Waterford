"use client"

import React from 'react'

export interface LoadconPrintData {
  orderNumber?: string
  loadType?: string
  customerReference?: string
  bookingRef?: string
  loadDate?: string
  customerName?: string
  collectionAddress?: string
  delivery?: string
  vessel?: string
  weight?: string
  containerNumber?: string
  containerSize?: string
  collectedBy?: string
  deliveredBy?: string
  zone?: string
  emptyTN?: string
  notes?: string
  completedBy?: string
  invoiceNo?: string
  rate?: string
  financeDate?: string
  capturedBy?: string
  cartageFees?: string
  offloadingFees?: string
  standingTime?: string
  borderFees?: string
  reloading?: string
  other?: string
}

function Barcode({ value }: { value: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <svg
        width="200"
        height="50"
        viewBox="0 0 200 50"
        xmlns="http://www.w3.org/2000/svg"
      >
        {value.split('').map((char, i) => (
          <rect
            key={i}
            x={i * 8 + 10}
            y="0"
            width={char.charCodeAt(0) % 2 === 0 ? 4 : 2}
            height="40"
            fill="black"
          />
        ))}
        <text x="100" y="48" textAnchor="middle" fontSize="10" fontFamily="monospace">
          {value}
        </text>
      </svg>
    </div>
  )
}

export function LoadconPrint({ data }: { data: LoadconPrintData }) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#000', maxWidth: '800px', margin: '0 auto' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .loadcon-print-area, .loadcon-print-area * { visibility: visible; }
          .loadcon-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      {/* Header */}
      <div className="loadcon-print-area" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333', letterSpacing: '2px' }}>
                WATERFORD
              </div>
              <div style={{ fontSize: '14px', color: '#666', letterSpacing: '1px', marginTop: '-4px' }}>
                carriers
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Barcode value={data.orderNumber || 'WC000000'} />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, letterSpacing: '1px' }}>
            CUSTOMER LOADCON
          </h2>
        </div>

        {/* Main Loadcon Table - Red Border */}
        <div style={{ border: '2px solid #dc2626', padding: '2px', marginBottom: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <tbody>
              <tr>
                <td style={{ ...labelStyle, width: '150px' }}>Load Type:</td>
                <td style={valueStyle}>{data.loadType || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Customer Reference:</td>
                <td style={valueStyle}>{data.customerReference || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Booking Ref:</td>
                <td style={{ ...valueStyle, backgroundColor: '#fef9c3' }}>{data.bookingRef || data.orderNumber || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Load Date:</td>
                <td style={valueStyle}>{data.loadDate || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Customer Name:</td>
                <td style={valueStyle}>{data.customerName || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Collection Address:</td>
                <td style={valueStyle}>{data.collectionAddress || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Delivery:</td>
                <td style={valueStyle}>{data.delivery || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Vessel:</td>
                <td style={valueStyle}>{data.vessel || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Weight:</td>
                <td style={valueStyle}>{data.weight || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Container Number:</td>
                <td style={valueStyle}>{data.containerNumber || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Container Size:</td>
                <td style={valueStyle}>{data.containerSize || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Collected By:</td>
                <td style={valueStyle}>{data.collectedBy || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Delivered By:</td>
                <td style={valueStyle}>{data.deliveredBy || 'Waterford'}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Zone:</td>
                <td style={valueStyle}>{data.zone || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Empty T/N:</td>
                <td style={valueStyle}>{data.emptyTN || ''}</td>
              </tr>
              <tr>
                <td style={{ ...labelStyle, verticalAlign: 'top' }}>Notes:</td>
                <td style={{ ...valueStyle, minHeight: '60px', height: '60px' }}>{data.notes || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Completed By:</td>
                <td style={valueStyle}>{data.completedBy || ''}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Finance Details - Green Border */}
        <div style={{ border: '2px solid #16a34a', padding: '2px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 10px 5px' }}>Finance Details</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <tbody>
              <tr>
                <td style={{ ...labelStyle, width: '120px' }}>Invoice No:</td>
                <td style={{ ...valueStyle, width: '30%' }}>{data.invoiceNo || ''}</td>
                <td style={{ ...labelStyle, width: '120px' }}>Rate:</td>
                <td style={valueStyle}>{data.rate || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Date:</td>
                <td style={valueStyle}>{data.financeDate || ''}</td>
                <td style={labelStyle}>Captured By:</td>
                <td style={valueStyle}>{data.capturedBy || ''}</td>
              </tr>
            </tbody>
          </table>

          {/* Crossborder Section */}
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '15px 0 10px 5px' }}>Crossborder</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <tbody>
              <tr>
                <td style={{ ...labelStyle, width: '120px' }}>Cartage Fees:</td>
                <td style={{ ...valueStyle, width: '30%' }}>{data.cartageFees || ''}</td>
                <td style={{ ...labelStyle, width: '120px' }}>Offloading Fees:</td>
                <td style={valueStyle}>{data.offloadingFees || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Standing Time:</td>
                <td style={valueStyle}>{data.standingTime || ''}</td>
                <td style={labelStyle}>Border Fees:</td>
                <td style={valueStyle}>{data.borderFees || ''}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Re-Loading:</td>
                <td style={valueStyle}>{data.reloading || ''}</td>
                <td style={labelStyle}>Other:</td>
                <td style={valueStyle}>{data.other || ''}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  padding: '6px 10px',
  backgroundColor: '#e5e7eb',
  fontWeight: 'bold',
  border: '1px solid #d1d5db',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
}

const valueStyle: React.CSSProperties = {
  padding: '6px 10px',
  backgroundColor: '#fff',
  border: '1px solid #d1d5db',
}
