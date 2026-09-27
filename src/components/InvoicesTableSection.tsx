import * as React from 'react';
import { useState, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Download, 
  Eye, 
  Edit3, 
  Trash2, 
  Phone, 
  ShoppingBag, 
  Calendar, 
  Clock, 
  User, 
  Store, 
  ChevronDown,
  ChevronUp,
  Tag,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  CreditCard,
  Banknote,
  Layers,
  Sparkles,
  RefreshCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Invoice, Customer, Product, UserProfile } from '../types';

interface InvoicesTableSectionProps {
  invoices: Invoice[];
  allInvoices?: Invoice[];
  customers: Customer[];
  products: Product[];
  allUsers: UserProfile[];
  profile: UserProfile | null;
  onSelectInvoice: (invoice: Invoice) => void;
  onEditInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoice: Invoice) => void;
  canEditInvoice?: boolean;
  canDeleteInvoice?: boolean;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (val: string) => void;
  onEndDateChange?: (val: string) => void;
  customerFilter?: string;
  onCustomerFilterChange?: (val: string) => void;
  selectedRepId?: string;
  onSelectedRepIdChange?: (val: string) => void;
  canFilterRep?: boolean;
  representatives?: { uid: string; name: string }[];
}

type SortField = 
  | 'date' 
  | 'time' 
  | 'id' 
  | 'customerName' 
  | 'representativeName' 
  | 'paymentType'
  | 'subtotal' 
  | 'discountValue' 
  | 'net' 
  | 'credit' 
  | 'collection' 
  | 'totalPaidToday' 
  | 'customerBalanceAfter'
  | 'itemsCount';

type SortOrder = 'asc' | 'desc';

type PaymentTypeFilter = 'all' | 'full_paid' | 'credit' | 'collection_only' | 'partial';

