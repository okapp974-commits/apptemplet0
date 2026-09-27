import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Save, 
  Search, 
  AlertTriangle, 
  Info, 
  Plus, 
  Minus,
  Calendar,
  Store,
  UserCheck
} from 'lucide-react';
import { Invoice, Customer, Product, UserProfile } from '../types';
import { dataService } from '../services/dataService';

interface EditInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  customers: Customer[];
  products: Product[];
  allUsers?: UserProfile[];
  showToast: (message: string, type?: 'success' | 'error') => void;
  onSuccess?: () => void;
}

export default function EditInvoiceModal({
  isOpen,
  onClose,
  invoice,
  customers,
  products,
  allUsers = [],
  showToast,
  onSuccess
}: EditInvoiceModalProps) {
  const [items, setItems] = useState<Record<string, { sold: number; returnDamaged: number; gifts: number }>>({});
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState(0);
  const [credit, setCredit] = useState(0);
  const [collectionValue, setCollectionValue] = useState(0);
  const [walletAmount, setWalletAmount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Editable invoice header state
  const [invoiceDate, setInvoiceDate] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedRepId, setSelectedRepId] = useState('');

  // Available representatives list
  const reps = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      u.role === 'representative' || 
      u.role === 'backup_representative' || 
      u.uid === invoice?.representativeId
    );
  }, [allUsers, invoice]);

  // Initialize state when invoice is loaded
  useEffect(() => {
    if (invoice) {
      setInvoiceDate(invoice.date || '');
      setSelectedCustomerId(invoice.customerId || '');
      setSelectedRepId(invoice.representativeId || '');

      const initialItems: Record<string, { sold: number; returnDamaged: number; gifts: number }> = {};
      
      // Map existing invoice items
      invoice.items.forEach(item => {
        initialItems[item.productId] = {
          sold: item.sold || 0,
          returnDamaged: item.returnDamaged || 0,
          gifts: item.gifts || 0
        };
      });

      // Fill remaining products with zeros
      products.forEach(p => {
        if (!initialItems[p.id]) {
          initialItems[p.id] = { sold: 0, returnDamaged: 0, gifts: 0 };
        }
      });

      setItems(initialItems);
      setDiscountType(invoice.discountType || 'fixed');
      setDiscountValue(invoice.discountValue || 0);
      setCredit(invoice.credit || 0);
      setCollectionValue(invoice.collection || 0);
      setWalletAmount(invoice.walletAmount || 0);
    }
  }, [invoice, products]);

  if (!isOpen || !invoice) return null;

  const currentCustomer = customers.find(c => c.id === selectedCustomerId) || customers.find(c => c.id === invoice.customerId);

  // Filter and sort products
  const filteredProducts = products.filter(p => {
    const isAlreadyInInvoice = invoice.items.some(it => it.productId === p.id);
    // Don't show frozen products unless they are already in the invoice
    if (p.isFrozen && !isAlreadyInInvoice) {
      return false;
    }
    return p.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Calculate totals
  const subtotal = filteredProducts.reduce((acc, p) => {
    const item = items[p.id] || { sold: 0, returnDamaged: 0, gifts: 0 };
    return acc + (item.sold * (p.price || 0));
  }, 0);

  const returnsTotal = filteredProducts.reduce((acc, p) => {
    const item = items[p.id] || { sold: 0, returnDamaged: 0, gifts: 0 };
    return acc + (item.returnDamaged * (p.price || 0));
  }, 0);

  const giftsTotal = filteredProducts.reduce((acc, p) => {
    const item = items[p.id] || { sold: 0, returnDamaged: 0, gifts: 0 };
    return acc + (item.gifts * (p.price || 0));
  }, 0);

  const discountAmount = discountType === 'fixed' 
    ? discountValue 
    : (subtotal * discountValue / 100);

  const totalAfterDiscount = subtotal - returnsTotal - discountAmount;
  const totalPaidToday = totalAfterDiscount - credit + collectionValue;

  const updateItemValue = (productId: string, field: 'sold' | 'returnDamaged' | 'gifts', value: number) => {
    const safeValue = Math.max(0, value);
    setItems(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { sold: 0, returnDamaged: 0, gifts: 0 }),
        [field]: safeValue
      }
    }));
  };

  const handleSave = async () => {
    if (!currentCustomer) {
      showToast('خطأ: لم يتم العثور على بيانات العميل', 'error');
      return;
    }

    const selectedRep = allUsers?.find(u => u.uid === selectedRepId);
    const repName = selectedRep?.name || invoice.representativeName || 'غير محدد';

    const hasItems = Object.values(items).some((i: any) => i.sold > 0 || i.returnDamaged > 0 || i.gifts > 0);
    if (!hasItems && collectionValue <= 0) {
      showToast('لا يمكن حفظ الفاتورة فارغة بدون مبيعات أو تحصيل', 'error');
      return;
    }

    setSaving(true);
    try {
      const isCustomerChanged = selectedCustomerId !== invoice.customerId;
      const oldCustomer = customers.find(c => c.id === invoice.customerId);

      let newBalanceForInvoiceCustomer = 0;

      if (!isCustomerChanged) {
        // Calculate delta balance for customer
        const currentBalance = Number(currentCustomer.openingBalance) || 0;
        const oldCredit = Number(invoice.credit) || 0;
        const oldCollection = Number(invoice.collection) || 0;
        
        const revertedBalance = currentBalance - oldCredit + oldCollection;
        newBalanceForInvoiceCustomer = revertedBalance + credit - collectionValue;

        // Update customer balance in DB
        await dataService.updateCustomer(currentCustomer.id, {
          openingBalance: newBalanceForInvoiceCustomer
        });
      } else {
        // Customer changed: Revert old customer's balance & update new customer's balance
        if (oldCustomer) {
          const oldCustBalance = Number(oldCustomer.openingBalance) || 0;
          const oldCredit = Number(invoice.credit) || 0;
          const oldCollection = Number(invoice.collection) || 0;
          const revertedOldCustBalance = oldCustBalance - oldCredit + oldCollection;

          await dataService.updateCustomer(oldCustomer.id, {
            openingBalance: revertedOldCustBalance
          });
        }

        const newCustBalance = Number(currentCustomer.openingBalance) || 0;
        newBalanceForInvoiceCustomer = newCustBalance + credit - collectionValue;

        await dataService.updateCustomer(currentCustomer.id, {
          openingBalance: newBalanceForInvoiceCustomer
        });
      }

      const updatedInvoice: Invoice = {
        ...invoice,
        date: invoiceDate || invoice.date,
        customerId: currentCustomer.id,
        customerName: currentCustomer.shopName || currentCustomer.ownerName || 'بدون اسم',
        representativeId: selectedRepId || invoice.representativeId,
        representativeName: repName,
        items: products
          .map(p => {
            const item = items[p.id] || { sold: 0, returnDamaged: 0, gifts: 0 };
            return {
              productId: p.id,
              productName: p.name,
              price: Number(p.price) || 0,
              sold: Number(item.sold) || 0,
              returnDamaged: Number(item.returnDamaged) || 0,
              gifts: Number(item.gifts) || 0,
              total: Number(item.sold) * (Number(p.price) || 0)
            };
          })
          .filter(item => item.sold > 0 || item.returnDamaged > 0 || item.gifts > 0),
        subtotal,
        discountType,
        discountValue,
        credit,
        collection: collectionValue,
        totalPaidToday,
        walletAmount,
        customerBalanceAfter: newBalanceForInvoiceCustomer
      };

      await dataService.updateInvoice(invoice.id, updatedInvoice);

      // Send a notification about the invoice edit
      try {
        await dataService.createNotification(
          'تعديل فاتورة',
          `قام المدير بتعديل الفاتورة رقم ${invoice.id.slice(-8).toUpperCase()} (تاريخ: ${updatedInvoice.date}، العميل: ${updatedInvoice.customerName}، المندوب: ${updatedInvoice.representativeName}). القيمة الجديدة للمحصل اليوم: ${totalPaidToday.toLocaleString()} ج.م`,
          'invoice',
          updatedInvoice.representativeId,
          updatedInvoice.representativeName,
          'history'
        );
      } catch (e) {
        console.error('Failed to create notification:', e);
      }

      showToast('تم تعديل الفاتورة وتاريخها وبيانات العميل والمندوب بنجاح 🎉', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      showToast(`فشل تعديل الفاتورة: ${error.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
      <div className="bg-white w-full max-w-4xl h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-blue-50/10">
          <div>
            <h3 className="text-xl font-serif font-black text-ink flex items-center gap-2">
              تعديل الفاتورة رقم <span className="font-mono text-primary text-base">#{invoice.id.slice(-8).toUpperCase()}</span>
            </h3>
            <p className="text-xs text-secondary/60 mt-0.5">العميل الحالي: {invoice.customerName} • المندوب: {invoice.representativeName}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X size={20} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Editable Header Fields: Date, Customer, Representative */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <Info size={16} className="text-primary" />
              بيانات الفاتورة الأساسية (قابل للتعديل بواسطة المدير)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Invoice Date */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                  <Calendar size={13} className="text-slate-500" />
                  تاريخ الفاتورة:
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-primary text-right"
                />
              </div>

              {/* Customer Selection */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                  <Store size={13} className="text-slate-500" />
                  اسم العميل:
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-primary text-right"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shopName} {c.ownerName ? `(${c.ownerName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Representative Selection */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                  <UserCheck size={13} className="text-slate-500" />
                  المندوب المسؤول:
                </label>
                <select
                  value={selectedRepId}
                  onChange={(e) => setSelectedRepId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-primary text-right"
                >
                  {reps.length > 0 ? (
                    reps.map((r) => (
                      <option key={r.uid} value={r.uid}>
                        {r.name}
                      </option>
                    ))
                  ) : (
                    <option value={invoice.representativeId}>
                      {invoice.representativeName}
                    </option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Quick Alert */}
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs flex gap-2 font-bold leading-relaxed">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-amber-950">تنبيه تعديل الفاتورة:</p>
              <p className="mt-0.5 text-secondary/80 font-normal">تعديل الفاتورة يؤدي إلى إعادة حساب رصيد العميل بشكل تلقائي وفوري. سيتم خصم القيم القديمة للآجل والتحصيل وتطبيق القيم الجديدة عليها.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Products Selector */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-black text-slate-800">تعديل كميات المنتجات</h4>
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث سريع عن منتج..."
                    className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-primary focus:bg-white transition-all text-right"
                  />
                </div>
              </div>

              <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50 max-h-[45vh] overflow-y-auto custom-scrollbar">
                {filteredProducts.map(p => {
                  const item = items[p.id] || { sold: 0, returnDamaged: 0, gifts: 0 };
                  const isZero = item.sold === 0 && item.returnDamaged === 0 && item.gifts === 0;

                  return (
                    <div key={p.id} className={`p-4 transition-colors hover:bg-slate-50/50 ${!isZero ? 'bg-blue-50/10' : ''}`}>
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <span className="font-bold text-sm text-slate-900">{p.name}</span>
                          <span className="text-xs text-primary font-mono font-bold mr-2">({p.price} ج.م)</span>
                        </div>
                        {!isZero && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                            محدد بالفاتورة
                          </span>
                        )}
                      </div>

                      {/* Inputs Grid */}
                      <div className="grid grid-cols-3 gap-3">
                        {/* Sold Quantity */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-secondary block">عدد المباع</label>
                          <div className="flex items-center bg-slate-100 rounded-xl px-1">
                            <button
                              onClick={() => updateItemValue(p.id, 'sold', item.sold - 1)}
                              className="p-1 text-slate-500 hover:text-slate-800 active:scale-90"
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="number"
                              value={item.sold || ''}
                              onChange={(e) => updateItemValue(p.id, 'sold', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-full text-center bg-transparent border-0 font-bold text-xs text-slate-900 focus:outline-none"
                            />
                            <button
                              onClick={() => updateItemValue(p.id, 'sold', item.sold + 1)}
                              className="p-1 text-slate-500 hover:text-slate-800 active:scale-90"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Return Damaged */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-red-500 block">مرتجع تالف</label>
                          <div className="flex items-center bg-red-50/50 border border-red-100 rounded-xl px-1">
                            <button
                              onClick={() => updateItemValue(p.id, 'returnDamaged', item.returnDamaged - 1)}
                              className="p-1 text-red-500 hover:text-red-700 active:scale-90"
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="number"
                              value={item.returnDamaged || ''}
                              onChange={(e) => updateItemValue(p.id, 'returnDamaged', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-full text-center bg-transparent border-0 font-bold text-xs text-red-900 focus:outline-none"
                            />
                            <button
                              onClick={() => updateItemValue(p.id, 'returnDamaged', item.returnDamaged + 1)}
                              className="p-1 text-red-500 hover:text-red-700 active:scale-90"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Gifts */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-green-600 block">الهدايا</label>
                          <div className="flex items-center bg-green-50/50 border border-green-100 rounded-xl px-1">
                            <button
                              onClick={() => updateItemValue(p.id, 'gifts', item.gifts - 1)}
                              className="p-1 text-green-600 hover:text-green-800 active:scale-90"
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="number"
                              value={item.gifts || ''}
                              onChange={(e) => updateItemValue(p.id, 'gifts', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-full text-center bg-transparent border-0 font-bold text-xs text-green-900 focus:outline-none"
                            />
                            <button
                              onClick={() => updateItemValue(p.id, 'gifts', item.gifts + 1)}
                              className="p-1 text-green-600 hover:text-green-800 active:scale-90"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Financial Details */}
            <div className="lg:col-span-5 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-2">التفاصيل المالية</h4>

                {/* Discount */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-700">الخصم</label>
                    <div className="flex bg-white rounded-lg p-0.5 border border-slate-200 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setDiscountType('fixed')}
                        className={`px-2 py-1 rounded font-bold transition-all ${discountType === 'fixed' ? 'bg-primary text-white' : 'text-slate-600'}`}
                      >
                        مبلغ (ج.م)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('percentage')}
                        className={`px-2 py-1 rounded font-bold transition-all ${discountType === 'percentage' ? 'bg-primary text-white' : 'text-slate-600'}`}
                      >
                        نسبة (%)
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none text-right"
                  />
                </div>

                {/* Credit */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 block">آجل (مديونية الفاتورة)</label>
                  <input
                    type="number"
                    value={credit || ''}
                    onChange={(e) => setCredit(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none text-right"
                  />
                </div>

                {/* Collection */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 block">تحصيل (سداد قديم)</label>
                  <input
                    type="number"
                    value={collectionValue || ''}
                    onChange={(e) => setCollectionValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none text-right"
                  />
                </div>

                {/* Wallet Amount */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 block">تحويل محفظة (جزء من المحصل)</label>
                  <input
                    type="number"
                    value={walletAmount || ''}
                    onChange={(e) => setWalletAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none text-right"
                  />
                </div>
              </div>

              {/* Invoice calculation summary card */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>المجموع الفرعي:</span>
                  <span>{subtotal.toLocaleString()} ج.م</span>
                </div>
                {returnsTotal > 0 && (
                  <div className="flex justify-between text-xs font-bold text-red-600">
                    <span>قيمة المرتجع التالف:</span>
                    <span>-{returnsTotal.toLocaleString()} ج.م</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs font-bold text-red-500">
                    <span>قيمة الخصم:</span>
                    <span>-{discountAmount.toLocaleString()} ج.م</span>
                  </div>
                )}
                {credit > 0 && (
                  <div className="flex justify-between text-xs font-bold text-amber-600">
                    <span>الآجل (مديونية جديدة):</span>
                    <span>-{credit.toLocaleString()} ج.م</span>
                  </div>
                )}
                {collectionValue > 0 && (
                  <div className="flex justify-between text-xs font-bold text-green-600">
                    <span>التحصيل (سداد مديونية):</span>
                    <span>+{collectionValue.toLocaleString()} ج.م</span>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-2 flex justify-between text-sm font-black text-slate-900">
                  <span>المحصل اليوم:</span>
                  <span className="text-primary font-serif">{totalPaidToday.toLocaleString()} ج.م</span>
                </div>
              </div>

              {/* Customer Balance Projection */}
              {currentCustomer && (
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 text-[11px] space-y-1 font-bold text-slate-600">
                  <div className="flex justify-between">
                    <span>رصيد العميل المختار الحالي:</span>
                    <span>{(Number(currentCustomer.openingBalance) || 0).toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between text-primary">
                    <span>الرصيد الجديد المتوقع للعميل:</span>
                    <span>
                      {(() => {
                        const isCustomerChanged = selectedCustomerId !== invoice.customerId;
                        if (!isCustomerChanged) {
                          const currentBalance = Number(currentCustomer.openingBalance) || 0;
                          const oldCredit = Number(invoice.credit) || 0;
                          const oldCollection = Number(invoice.collection) || 0;
                          const revertedBalance = currentBalance - oldCredit + oldCollection;
                          const newBalance = revertedBalance + credit - collectionValue;
                          return `${newBalance.toLocaleString()} ج.م`;
                        } else {
                          const newCustBalance = Number(currentCustomer.openingBalance) || 0;
                          const newBalance = newCustBalance + credit - collectionValue;
                          return `${newBalance.toLocaleString()} ج.م`;
                        }
                      })()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-4 bg-primary text-white rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-primary/20 hover:opacity-95 disabled:opacity-50 transition-all text-base"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
            ) : (
              <Save size={20} />
            )}
            <span>حفظ التعديلات الفورية</span>
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl font-black active:scale-95 transition-all text-base"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
