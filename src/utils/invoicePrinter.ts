import { Invoice, Customer, Settings } from '../types';

export const printInvoiceReceipt = (
  invoice: Partial<Invoice>,
  customer?: Partial<Customer> | null,
  settings?: Partial<Settings> | null,
  isThermal: boolean = true
) => {
  if (typeof document === 'undefined') return;

  // Cleanup any lingering temp print elements
  const oldEl = document.getElementById('temp-print-element');
  const oldSt = document.getElementById('temp-print-styles');
  if (oldEl) oldEl.remove();
  if (oldSt) oldSt.remove();

  const companyPhone = settings?.companyPhone 
    ? `<p style="font-size:12px;font-weight:900;margin:2px 0;">تليفون الشركة: ${settings.companyPhone}</p>` 
    : '';
  const customerPhone = customer?.phone 
    ? `<div style="display:flex;justify-content:space-between;"><span style="font-weight:900;">تليفون العميل:</span><span style="font-weight:900;">${customer.phone}</span></div>` 
    : '';

  const activeItems = (invoice.items || []).filter((it: any) => (it.sold || 0) > 0 || (it.returnDamaged || 0) > 0 || (it.gifts || 0) > 0);
  const hasDamaged = activeItems.some((x: any) => (x.returnDamaged || 0) > 0);
  const hasGifts = activeItems.some((x: any) => (x.gifts || 0) > 0);
  const damagedTotal = activeItems.reduce((acc: number, it: any) => acc + ((it.returnDamaged || 0) * (it.price || 0)), 0);
  const giftsTotal = activeItems.reduce((acc: number, it: any) => acc + ((it.gifts || 0) * (it.price || 0)), 0);
  const balanceAfter = invoice.customerBalanceAfter !== undefined ? invoice.customerBalanceAfter : (customer ? customer.openingBalance : 0);

  const itemsRows = activeItems.map((it: any) => `
    <tr style="border-bottom:1px solid #000;">
      <td style="padding:5px 2px;font-size:12px;font-weight:900;white-space:nowrap;">${it.productName}</td>
      <td style="padding:5px 2px;text-align:center;font-size:12px;font-weight:900;">${it.price}</td>
      <td style="padding:5px 2px;text-align:center;font-size:12px;font-weight:900;">${it.sold || 0}</td>
      ${hasDamaged ? `<td style="padding:5px 2px;text-align:center;font-size:12px;font-weight:900;">${it.returnDamaged || 0}</td>` : ''}
      ${hasGifts ? `<td style="padding:5px 2px;text-align:center;font-size:12px;font-weight:900;">${it.gifts || 0}</td>` : ''}
      <td style="padding:5px 2px;text-align:left;font-size:12px;font-weight:900;">${(it.total || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  const container = document.createElement('div');
  container.id = 'temp-print-element';
  container.dir = 'rtl';
  container.innerHTML = `
    <div style="width:100%;max-width:576px;margin:0 auto;padding:10px;font-family:monospace;color:#000;background:#fff;border:3px solid #000;box-sizing:border-box;direction:rtl;text-align:right;">
      <div style="text-align:center;margin-bottom:10px;border-bottom:3px solid #000;padding-bottom:8px;">
        <h2 style="font-size:26px;font-weight:950;margin:0 0 4px 0;">شركة OK</h2>
        <p style="font-size:11px;font-weight:950;margin:0 0 3px 0;letter-spacing:2px;">نظام الإدارة المتكامل</p>
        ${companyPhone}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:13px;font-weight:950;border-bottom:3px solid #000;padding-bottom:6px;">
        <span>فاتورة مبيعات</span>
        <span>ID: ${(invoice.id || '').slice(-8).toUpperCase()}</span>
      </div>

      <div style="margin-bottom:10px;font-size:12px;border-bottom:3px solid #000;padding-bottom:8px;line-height:1.6;">
        <div style="display:flex;justify-content:space-between;"><span style="font-weight:950;">العميل:</span><span style="font-weight:950;">${invoice.customerName}</span></div>
        ${customerPhone}
        <div style="display:flex;justify-content:space-between;"><span style="font-weight:950;">المندوب:</span><span style="font-weight:950;">${invoice.representativeName}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="font-weight:950;">التاريخ:</span><span style="font-weight:950;">${invoice.date} | ${invoice.time}</span></div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;text-align:right;">
        <thead>
          <tr style="border-bottom:3px solid #000;">
            <th style="padding:5px 2px;font-size:11px;font-weight:950;">المنتج</th>
            <th style="padding:5px 2px;text-align:center;font-size:11px;font-weight:950;">السعر</th>
            <th style="padding:5px 2px;text-align:center;font-size:11px;font-weight:950;">عدد</th>
            ${hasDamaged ? `<th style="padding:5px 2px;text-align:center;font-size:11px;font-weight:950;">تالف</th>` : ''}
            ${hasGifts ? `<th style="padding:5px 2px;text-align:center;font-size:11px;font-weight:950;">هدايا</th>` : ''}
            <th style="padding:5px 2px;text-align:left;font-size:11px;font-weight:950;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div style="border-top:3px solid #000;padding-top:8px;font-size:12px;font-weight:950;line-height:1.7;">
        <div style="display:flex;justify-content:space-between;"><span>المجموع الفرعي</span><span>${(invoice.subtotal || 0).toLocaleString()} ج.م</span></div>
        ${hasDamaged ? `<div style="display:flex;justify-content:space-between;"><span>قيمة المرتجع</span><span>-${damagedTotal.toLocaleString()} ج.م</span></div>` : ''}
        ${hasGifts ? `<div style="display:flex;justify-content:space-between;"><span>قيمة الهدايا</span><span>+${giftsTotal.toLocaleString()} ج.م</span></div>` : ''}
        ${(invoice.discountValue || 0) > 0 ? `<div style="display:flex;justify-content:space-between;"><span>الخصم</span><span>-${invoice.discountValue} ${invoice.discountType === 'percentage' ? '%' : 'ج.م'}</span></div>` : ''}
        ${(invoice.credit || 0) > 0 ? `<div style="display:flex;justify-content:space-between;"><span>آجل (مديونية)</span><span>-${invoice.credit} ج.م</span></div>` : ''}
        ${(invoice.collection || 0) > 0 ? `<div style="display:flex;justify-content:space-between;"><span>تحصيل (سداد قديم)</span><span>+${(invoice.collection || 0).toLocaleString()} ج.م</span></div>` : ''}
        ${(invoice.walletAmount || 0) > 0 ? `<div style="display:flex;justify-content:space-between;border-top:1px solid #000;padding-top:4px;"><span>تحويل محفظة</span><span>${(invoice.walletAmount || 0).toLocaleString()} ج.م</span></div>` : ''}
        
        <div style="border-top:3px solid #000;margin-top:8px;padding-top:8px;">
          <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:950;">
            <span>الرصيد النهائي للعميل</span>
            <span style="text-decoration:underline;">${(balanceAfter || 0).toLocaleString()} ج.م</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:950;margin-top:4px;">
            <span>المحصل اليوم</span>
            <span style="text-decoration:underline;">${(invoice.totalPaidToday || 0).toLocaleString()} ج.م</span>
          </div>
        </div>
      </div>

      <div style="text-align:center;margin-top:14px;padding-top:8px;border-top:1px dashed #000;font-size:12px;font-weight:950;">
        شكراً لتعاملكم معنا
      </div>
    </div>
  `;

  const style = document.createElement('style');
  style.id = 'temp-print-styles';
  style.textContent = `
    #temp-print-element {
      direction: rtl !important;
      text-align: right !important;
    }
    @media screen {
      #temp-print-element {
        display: none !important;
      }
    }
    @media print {
      body > *:not(#temp-print-element) {
        display: none !important;
        height: 0 !important;
        overflow: hidden !important;
      }
      #temp-print-element {
        display: block !important;
        width: 80mm !important;
        max-width: 80mm !important;
        min-width: 80mm !important;
        margin: 0 !important;
        padding: 2mm 3mm !important;
        box-sizing: border-box !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: monospace !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      @page {
        margin: 0 !important;
        size: 80mm auto !important;
      }
      #temp-print-element * {
        visibility: visible !important;
        color: #000000 !important;
        font-weight: 950 !important;
        -webkit-text-stroke: 0.5px #000000 !important;
      }
    }
  `;

  document.body.appendChild(container);
  document.head.appendChild(style);

  const cleanup = () => {
    const el = document.getElementById('temp-print-element');
    const st = document.getElementById('temp-print-styles');
    if (el) el.remove();
    if (st) st.remove();
  };

  window.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 5000);
  }, 250);
};