export default function InvoicesTableSection({
  invoices,
  allInvoices,
  customers,
  products,
  allUsers,
  profile,
  onSelectInvoice,
  onEditInvoice,
  onDeleteInvoice,
  canEditInvoice = false,
  canDeleteInvoice = false,
  showToast,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  customerFilter = '',
  onCustomerFilterChange,
  selectedRepId = '',
  onSelectedRepIdChange,
  canFilterRep = false,
  representatives = []
}: InvoicesTableSectionProps) {
  const [tableSearch, setTableSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<PaymentTypeFilter>('all');
  const [customerSearchInput, setCustomerSearchInput] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('invoice_table_compact') === 'true';
    } catch {
      return false;
    }
  });

  // Map customer details for fast lookup
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  // Precompute customer running balances for all invoices in history
  const invoiceBalanceMap = useMemo(() => {
    const map = new Map<string, number>();
    const fullInvoicesList = allInvoices && allInvoices.length > 0 ? allInvoices : invoices;

    // Group invoices by customerId
    const customerInvoicesMap = new Map<string, Invoice[]>();
    fullInvoicesList.forEach(inv => {
      if (!inv.customerId) return;
      const list = customerInvoicesMap.get(inv.customerId) || [];
      list.push(inv);
      customerInvoicesMap.set(inv.customerId, list);
    });

    customerInvoicesMap.forEach((custInvs, custId) => {
      const cust = customerMap.get(custId);
      const currentCustBalance = Number(cust?.openingBalance) || 0;

      // Sort invoices chronologically (oldest first)
      const sortedCustInvs = [...custInvs].sort((a, b) => {
        const timeA = `${a.date || ''} ${a.time || ''}`;
        const timeB = `${b.date || ''} ${b.time || ''}`;
        return timeA.localeCompare(timeB);
      });

      // Calculate total delta from all invoices
      const totalDelta = sortedCustInvs.reduce((acc, inv) => {
        return acc + (Number(inv.credit) || 0) - (Number(inv.collection) || 0);
      }, 0);

      // Base balance before any recorded invoice in the list
      let runningBal = currentCustBalance - totalDelta;

      sortedCustInvs.forEach((inv) => {
        if (inv.customerBalanceAfter !== undefined && inv.customerBalanceAfter !== null && !isNaN(Number(inv.customerBalanceAfter))) {
          runningBal = Number(inv.customerBalanceAfter);
        } else {
          runningBal += (Number(inv.credit) || 0) - (Number(inv.collection) || 0);
        }
        if (inv.id) {
          map.set(inv.id, runningBal);
        }
      });
    });

    return map;
  }, [allInvoices, invoices, customerMap]);

  // Helper to safely get the running balance for an invoice
  const getInvoiceCustomerBalanceAfter = (inv: Invoice): number => {
    if (inv.id && invoiceBalanceMap.has(inv.id)) {
      return invoiceBalanceMap.get(inv.id)!;
    }
    if (inv.customerBalanceAfter !== undefined && inv.customerBalanceAfter !== null && !isNaN(Number(inv.customerBalanceAfter))) {
      return Number(inv.customerBalanceAfter);
    }
    const cust = customerMap.get(inv.customerId);
    return Number(cust?.openingBalance) || 0;
  };

  // Helper to determine the invoice's nature / payment type
  const getInvoiceTypeInfo = (inv: Invoice) => {
    const invSub = Number(inv.subtotal) || 0;
    const invDisc = inv.discountType === 'percentage' 
      ? (invSub * (Number(inv.discountValue) || 0)) / 100 
      : (Number(inv.discountValue) || 0);
    const invNet = Math.max(0, invSub - invDisc);
    const invCredit = Number(inv.credit) || 0;
    const invCollection = Number(inv.collection) || 0;
    const invPaid = Number(inv.totalPaidToday) || 0;

    // Cases:
    // 1. Only collection (No goods sold, just collecting old debt)
    if (invNet === 0 && invCollection > 0) {
      return {
        key: 'collection_only',
        label: 'تحصيل ديون فقط',
        shortLabel: 'تحصيل فقط',
        badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
        desc: 'لا توجد بضاعة جديدة - دفعة من حساب سابق',
        icon: Banknote
      };
    }

    // 2. Fully on credit (No payment today, full net is credit)
    if (invNet > 0 && invCredit >= invNet && invPaid === 0) {
      return {
        key: 'full_credit',
        label: 'فاتورة آجل بالكامل',
        shortLabel: 'آجل بالكامل',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        desc: 'تم تسجيل كامل الصافي كدين آجل',
        icon: AlertCircle
      };
    }

    // 3. Paid in Full (Cash / Wallet equal to or exceeding net with 0 credit)
    if (invNet > 0 && invCredit <= 0 && invPaid >= invNet) {
      return {
        key: 'full_paid',
        label: 'مدفوعة بالكامل نقداً',
        shortLabel: 'مدفوعة كاملة',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        desc: 'تم سداد كامل قيمة البضاعة اليوم',
        icon: CheckCircle2
      };
    }

    // 4. Partial Cash + Credit
    if (invNet > 0 && invCredit > 0 && invPaid > 0) {
      return {
        key: 'partial',
        label: 'مدفوعة جزئياً + آجل',
        shortLabel: 'دفعة + آجل',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        desc: `سداد جزئي (${invPaid} ج.م) والباقي (${invCredit} ج.م) آجل`,
        icon: CreditCard
      };
    }

    // 5. Normal cash / settlement
    if (invPaid > 0) {
      return {
        key: 'full_paid',
        label: 'مدفوعة اليوم',
        shortLabel: 'مدفوعة',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        desc: 'تم سداد المبلغ المطلوب',
        icon: CheckCircle2
      };
    }

    return {
      key: 'credit',
      label: 'آجل',
      shortLabel: 'آجل',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
      desc: 'متبقي على العميل',
      icon: AlertCircle
    };
  };

  // Filter invoices by table search query and payment type
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Payment Type Filter
      if (paymentTypeFilter !== 'all') {
        const typeInfo = getInvoiceTypeInfo(inv);
        if (paymentTypeFilter === 'full_paid' && typeInfo.key !== 'full_paid') return false;
        if (paymentTypeFilter === 'credit' && typeInfo.key !== 'full_credit' && typeInfo.key !== 'credit') return false;
        if (paymentTypeFilter === 'collection_only' && typeInfo.key !== 'collection_only') return false;
        if (paymentTypeFilter === 'partial' && typeInfo.key !== 'partial') return false;
      }

      // Text Search Filter
      if (!tableSearch.trim()) return true;
      const query = tableSearch.toLowerCase().trim();

      const cust = customerMap.get(inv.customerId);
      const custName = (inv.customerName || cust?.shopName || '').toLowerCase();
      const ownerName = (cust?.ownerName || '').toLowerCase();
      const area = (cust?.area || '').toLowerCase();
      const repName = (inv.representativeName || '').toLowerCase();
      const id = (inv.id || '').toLowerCase();
      const phone = (cust?.phone || '').toLowerCase();
      const typeInfo = getInvoiceTypeInfo(inv);

      // Search in items product names
      const itemsMatch = inv.items?.some(i => (i.productName || '').toLowerCase().includes(query));

      return (
        custName.includes(query) ||
        ownerName.includes(query) ||
        area.includes(query) ||
        repName.includes(query) ||
        id.includes(query) ||
        phone.includes(query) ||
        typeInfo.label.toLowerCase().includes(query) ||
        typeInfo.shortLabel.toLowerCase().includes(query) ||
        itemsMatch
      );
    });
  }, [invoices, tableSearch, customerMap, paymentTypeFilter]);

  // Sort invoices
  const sortedInvoices = useMemo(() => {
    return [...filteredInvoices].sort((a, b) => {
      let aVal: any = 0;
      let bVal: any = 0;

      switch (sortField) {
        case 'id':
          aVal = a.id || '';
          bVal = b.id || '';
          break;
        case 'date':
          aVal = a.date || '';
          bVal = b.date || '';
          break;
        case 'time':
          aVal = `${a.date || ''} ${a.time || ''}`;
          bVal = `${b.date || ''} ${b.time || ''}`;
          break;
        case 'customerName':
          aVal = a.customerName || '';
          bVal = b.customerName || '';
          break;
        case 'representativeName':
          aVal = a.representativeName || '';
          bVal = b.representativeName || '';
          break;
        case 'paymentType':
          aVal = getInvoiceTypeInfo(a).label;
          bVal = getInvoiceTypeInfo(b).label;
          break;
        case 'subtotal':
          aVal = Number(a.subtotal) || 0;
          bVal = Number(b.subtotal) || 0;
          break;
        case 'discountValue':
          aVal = Number(a.discountValue) || 0;
          bVal = Number(b.discountValue) || 0;
          break;
        case 'net': {
          const aDiscount = a.discountType === 'percentage' ? (a.subtotal * (a.discountValue || 0)) / 100 : (a.discountValue || 0);
          const bDiscount = b.discountType === 'percentage' ? (b.subtotal * (b.discountValue || 0)) / 100 : (b.discountValue || 0);
          aVal = (a.subtotal || 0) - aDiscount;
          bVal = (b.subtotal || 0) - bDiscount;
          break;
        }
        case 'credit':
          aVal = Number(a.credit) || 0;
          bVal = Number(b.credit) || 0;
          break;
        case 'collection':
          aVal = Number(a.collection) || 0;
          bVal = Number(b.collection) || 0;
          break;
        case 'totalPaidToday':
          aVal = Number(a.totalPaidToday) || 0;
          bVal = Number(b.totalPaidToday) || 0;
          break;
        case 'customerBalanceAfter':
          aVal = getInvoiceCustomerBalanceAfter(a);
          bVal = getInvoiceCustomerBalanceAfter(b);
          break;
        case 'itemsCount': {
          aVal = a.items?.reduce((s, i) => s + (Number(i.sold) || 0), 0) || 0;
          bVal = b.items?.reduce((s, i) => s + (Number(i.sold) || 0), 0) || 0;
          break;
        }
        default:
          aVal = a.date || '';
          bVal = b.date || '';
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal, 'ar') 
          : bVal.localeCompare(aVal, 'ar');
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredInvoices, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filtered customer list for the customer search bar
  const searchedCustomers = useMemo(() => {
    if (!customerSearchInput) return customers;
    const q = customerSearchInput.toLowerCase();
    return customers.filter(c => 
      c.shopName.toLowerCase().includes(q) || 
      c.ownerName.toLowerCase().includes(q) || 
      c.area.toLowerCase().includes(q)
    );
  }, [customers, customerSearchInput]);

  // Selected customer object if any
  const selectedCustomerObj = useMemo(() => {
    if (!customerFilter) return null;
    return customers.find(c => c.id === customerFilter) || null;
  }, [customers, customerFilter]);

  // Calculate totals
  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let net = 0;
    let credit = 0;
    let collection = 0;
    let totalPaid = 0;
    let totalSoldPieces = 0;
    let totalDamagedPieces = 0;
    let totalGiftPieces = 0;
    let totalWallet = 0;

    let fullPaidCount = 0;
    let creditCount = 0;
    let collectionOnlyCount = 0;
    let partialCount = 0;

    sortedInvoices.forEach(inv => {
      const invSub = Number(inv.subtotal) || 0;
      const invDisc = inv.discountType === 'percentage' 
        ? (invSub * (Number(inv.discountValue) || 0)) / 100 
        : (Number(inv.discountValue) || 0);
      const invNet = invSub - invDisc;
      const invCredit = Number(inv.credit) || 0;
      const invCollection = Number(inv.collection) || 0;
      const invPaid = Number(inv.totalPaidToday) || 0;
      const invWallet = Number(inv.walletAmount) || 0;

      subtotal += invSub;
      discount += invDisc;
      net += invNet;
      credit += invCredit;
      collection += invCollection;
      totalPaid += invPaid;
      totalWallet += invWallet;

      const typeInfo = getInvoiceTypeInfo(inv);
      if (typeInfo.key === 'full_paid') fullPaidCount++;
      else if (typeInfo.key === 'full_credit' || typeInfo.key === 'credit') creditCount++;
      else if (typeInfo.key === 'collection_only') collectionOnlyCount++;
      else if (typeInfo.key === 'partial') partialCount++;

      inv.items?.forEach(item => {
        totalSoldPieces += Number(item.sold) || 0;
        totalDamagedPieces += Number(item.returnDamaged) || 0;
        totalGiftPieces += Number(item.gifts) || 0;
      });
    });

    return {
      count: sortedInvoices.length,
      subtotal,
      discount,
      net,
      credit,
      collection,
      totalPaid,
      totalSoldPieces,
      totalDamagedPieces,
      totalGiftPieces,
      totalWallet,
      fullPaidCount,
      creditCount,
      collectionOnlyCount,
      partialCount
    };
  }, [sortedInvoices]);

  // Export Table to Excel
  const handleExportTable = () => {
    try {
      const data = sortedInvoices.map((inv, idx) => {
        const cust = customerMap.get(inv.customerId);
        const invSub = Number(inv.subtotal) || 0;
        const invDisc = inv.discountType === 'percentage' 
          ? (invSub * (Number(inv.discountValue) || 0)) / 100 
          : (Number(inv.discountValue) || 0);
        const invNet = invSub - invDisc;
        const typeInfo = getInvoiceTypeInfo(inv);

        const soldPieces = inv.items?.reduce((s, i) => s + (Number(i.sold) || 0), 0) || 0;
        const damagedPieces = inv.items?.reduce((s, i) => s + (Number(i.returnDamaged) || 0), 0) || 0;
        const giftPieces = inv.items?.reduce((s, i) => s + (Number(i.gifts) || 0), 0) || 0;

        const itemsSummary = inv.items?.map(i => `${i.productName} (مباع: ${i.sold || 0}${i.returnDamaged ? `، تالف: ${i.returnDamaged}` : ''}${i.gifts ? `، هدايا: ${i.gifts}` : ''})`).join(' | ') || '';

        return {
          'م': idx + 1,
          'رقم الفاتورة': inv.id,
          'التاريخ': inv.date,
          'الوقت': inv.time,
          'اسم المحل / العميل': inv.customerName || cust?.shopName || '',
          'صاحب المحل': cust?.ownerName || '',
          'المنطقة': cust?.area || '',
          'تليفون العميل': cust?.phone || '',
          'المندوب': inv.representativeName || '',
          'نوع المعاملة / الدفع': typeInfo.label,
          'إجمالي قطع المباع': soldPieces,
          'إجمالي قطع التالف': damagedPieces,
          'إجمالي قطع الهدايا': giftPieces,
          'تفاصيل البضاعة': itemsSummary,
          'الإجمالي الفرعي (ج.م)': invSub,
          'قيمة الخصم (ج.م)': invDisc,
          'نوع الخصم': inv.discountType === 'percentage' ? `${inv.discountValue}%` : 'مبلغ ثابت',
          'الصافي بعد الخصم (ج.م)': invNet,
          'الآجل / المتبقي (ج.م)': Number(inv.credit) || 0,
          'تحصيل ديون سابقة (ج.م)': Number(inv.collection) || 0,
          'مدفوع المحفظة (ج.م)': Number(inv.walletAmount) || 0,
          'إجمالي المدفوع اليوم (ج.م)': Number(inv.totalPaidToday) || 0,
          'رصيد العميل بعد الفاتورة (ج.م)': getInvoiceCustomerBalanceAfter(inv)
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "جدول_الفواتير_المفصل");
      
      const fileName = `جدول_الفواتير_${startDate || 'الكل'}_إلى_${endDate || 'الكل'}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showToast('تم تصدير جدول الفواتير إلى إكسيل بنجاح', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('فشل في تصدير جدول الفواتير', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. PRIMARY DATE RANGE & CUSTOMER FILTER PANEL */}
      <div className="bg-gradient-to-r from-blue-50/80 via-white to-blue-50/50 p-4 sm:p-5 rounded-3xl border-2 border-blue-100 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="text-primary" size={20} />
          <h3 className="font-bold text-base text-ink">فلاتر البحث وتتبع المعاملات</h3>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Start Date (من) */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-black text-blue-700 uppercase tracking-widest px-1 flex items-center gap-1">
              <span>من تاريخ:</span>
            </label>
            <div className="relative">
              <input 
                type="date" 
                value={startDate || ''}
                onChange={(e) => onStartDateChange?.(e.target.value)}
                className="w-full bg-white px-3.5 py-2.5 rounded-xl border-2 border-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-ink shadow-xs"
              />
            </div>
          </div>

          {/* End Date (إلى) */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-black text-blue-700 uppercase tracking-widest px-1 flex items-center gap-1">
              <span>إلى تاريخ:</span>
            </label>
            <div className="relative">
              <input 
                type="date" 
                value={endDate || ''}
                onChange={(e) => onEndDateChange?.(e.target.value)}
                className="w-full bg-white px-3.5 py-2.5 rounded-xl border-2 border-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-ink shadow-xs"
              />
            </div>
          </div>

          {/* Customer Filter Dropdown / Autocomplete */}
          <div className="flex flex-col gap-1 relative">
            <label className="text-[11px] font-black text-blue-700 uppercase tracking-widest px-1 flex items-center justify-between">
              <span>تحديد عميل معين:</span>
              {customerFilter && (
                <button
                  onClick={() => {
                    onCustomerFilterChange?.('');
                    setCustomerSearchInput('');
                  }}
                  className="text-rose-500 hover:text-rose-700 text-[10px] lowercase font-bold"
                >
                  إلغاء التحديد
                </button>
              )}
            </label>
            <div className="relative">
              <input 
                type="text"
                placeholder="ابحث عن اسم المحل / العميل..."
                value={customerSearchInput || (selectedCustomerObj?.shopName ?? '')}
                onChange={(e) => {
                  setCustomerSearchInput(e.target.value);
                  setShowCustomerDropdown(true);
                  if (e.target.value === '') {
                    onCustomerFilterChange?.('');
                  }
                }}
                onFocus={() => {
                  setCustomerSearchInput('');
                  setShowCustomerDropdown(true);
                }}
                className="w-full bg-white px-3.5 py-2.5 rounded-xl border-2 border-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-ink shadow-xs"
              />

              {showCustomerDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border-2 border-blue-100 max-h-60 overflow-y-auto z-50 custom-scrollbar">
                  <button 
                    onClick={() => {
                      onCustomerFilterChange?.('');
                      setCustomerSearchInput('');
                      setShowCustomerDropdown(false);
                    }}
                    className="w-full text-right px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-blue-50 transition-colors border-b border-blue-50"
                  >
                    عرض كل العملاء
                  </button>
                  {searchedCustomers.map(c => (
                    <button 
                      key={c.id}
                      onClick={() => {
                        onCustomerFilterChange?.(c.id);
                        setCustomerSearchInput(c.shopName);
                        setShowCustomerDropdown(false);
                      }}
                      className="w-full text-right px-4 py-2.5 text-xs font-bold text-ink hover:bg-blue-50 transition-colors border-b border-blue-50 last:border-0"
                    >
                      <div className="font-bold text-ink flex items-center justify-between">
                        <span>{c.shopName}</span>
                        <span className="text-[10px] text-primary font-mono">{c.area}</span>
                      </div>
                      <div className="text-[10px] text-secondary/60 mt-0.5">{c.ownerName} {c.phone ? `• ${c.phone}` : ''}</div>
                    </button>
                  ))}
                  {searchedCustomers.length === 0 && (
                    <div className="px-4 py-3 text-xs text-secondary/50 text-center">لا توجد نتائج</div>
                  )}
                </div>
              )}
            </div>

            {showCustomerDropdown && (
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowCustomerDropdown(false)}
              />
            )}
          </div>

          {/* Representative Filter */}
          {canFilterRep ? (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-blue-700 uppercase tracking-widest px-1">المندوب:</label>
              <select 
                value={selectedRepId || ''}
                onChange={(e) => onSelectedRepIdChange?.(e.target.value)}
                className="w-full bg-white px-3.5 py-2.5 rounded-xl border-2 border-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-ink shadow-xs"
              >
                <option value="">كل المناديب</option>
                {representatives.map(rep => (
                  <option key={rep.uid} value={rep.uid}>{rep.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black text-blue-700 uppercase tracking-widest px-1">نوع المعاملة / الدفع:</label>
              <select 
                value={paymentTypeFilter}
                onChange={(e) => setPaymentTypeFilter(e.target.value as PaymentTypeFilter)}
                className="w-full bg-white px-3.5 py-2.5 rounded-xl border-2 border-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-ink shadow-xs"
              >
                <option value="all">كل المعاملات (الكل)</option>
                <option value="full_paid">مدفوعة كاملة نقداً</option>
                <option value="credit">آجل / متبقي دين</option>
                <option value="partial">دفعة نقدية + آجل</option>
                <option value="collection_only">تحصيل ديون سابقة فقط</option>
              </select>
            </div>
          )}
        </div>

        {/* Customer Focused Banner if single customer selected */}
        {selectedCustomerObj && (
          <div className="bg-blue-600 text-white p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg">
                🏪
              </div>
              <div>
                <div className="font-black text-sm flex items-center gap-2">
                  <span>تسلسل معاملات العميل: {selectedCustomerObj.shopName}</span>
                  <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-md">{selectedCustomerObj.area}</span>
                </div>
                <div className="text-xs text-blue-100 mt-0.5">
                  صاحب المحل: {selectedCustomerObj.ownerName} | تليفون: {selectedCustomerObj.phone || 'غير مسجل'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold bg-black/10 px-4 py-2 rounded-xl">
              <div>
                <span className="opacity-80">الرصيد الافتتاحي: </span>
                <span className="font-mono">{Number(selectedCustomerObj.openingBalance || 0).toLocaleString()} ج.م</span>
              </div>
              <span className="opacity-40">|</span>
              <div>
                <span className="opacity-80">عدد فواتير الفترة: </span>
                <span className="text-yellow-300 font-mono text-sm">{sortedInvoices.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. STAT CARDS SUMMARY BANNER */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-blue-50/80 border border-blue-100 p-4 rounded-2xl shadow-xs">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-0.5">عدد الفواتير</p>
          <p className="text-xl font-black text-ink">{totals.count} <span className="text-xs font-normal text-secondary/60">فاتورة</span></p>
        </div>

        <div className="bg-emerald-50/80 border border-emerald-100 p-4 rounded-2xl shadow-xs">
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-0.5">إجمالي المبيعات (الفرعي)</p>
          <p className="text-xl font-black text-emerald-700">{totals.subtotal.toLocaleString()} <span className="text-xs font-normal">ج.م</span></p>
        </div>

        <div className="bg-rose-50/80 border border-rose-100 p-4 rounded-2xl shadow-xs">
          <p className="text-[10px] font-black text-rose-600 uppercase tracking-wider mb-0.5">إجمالي الخصومات</p>
          <p className="text-xl font-black text-rose-700">{totals.discount.toLocaleString()} <span className="text-xs font-normal">ج.م</span></p>
        </div>

        <div className="bg-amber-50/80 border border-amber-100 p-4 rounded-2xl shadow-xs">
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-0.5">إجمالي الآجل (المتبقي)</p>
          <p className="text-xl font-black text-amber-700">{totals.credit.toLocaleString()} <span className="text-xs font-normal">ج.م</span></p>
        </div>

        <div className="bg-teal-50/80 border border-teal-100 p-4 rounded-2xl shadow-xs">
          <p className="text-[10px] font-black text-teal-600 uppercase tracking-wider mb-0.5">تحصيل ديون سابقة</p>
          <p className="text-xl font-black text-teal-700">{totals.collection.toLocaleString()} <span className="text-xs font-normal">ج.م</span></p>
        </div>

        <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl shadow-xs">
          <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-0.5">إجمالي المحصل نقداً</p>
          <p className="text-xl font-black text-primary">{totals.totalPaid.toLocaleString()} <span className="text-xs font-normal">ج.م</span></p>
        </div>
      </div>

      {/* 3. TABLE TOOLBAR & TRANSACTION TYPE CHIPS */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-blue-100 shadow-xs">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
          <input
            type="text"
            placeholder="بحث (رقم الفاتورة، العميل، المندوب، الصنف، نوع الدفع)..."
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {tableSearch && (
            <button 
              onClick={() => setTableSearch('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-secondary/50 hover:text-ink font-bold"
            >
              مسح
            </button>
          )}
        </div>

        {/* Quick Filter Pill Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto justify-start md:justify-center">
          <button
            onClick={() => setPaymentTypeFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              paymentTypeFilter === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل ({totals.count})
          </button>
          <button
            onClick={() => setPaymentTypeFilter('full_paid')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              paymentTypeFilter === 'full_paid'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            مدفوعة كاملة ({totals.fullPaidCount})
          </button>
          <button
            onClick={() => setPaymentTypeFilter('credit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              paymentTypeFilter === 'credit'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            آجل ({totals.creditCount})
          </button>
          <button
            onClick={() => setPaymentTypeFilter('partial')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              paymentTypeFilter === 'partial'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            دفعة + آجل ({totals.partialCount})
          </button>
          <button
            onClick={() => setPaymentTypeFilter('collection_only')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              paymentTypeFilter === 'collection_only'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200'
            }`}
          >
            تحصيل فقط ({totals.collectionOnlyCount})
          </button>
        </div>

        {/* Action Buttons & Compact View Toggle */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
          {/* Compact View Checkbox */}
          <label 
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all select-none text-xs font-bold border shadow-2xs ${
              isCompactMode 
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                : 'bg-blue-50/90 hover:bg-blue-100/90 text-blue-900 border-blue-200'
            }`}
            title="إخفاء الأعمدة الثانوية وإبقاء (التاريخ، العميل، الصافي، الآجل، التحصيل، المحصل اليوم، الرصيد بعد المعاملة)"
          >
            <input
              type="checkbox"
              checked={isCompactMode}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsCompactMode(checked);
                try {
                  localStorage.setItem('invoice_table_compact', String(checked));
                } catch {}
              }}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
            />
            <span className="flex items-center gap-1.5">
              <Sparkles size={13} className={isCompactMode ? 'text-yellow-300' : 'text-blue-600'} />
              <span>عرض مختصر للجدول</span>
            </span>
          </label>

          <span className="text-xs text-secondary/60 font-bold hidden lg:inline">
            عرض {sortedInvoices.length} من {invoices.length}
          </span>
          <button
            onClick={handleExportTable}
            disabled={sortedInvoices.length === 0}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Download size={15} />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* 4. MAIN INVOICES TABLE */}
      <div className="bg-white rounded-3xl border-2 border-blue-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className={`w-full text-right border-collapse text-xs ${isCompactMode ? 'min-w-[720px]' : 'min-w-[1200px]'}`}>
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 via-slate-50 to-blue-50/50 border-b-2 border-blue-100 text-ink/80 font-black select-none">
                <th className="p-3.5 text-center w-10 text-secondary/60">#</th>
                
                {/* Invoice ID (hidden in compact mode) */}
                {!isCompactMode && (
                  <th 
                    onClick={() => handleSort('id')}
                    className="p-3.5 cursor-pointer hover:text-primary transition-colors text-right whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5 justify-start">
                      <span>رقم الفاتورة</span>
                      {sortField === 'id' ? (sortOrder === 'asc' ? <ArrowUp size={13} className="text-primary" /> : <ArrowDown size={13} className="text-primary" />) : <ArrowUpDown size={13} className="opacity-30" />}
                    </div>
                  </th>
                )}

                {/* Date & Time */}
                <th 
                  onClick={() => handleSort('time')}
                  className="p-3.5 cursor-pointer hover:text-primary transition-colors text-right whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>التاريخ والوقت</span>
                    {sortField === 'time' ? (sortOrder === 'asc' ? <ArrowUp size={13} className="text-primary" /> : <ArrowDown size={13} className="text-primary" />) : <ArrowUpDown size={13} className="opacity-30" />}
                  </div>
                </th>

                {/* Customer */}
                <th 
                  onClick={() => handleSort('customerName')}
                  className="p-3.5 cursor-pointer hover:text-primary transition-colors text-right whitespace-nowrap min-w-[170px]"
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>اسم العميل / المحل</span>
                    {sortField === 'customerName' ? (sortOrder === 'asc' ? <ArrowUp size={13} className="text-primary" /> : <ArrowDown size={13} className="text-primary" />) : <ArrowUpDown size={13} className="opacity-30" />}
                  </div>
                </th>

                {/* Secondary Columns (hidden in compact mode) */}
                {!isCompactMode && (
                  <>
                    <th 
                      onClick={() => handleSort('paymentType')}
                      className="p-3.5 cursor-pointer hover:text-primary transition-colors text-center whitespace-nowrap min-w-[140px]"
                    >
                      <div className="flex items-center gap-1.5 justify-center">
                        <span>طبيعة المعاملة / الدفع</span>
                        {sortField === 'paymentType' ? (sortOrder === 'asc' ? <ArrowUp size={13} className="text-primary" /> : <ArrowDown size={13} className="text-primary" />) : <ArrowUpDown size={13} className="opacity-30" />}
                      </div>
                    </th>

                    <th 
                      onClick={() => handleSort('representativeName')}
                      className="p-3.5 cursor-pointer hover:text-primary transition-colors text-right whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1.5 justify-start">
                        <span>المندوب</span>
                        {sortField === 'representativeName' ? (sortOrder === 'asc' ? <ArrowUp size={13} className="text-primary" /> : <ArrowDown size={13} className="text-primary" />) : <ArrowUpDown size={13} className="opacity-30" />}
                      </div>
                    </th>

                    <th 
                      onClick={() => handleSort('itemsCount')}
                      className="p-3.5 cursor-pointer hover:text-primary transition-colors text-center whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1.5 justify-center">
                        <span>الأصناف والقطع</span>
                        {sortField === 'itemsCount' ? (sortOrder === 'asc' ? <ArrowUp size={13} className="text-primary" /> : <ArrowDown size={13} className="text-primary" />) : <ArrowUpDown size={13} className="opacity-30" />}
                      </div>
                    </th>

                    <th 
                      onClick={() => handleSort('subtotal')}
                      className="p-3.5 cursor-pointer hover:text-primary transition-colors text-right whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1.5 justify-end">
                        <span>إجمالي البضاعة</span>
                        {sortField === 'subtotal' ? (sortOrder === 'asc' ? <ArrowUp size={13} className="text-primary" /> : <ArrowDown size={13} className="text-primary" />) : <ArrowUpDown size={13} className="opacity-30" />}
                      </div>
                    </th>

                    <th 
                      onClick={() => handleSort('discountValue')}
                      className="p-3.5 cursor-pointer hover:text-primary transition-colors text-right whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1.5 justify-end">
                        <span>الالخصم</span>
                        {sortField === 'discountValue' ? (sortOrder === 'asc' ? <ArrowUp size={13} className="text-primary" /> : <ArrowDown size={13} className="text-primary" />) : <ArrowUpDown size={13} className="opacity-30" />}
                      </div>
                    </th>
                  </>
                )}

                {/* Net */}
                <th 
                  onClick={() => handleSort('net')}
                  className="p-3.5 cursor-pointer hover:text-primary transition-colors text-right whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>الصافي</span>
                    {sortField === 'net' ? (sortOrder === 'asc' ? <ArrowUp size={13} className="text-primary" /> : <ArrowDown size={13} className="text-primary" />) : <ArrowUpDown size={13} className="opacity-30" />}
                  </div>
                </th>

                {/* Credit */}
                <th 
                  onClick={() => handleSort('credit')}
                  className="p-3.5 cursor-pointer hover:text-primary transition-colors text-right whitespace-nowrap bg-rose-50/40 text-rose-800"
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>الآجل (المتبقي)</span>
                    {sortField === 'credit' ? (sortOrder === 'asc' ? <ArrowUp size={13} className="text-primary" /> : <ArrowDown size={13} className="text-primary" />) : <ArrowUpDown size={13} className="opacity-30" />}
                  </div>
                </th>

                {/* Collection */}
                <th 
                  onClick={() => handleSort('collection')}
                  className="p-3.5 cursor-pointer hover:text-primary transition-colors text-right whitespace-nowrap bg-teal-50/40 text-teal-800"
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>التحصيل</span>
                    {sortField === 'collection' ? (sortOrder === 'asc' ? <ArrowUp size={13} className="text-primary" /> : <ArrowDown size={13} className="text-primary" />) : <ArrowUpDown size={13} className="opacity-30" />}
                  </div>
                </th>

                {/* Total Paid Today */}
                <th 
                  onClick={() => handleSort('totalPaidToday')}
                  className="p-3.5 cursor-pointer hover:text-primary transition-colors text-right whitespace-nowrap bg-primary/5 text-primary"
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>المحصل اليوم</span>
                    {sortField === 'totalPaidToday' ? (sortOrder === 'asc' ? <ArrowUp size={13} className="text-primary" /> : <ArrowDown size={13} className="text-primary" />) : <ArrowUpDown size={13} className="opacity-30" />}
                  </div>
                </th>

                {/* Customer Balance After */}
                <th 
                  onClick={() => handleSort('customerBalanceAfter')}
                  className="p-3.5 cursor-pointer hover:text-primary transition-colors text-right whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>رصيد العميل بعدها</span>
                    {sortField === 'customerBalanceAfter' ? (sortOrder === 'asc' ? <ArrowUp size={13} className="text-primary" /> : <ArrowDown size={13} className="text-primary" />) : <ArrowUpDown size={13} className="opacity-30" />}
                  </div>
                </th>

                {/* Actions */}
                <th className="p-3.5 text-center whitespace-nowrap sticky left-0 bg-slate-50/95 backdrop-blur-xs shadow-xs">
                  الإجراءات
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-blue-50 font-medium">
              {sortedInvoices.map((inv, index) => {
                const cust = customerMap.get(inv.customerId);
                const invSub = Number(inv.subtotal) || 0;
                const invDisc = inv.discountType === 'percentage' 
                  ? (invSub * (Number(inv.discountValue) || 0)) / 100 
                  : (Number(inv.discountValue) || 0);
                const invNet = invSub - invDisc;
                const soldCount = inv.items?.reduce((s, i) => s + (Number(i.sold) || 0), 0) || 0;
                const damagedCount = inv.items?.reduce((s, i) => s + (Number(i.returnDamaged) || 0), 0) || 0;
                const giftsCount = inv.items?.reduce((s, i) => s + (Number(i.gifts) || 0), 0) || 0;
                const isExpanded = expandedRowId === inv.id;
                const typeInfo = getInvoiceTypeInfo(inv);
                const TypeIcon = typeInfo.icon;

                return (
                  <React.Fragment key={inv.id}>
                    <tr 
                      className={`hover:bg-blue-50/40 transition-colors group ${isExpanded ? 'bg-blue-50/60' : ''}`}
                    >
                      {/* Index */}
                      <td className="p-3 text-center text-secondary/50 font-mono text-[11px]">
                        {index + 1}
                      </td>

                      {/* Invoice ID (hidden in compact mode) */}
                      {!isCompactMode && (
                        <td className="p-3 text-right">
                          <span 
                            onClick={() => onSelectInvoice(inv)}
                            className="font-mono font-bold text-[11px] text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-900 px-2 py-1 rounded-md cursor-pointer transition-all inline-block"
                            title="عرض تفاصيل الفاتورة"
                          >
                            #{inv.id ? inv.id.slice(-6).toUpperCase() : '---'}
                          </span>
                        </td>
                      )}

                      {/* Date & Time */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-ink text-[11px] flex items-center gap-1">
                            <Calendar size={11} className="text-secondary/40" />
                            {inv.date}
                          </span>
                          <span className="text-[10px] text-secondary/60 flex items-center gap-1 font-mono">
                            <Clock size={10} className="text-secondary/40" />
                            {inv.time}
                          </span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="p-3 text-right">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <Store size={13} className="text-primary/70 shrink-0" />
                            <span 
                              onClick={() => {
                                onCustomerFilterChange?.(inv.customerId);
                                setCustomerSearchInput(inv.customerName || cust?.shopName || '');
                              }}
                              className="font-black text-ink text-[12px] hover:text-primary cursor-pointer hover:underline"
                              title="انقر لفلترة وعرض كشف حساب هذا العميل"
                            >
                              {inv.customerName || cust?.shopName || 'عميل غير مسجل'}
                            </span>
                          </div>
                          {(cust?.area || cust?.ownerName || cust?.phone) && (
                            <div className="text-[10px] text-secondary/70 flex items-center gap-2 flex-wrap">
                              {cust.ownerName && <span>{cust.ownerName}</span>}
                              {cust.area && <span className="bg-slate-100 px-1.5 py-0.2 rounded text-[9px] font-bold text-slate-700">{cust.area}</span>}
                              {cust.phone && (
                                <a 
                                  href={`tel:${cust.phone}`} 
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-green-600 hover:underline flex items-center gap-0.5 font-mono"
                                >
                                  <Phone size={9} />
                                  {cust.phone}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Secondary Columns (hidden in compact mode) */}
                      {!isCompactMode && (
                        <>
                          {/* Payment / Transaction Type Badge */}
                          <td className="p-3 text-center whitespace-nowrap">
                            <span 
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border ${typeInfo.badgeClass}`}
                              title={typeInfo.desc}
                            >
                              <TypeIcon size={12} />
                              <span>{typeInfo.shortLabel}</span>
                            </span>
                          </td>

                          {/* Representative */}
                          <td className="p-3 text-right whitespace-nowrap">
                            <span className="font-bold text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded-lg text-[11px] inline-flex items-center gap-1">
                              <User size={11} className="text-secondary/50" />
                              {inv.representativeName || 'غير محدد'}
                            </span>
                          </td>

                          {/* Items & Pieces */}
                          <td className="p-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => setExpandedRowId(isExpanded ? null : inv.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 rounded-lg text-[11px] font-bold transition-all"
                              title="عرض تفاصيل الأصناف"
                            >
                              <ShoppingBag size={12} className="text-blue-500" />
                              <span>{soldCount} مباع</span>
                              {damagedCount > 0 && <span className="text-red-500 font-bold">({damagedCount} تالف)</span>}
                              {giftsCount > 0 && <span className="text-emerald-500 font-bold">({giftsCount} هدية)</span>}
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </td>

                          {/* Subtotal */}
                          <td className="p-3 text-right font-bold text-slate-800 whitespace-nowrap">
                            {invSub.toLocaleString()} <span className="text-[10px] text-secondary/60">ج.م</span>
                          </td>

                          {/* Discount */}
                          <td className="p-3 text-right whitespace-nowrap">
                            {invDisc > 0 ? (
                              <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded-md text-[11px]">
                                -{invDisc.toLocaleString()} ج.م
                                {inv.discountType === 'percentage' && <span className="text-[9px] mr-1 opacity-70">({inv.discountValue}%)</span>}
                              </span>
                            ) : (
                              <span className="text-secondary/40 font-mono">-</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Net */}
                      <td className="p-3 text-right font-black text-ink whitespace-nowrap">
                        {invNet.toLocaleString()} <span className="text-[10px] text-secondary/60">ج.م</span>
                      </td>

                      {/* Credit */}
                      <td className="p-3 text-right whitespace-nowrap bg-rose-50/20">
                        {Number(inv.credit) > 0 ? (
                          <span className="text-rose-700 font-black bg-rose-100/80 px-2 py-0.5 rounded-md text-[11px]">
                            {Number(inv.credit).toLocaleString()} ج.م
                          </span>
                        ) : (
                          <span className="text-secondary/40 font-mono">-</span>
                        )}
                      </td>

                      {/* Collection */}
                      <td className="p-3 text-right whitespace-nowrap bg-teal-50/20">
                        {Number(inv.collection) > 0 ? (
                          <span className="text-teal-700 font-bold bg-teal-100/80 px-2 py-0.5 rounded-md text-[11px]">
                            +{Number(inv.collection).toLocaleString()} ج.م
                          </span>
                        ) : (
                          <span className="text-secondary/40 font-mono">-</span>
                        )}
                      </td>

                      {/* Total Paid Today */}
                      <td className="p-3 text-right whitespace-nowrap bg-primary/5">
                        <div className="flex flex-col items-end">
                          <span className="font-black text-primary text-[13px]">
                            {(Number(inv.totalPaidToday) || 0).toLocaleString()} <span className="text-[10px]">ج.م</span>
                          </span>
                          {inv.walletAmount && inv.walletAmount > 0 && (
                            <span className="text-[9px] text-indigo-600 font-bold flex items-center gap-0.5">
                              📱 محفظة: {inv.walletAmount.toLocaleString()} {inv.isWalletConfirmed ? '✓' : '(معلقة)'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer Balance After */}
                      <td className="p-3 text-right whitespace-nowrap font-mono font-bold text-[11px]">
                        {(() => {
                          const bal = getInvoiceCustomerBalanceAfter(inv);
                          if (bal > 0) {
                            return (
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block font-mono">
                                {bal.toLocaleString()} ج.م <span className="text-[9px] font-sans font-bold text-amber-800">(عليه)</span>
                              </span>
                            );
                          } else if (bal < 0) {
                            return (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block font-mono">
                                {Math.abs(bal).toLocaleString()} ج.م <span className="text-[9px] font-sans font-bold text-emerald-800">(له)</span>
                              </span>
                            );
                          } else {
                            return (
                              <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded inline-block font-mono">
                                0 ج.م <span className="text-[9px] font-sans font-bold text-slate-500">(خالص)</span>
                              </span>
                            );
                          }
                        })()}
                      </td>

                      {/* Actions Column */}
                      <td className="p-3 text-center whitespace-nowrap sticky left-0 bg-white/95 backdrop-blur-xs shadow-xs">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onSelectInvoice(inv)}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 hover:text-blue-800 rounded-lg transition-all active:scale-95"
                            title="معاينة وطباعة الفاتورة"
                          >
                            <Eye size={15} />
                          </button>

                          {canEditInvoice && onEditInvoice && (
                            <button
                              onClick={() => onEditInvoice(inv)}
                              className="p-1.5 text-amber-600 hover:bg-amber-100 hover:text-amber-800 rounded-lg transition-all active:scale-95"
                              title="تعديل الفاتورة"
                            >
                              <Edit3 size={15} />
                            </button>
                          )}

                          {canDeleteInvoice && onDeleteInvoice && (
                            <button
                              onClick={() => onDeleteInvoice(inv)}
                              className="p-1.5 text-red-500 hover:bg-red-100 hover:text-red-700 rounded-lg transition-all active:scale-95"
                              title="حذف الفاتورة"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Items Details Sub-Row */}
                    {isExpanded && (
                      <tr className="bg-blue-50/30 border-b-2 border-blue-100">
                        <td colSpan={isCompactMode ? 9 : 15} className="p-4">
                          <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-blue-50 pb-2">
                              <h4 className="font-bold text-xs text-blue-900 flex items-center gap-1.5">
                                <ShoppingBag size={14} className="text-primary" />
                                <span>تفاصيل أصناف الفاتورة (#{inv.id ? inv.id.slice(-6).toUpperCase() : ''})</span>
                              </h4>
                              <span className="text-[11px] text-secondary/70">
                                عدد الأصناف: {inv.items?.length || 0} صنف
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-right text-xs">
                                <thead>
                                  <tr className="text-secondary/70 border-b border-slate-100 text-[10px]">
                                    <th className="py-2 px-3">الصنف</th>
                                    <th className="py-2 px-3 text-center">سعر الوحدة</th>
                                    <th className="py-2 px-3 text-center">المباع</th>
                                    <th className="py-2 px-3 text-center">تالف</th>
                                    <th className="py-2 px-3 text-center">هدايا</th>
                                    <th className="py-2 px-3 text-right">الإجمالي</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-medium">
                                  {inv.items?.map((item, iIdx) => (
                                    <tr key={iIdx} className="hover:bg-slate-50/50">
                                      <td className="py-2 px-3 font-bold text-ink">{item.productName}</td>
                                      <td className="py-2 px-3 text-center font-mono">{Number(item.price || 0).toLocaleString()} ج.م</td>
                                      <td className="py-2 px-3 text-center font-bold text-blue-700 bg-blue-50/50 rounded">{item.sold || 0}</td>
                                      <td className="py-2 px-3 text-center text-red-600 font-bold">{item.returnDamaged || 0}</td>
                                      <td className="py-2 px-3 text-center text-emerald-600 font-bold">{item.gifts || 0}</td>
                                      <td className="py-2 px-3 text-right font-black text-ink font-mono">{Number(item.total || 0).toLocaleString()} ج.م</td>
                                    </tr>
                                  ))}
                                  {(!inv.items || inv.items.length === 0) && (
                                    <tr>
                                      <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                                        لا توجد تفاصيل أصناف لهذه الفاتورة (قد تكون حركة تحصيل ديون سابقة فقط).
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {sortedInvoices.length === 0 && (
                <tr>
                  <td colSpan={15} className="p-16 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText size={36} className="text-slate-300 stroke-1" />
                      <p className="text-sm font-bold text-slate-600">لا توجد فواتير مطابقة لمعايير البحث والتاريخ الحالية</p>
                      <p className="text-xs text-slate-400">جرب تغيير الفترة الزمنية أو إزالة فلاتر البحث والعملاء</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
