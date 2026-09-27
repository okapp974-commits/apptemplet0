import * as React from 'react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, 
  FileText, 
  Search, 
  Calendar, 
  Users, 
  X, 
  Printer, 
  PhoneCall,
  User,
  ShoppingBag,
  ExternalLink,
  Info,
  Trash2,
  Check,
  AlertTriangle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Invoice, Customer, UserProfile, Product, Settings } from '../types';
import { dataService } from '../services/dataService';
import { normalizeDateStringToISO } from '../services/timeService';
import { printElementViaRawBT } from '../utils/bluetoothPrinter';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface InvoiceReviewTabProps {
  invoices: Invoice[];
  customers: Customer[];
  allUsers: UserProfile[];
  products: Product[];
  settings: Settings | null;
  profile: UserProfile | null;
}

export default function InvoiceReviewTab({ 
  invoices, 
  customers, 
  allUsers, 
  products, 
  settings,
  profile 
}: InvoiceReviewTabProps) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isBtPrinting, setIsBtPrinting] = useState(false);
  const [btPrintStatus, setBtPrintStatus] = useState('');
  
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localToast, setLocalToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showLocalToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setLocalToast({ message: msg, type });
  };

  const isRep = profile?.role === 'representative' || profile?.role === 'backup_representative';
  const canDelete = profile?.role === 'manager' || 
                    profile?.role === 'accountant' || 
                    profile?.role === 'supervisor' || 
                    profile?.role === 'developer' || 
                    profile?.email === 'amin@ok.com' || 
                    profile?.email === 'admin@ok.com' || 
                    profile?.email?.toLowerCase().includes('okapp974') || 
                    profile?.email?.toLowerCase().includes('okkapp974');
  
  const handleDeleteInvoice = async () => {
    if (!selectedInvoice) return;
    setIsDeleting(true);
    try {
      const customer = customers.find(c => c.id === selectedInvoice.customerId);
      await dataService.deleteInvoice(selectedInvoice.id);
      
      if (customer) {
        const reversedBalance = (Number(customer.openingBalance) || 0) - (Number(selectedInvoice.credit) || 0) + (Number(selectedInvoice.collection) || 0);
        await dataService.updateCustomer(customer.id, {
          openingBalance: reversedBalance
        });
      }
      
      showLocalToast('تم حذف الفاتورة وتحديث رصيد العميل بنجاح', 'success');
      setSelectedInvoice(null);
      setIsDeleteConfirmOpen(false);
    } catch (err: any) {
      console.error(err);
      showLocalToast(`فشل في حذف الفاتورة: ${err.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const invoiceModalRef = useRef<HTMLDivElement>(null);

  const representatives = useMemo(() => {
    return allUsers.filter(u => u.role === 'representative' || u.role === 'backup_representative');
  }, [allUsers]);

  // Actively query invoices from the database when selecting an older date or specific rep
  useEffect(() => {
    if (selectedDate) {
      const repId = selectedRepId !== 'all' ? selectedRepId : (isRep ? profile?.uid : undefined);
      dataService.fetchInvoicesByDate(selectedDate, repId).catch(console.warn);
    }
  }, [selectedDate, selectedRepId, isRep, profile]);

  // Filter invoices by selected date and representative
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const invIsoDate = normalizeDateStringToISO(inv.date || (inv as any).timestamp || '');
      const selIsoDate = selectedDate ? normalizeDateStringToISO(selectedDate) : '';
      const matchesDate = !selectedDate || invIsoDate === selIsoDate;

      const invRepId = inv.representativeId || (inv as any).representativeid || '';
      const matchesRep = !selectedRepId || selectedRepId === 'all' || invRepId === selectedRepId;
      
      const customer = customers.find(c => c.id === inv.customerId || c.id === (inv as any).customerid);
      const customerPhone = customer?.phone || '';
      
      const matchesSearch = searchQuery === '' || 
        (inv.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (customer?.ownerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        customerPhone.includes(searchQuery) ||
        (inv.id || '').toLowerCase().includes(searchQuery.toLowerCase());

      return matchesDate && matchesRep && matchesSearch;
    });
  }, [invoices, selectedDate, selectedRepId, searchQuery, customers]);

  // Helper to get customer details
  const getCustomerDetails = (customerId: string) => {
    return customers.find(c => c.id === customerId);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRawBTPrint = async () => {
    try {
      setIsBtPrinting(true);
      setBtPrintStatus('جاري تحضير الفاتورة وإرسالها لتطبيق RawBT...');
      
      await printElementViaRawBT('printable-invoice', (status) => {
        setBtPrintStatus(status);
      });
      
      showLocalToast('تم إرسال الفاتورة بنجاح لتطبيق RawBT! 🎉', 'success');
      setTimeout(() => {
        setBtPrintStatus('');
        setIsBtPrinting(false);
      }, 3000);
    } catch (err: any) {
      console.error("RawBT print error:", err);
      showLocalToast(err.message || 'فشل إرسال الفاتورة لتطبيق RawBT', 'error');
      setBtPrintStatus('');
      setIsBtPrinting(false);
    }
  };

  return (
    <div className="space-y-6" id="invoice-review-section">
      {/* Header Panel */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border-2 border-blue-50/50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-serif font-black text-ink flex items-center gap-3">
              <span className="p-3 bg-blue-50 text-primary rounded-2xl">
                <Phone size={24} />
              </span>
              مراجعة الفواتير هاتفياً
            </h1>
            <p className="text-sm text-secondary/70 mt-1">تواصل مع العملاء لمراجعة الفواتير واليوميات والتحقق من صحة المعاملات</p>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Selector */}
          <div className="space-y-2">
            <label className="text-xs font-black text-secondary block">تاريخ اليومية</label>
            <div className="relative">
              <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-4 pr-11 py-3.5 bg-blue-50/30 border-2 border-blue-50 rounded-2xl text-ink font-bold focus:outline-none focus:border-primary transition-all text-right"
              />
            </div>
          </div>

          {/* Representative Selector */}
          <div className="space-y-2">
            <label className="text-xs font-black text-secondary block">المندوب</label>
            <div className="relative">
              <Users className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
              <select
                value={selectedRepId}
                onChange={(e) => setSelectedRepId(e.target.value)}
                className="w-full pl-4 pr-11 py-3.5 bg-blue-50/30 border-2 border-blue-50 rounded-2xl text-ink font-bold focus:outline-none focus:border-primary transition-all appearance-none text-right"
              >
                <option value="all">كل المناديب</option>
                {representatives.map(rep => (
                  <option key={rep.uid} value={rep.uid}>{rep.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Query */}
          <div className="space-y-2">
            <label className="text-xs font-black text-secondary block">بحث سريع</label>
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="اسم العميل، رقم الهاتف أو الفاتورة..."
                className="w-full pl-4 pr-11 py-3.5 bg-blue-50/30 border-2 border-blue-50 rounded-2xl text-ink font-bold placeholder-secondary/30 focus:outline-none focus:border-primary transition-all text-right text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Invoices List Panel */}
      <div className="bg-white rounded-[2rem] shadow-sm border-2 border-blue-50/50 overflow-hidden">
        <div className="p-6 md:p-8 border-b-2 border-blue-50 flex justify-between items-center bg-blue-50/10">
          <div>
            <h2 className="text-lg font-serif font-black text-ink">قائمة الفواتير المتاحة للمراجعة</h2>
            <p className="text-xs text-secondary/60 mt-0.5">عدد الفواتير المطابقة للبحث: {filteredInvoices.length} فاتورة</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b-2 border-blue-50 bg-blue-50/30">
                <th className="py-4 px-6 font-black text-[10px] text-blue-500 uppercase tracking-widest">اسم العميل والنشاط</th>
                <th className="py-4 px-6 font-black text-[10px] text-blue-500 uppercase tracking-widest">رقم تليفون العميل</th>
                <th className="py-4 px-6 font-black text-[10px] text-blue-500 uppercase tracking-widest text-center">المبلغ المستحق اليوم</th>
                <th className="py-4 px-6 font-black text-[10px] text-blue-500 uppercase tracking-widest text-center">المندوب المسئول</th>
                <th className="py-4 px-6 font-black text-[10px] text-blue-500 uppercase tracking-widest text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {filteredInvoices.map((inv) => {
                const customer = getCustomerDetails(inv.customerId);
                const phone = customer?.phone || 'غير مسجل';
                const hasValidPhone = phone !== 'غير مسجل' && phone.trim() !== '';

                return (
                  <tr key={inv.id} className="hover:bg-blue-50/20 transition-all duration-200 group">
                    <td className="py-5 px-6">
                      <div className="flex flex-col">
                        <span className="font-black text-ink text-sm group-hover:text-primary transition-colors">{inv.customerName}</span>
                        {customer?.ownerName && (
                          <span className="text-xs text-secondary/50 mt-0.5">المالك: {customer.ownerName}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-2">
                        {hasValidPhone ? (
                          <a 
                            href={`tel:${phone}`}
                            className="font-mono font-bold text-sm text-primary hover:underline hover:text-blue-700 flex items-center gap-1.5 direction-ltr"
                          >
                            <span>{phone}</span>
                            <PhoneCall size={14} className="text-primary/70" />
                          </a>
                        ) : (
                          <span className="text-xs text-secondary/40 italic">لا يوجد رقم مسجل</span>
                        )}
                      </div>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <span className="font-black text-sm text-primary">
                        {(inv.totalPaidToday || 0).toLocaleString()} ج.م
                      </span>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <span className="text-xs font-bold text-ink/70 bg-blue-50/50 px-3 py-1.5 rounded-xl border border-blue-50">
                        {inv.representativeName}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-left">
                      <div className="flex items-center justify-end gap-2.5">
                        {/* Call trigger */}
                        {hasValidPhone && (
                          <a
                            href={`tel:${phone}`}
                            className="p-2.5 text-green-600 bg-green-50 rounded-2xl hover:bg-green-100 border-2 border-green-100 hover:border-green-300 transition-all active:scale-95 flex items-center gap-2 font-bold text-xs"
                            title="اتصال سريع بالعميل"
                          >
                            <PhoneCall size={16} />
                            <span>اتصل الآن</span>
                          </a>
                        )}

                        {/* View Preview Button */}
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-2.5 text-primary bg-blue-50 rounded-2xl hover:bg-blue-100 border-2 border-blue-100 hover:border-blue-300 transition-all active:scale-95 flex items-center gap-2 font-bold text-xs"
                          title="عرض الفاتورة"
                        >
                          <FileText size={16} />
                          <span>معاينة الفاتورة</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-secondary/40 italic text-sm font-serif">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Info size={36} className="text-secondary/20" />
                      <span>لا توجد فواتير مطابقة لخيارات البحث المحددة اليوم</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Details & Printing Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedInvoice(null)}
              className="absolute inset-0 bg-ink/60 backdrop-blur-md print:hidden"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-[3rem] shadow-2xl p-4 md:p-8 border-2 border-blue-100 z-10 print:absolute print:inset-0 print:max-h-full print:p-0 print:border-none print:shadow-none print:rounded-none"
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedInvoice(null)} 
                className="absolute top-6 left-6 p-3 hover:bg-blue-50 rounded-2xl transition-all active:scale-95 print:hidden border-2 border-blue-50 z-10"
              >
                <X size={24} className="text-blue-300 hover:text-primary" />
              </button>

              <div ref={invoiceModalRef} className="p-4 md:p-6 bg-white max-w-[500px] mx-auto print:p-0">
                <div className="text-center mb-8 border-b-2 border-blue-100 pb-6">
                  <h2 className="text-3xl font-serif font-black text-primary">شركة OK</h2>
                  <p className="text-[10px] text-secondary font-black tracking-[0.3em] uppercase mt-1">نظام الإدارة المتكامل</p>
                  {settings?.companyPhone && (
                    <p className="text-xs text-secondary/70 font-mono font-bold mt-1">تليفون الشركة: {settings.companyPhone}</p>
                  )}
                </div>

                <div className="flex justify-between items-center mb-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 print:border">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-serif font-black text-ink">فاتورة مبيعات هاتفية</h3>
                      <p className="text-blue-400 font-mono text-[10px] mt-1 tracking-widest uppercase">ID: {selectedInvoice.id.slice(-8).toUpperCase()}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-10">
                  <div className="space-y-3 bg-blue-50 p-5 rounded-[1.5rem] border-2 border-blue-100">
                    <div>
                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">العميل</p>
                      <p className="text-lg font-black text-ink leading-tight">{selectedInvoice.customerName}</p>
                      {getCustomerDetails(selectedInvoice.customerId)?.phone && (
                        <p className="text-xs text-secondary/60 font-mono mt-1 font-bold">ت: {getCustomerDetails(selectedInvoice.customerId)?.phone}</p>
                      )}
                    </div>
                    <div className="pt-2 border-t border-blue-100/50">
                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">المندوب</p>
                      <p className="text-xs font-bold text-ink/70">{selectedInvoice.representativeName}</p>
                    </div>
                  </div>
                  <div className="space-y-3 bg-blue-50 p-5 rounded-[1.5rem] border-2 border-blue-100 text-left">
                    <div>
                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">التاريخ</p>
                      <p className="text-md font-black text-ink">{selectedInvoice.date}</p>
                    </div>
                    <div className="pt-2 border-t border-blue-100/50">
                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">الوقت</p>
                      <p className="text-xs font-bold text-ink/70">{selectedInvoice.time}</p>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="mb-10">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b-2 border-blue-100">
                        <th className="py-3 font-black text-[9px] text-blue-500 uppercase tracking-widest">المنتج</th>
                        <th className="py-3 text-center font-black text-[9px] text-blue-500 uppercase tracking-widest">السعر</th>
                        <th className="py-3 text-center font-black text-[9px] text-blue-500 uppercase tracking-widest">عدد العلب</th>
                        {selectedInvoice.items.some(i => i.returnDamaged > 0) && (
                          <th className="py-3 text-center font-black text-[9px] text-red-500 uppercase tracking-widest">تالف</th>
                        )}
                        {selectedInvoice.items.some(i => i.gifts > 0) && (
                          <th className="py-3 text-center font-black text-[9px] text-green-500 uppercase tracking-widest">هدايا</th>
                        )}
                        <th className="py-3 text-left font-black text-[9px] text-blue-500 uppercase tracking-widest">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50">
                      {selectedInvoice.items
                        .filter(item => item.sold > 0 || item.returnDamaged > 0 || item.gifts > 0)
                        .map((item, i) => (
                        <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-3 text-xs font-black text-ink whitespace-nowrap">{item.productName}</td>
                          <td className="py-3 text-center text-xs font-bold text-ink/60">{item.price}</td>
                          <td className="py-3 text-center text-xs font-black text-ink">{item.sold}</td>
                          {selectedInvoice.items.some(it => it.returnDamaged > 0) && (
                            <td className="py-3 text-center text-xs font-black text-red-600">{item.returnDamaged}</td>
                          )}
                          {selectedInvoice.items.some(it => it.gifts > 0) && (
                            <td className="py-3 text-center text-xs font-black text-green-600">{item.gifts}</td>
                          )}
                          <td className="py-3 text-left font-black text-xs text-ink">{(item.total || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-blue-100 bg-blue-50/30">
                        <td className="py-3 text-xs font-black text-ink">العدد المالي</td>
                        <td className="py-3 text-center text-xs font-black text-ink">-</td>
                        <td className="py-3 text-center text-xs font-black text-ink">
                          {selectedInvoice.items.reduce((acc, it) => acc + it.sold, 0)}
                        </td>
                        {selectedInvoice.items.some(it => it.returnDamaged > 0) && (
                          <td className="py-3 text-center text-xs font-black text-red-600">
                            {selectedInvoice.items.reduce((acc, it) => acc + it.returnDamaged, 0)}
                          </td>
                        )}
                        {selectedInvoice.items.some(it => it.gifts > 0) && (
                          <td className="py-3 text-center text-xs font-black text-green-600">
                            {selectedInvoice.items.reduce((acc, it) => acc + it.gifts, 0)}
                          </td>
                        )}
                        <td className="py-3 text-left font-black text-xs text-ink">
                          {(selectedInvoice.items.reduce((acc, it) => acc + (it.total || 0), 0)).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Final Calculations Panel */}
                <div className="flex justify-end">
                  <div className="w-full space-y-3 bg-blue-50 p-6 rounded-[2rem] border-2 border-blue-100">
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-500 font-bold">المجموع الفرعي</span>
                      <span className="font-black text-ink">{(selectedInvoice.subtotal || 0).toLocaleString()} ج.م</span>
                    </div>
                    {selectedInvoice.items.some(i => i.returnDamaged > 0) && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-500 font-bold">قيمة المرتجع</span>
                        <span className="font-black text-red-600">-{(selectedInvoice.items.reduce((acc, item) => acc + ((item.returnDamaged || 0) * (item.price || 0)), 0)).toLocaleString()} ج.م</span>
                      </div>
                    )}
                    {selectedInvoice.items.some(i => i.gifts > 0) && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-500 font-bold">قيمة الهدايا</span>
                        <span className="font-black text-green-600">+{(selectedInvoice.items.reduce((acc, item) => acc + ((item.gifts || 0) * (item.price || 0)), 0)).toLocaleString()} ج.م</span>
                      </div>
                    )}
                    {selectedInvoice.discountValue > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-500 font-bold">الخصم</span>
                        <span className="font-black text-red-600">-{selectedInvoice.discountValue} {selectedInvoice.discountType === 'percentage' ? '%' : 'ج.م'}</span>
                      </div>
                    )}
                    {selectedInvoice.credit > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-500 font-bold">آجل (مديونية)</span>
                        <span className="font-black text-red-600">-{(selectedInvoice.credit || 0).toLocaleString()} ج.م</span>
                      </div>
                    )}
                    {selectedInvoice.collection > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-500 font-bold">تحصيل (سداد قديم)</span>
                        <span className="font-black text-green-600">+{(selectedInvoice.collection || 0).toLocaleString()} ج.م</span>
                      </div>
                    )}
                    {selectedInvoice.walletAmount && selectedInvoice.walletAmount > 0 && (
                      <div className="flex justify-between text-xs p-2 bg-purple-50 rounded-lg border border-purple-100">
                        <div className="flex items-center gap-2">
                          <span className="text-purple-600 font-bold">تحويل محفظة</span>
                          {selectedInvoice.isWalletConfirmed ? (
                            <span className="text-[8px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">مؤكد</span>
                          ) : (
                            <span className="text-[8px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">قيد الانتظار</span>
                          )}
                        </div>
                        <span className="font-black text-purple-600">{(selectedInvoice.walletAmount || 0).toLocaleString()} ج.م</span>
                      </div>
                    )}
                    <div className="pt-4 mt-4 border-t-2 border-blue-100 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-lg font-serif font-black text-ink">المحصل اليوم</span>
                        {selectedInvoice.walletAmount && selectedInvoice.walletAmount > 0 && (
                          <span className="text-[10px] font-bold text-secondary/50">
                            نقدًا: {((selectedInvoice.totalPaidToday || 0) - (selectedInvoice.walletAmount || 0)).toLocaleString()} ج.م
                          </span>
                        )}
                      </div>
                      <span className="text-2xl font-serif font-black text-primary">{(selectedInvoice.totalPaidToday || 0).toLocaleString()} ج.م</span>
                    </div>
                  </div>
                </div>
              </div>

              {btPrintStatus && (
                <div className="mx-auto mt-4 max-w-[500px] p-4 bg-blue-50 border-2 border-blue-200 text-blue-900 rounded-[1.5rem] text-xs font-bold flex items-center justify-center gap-3 animate-pulse print:hidden">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping"></div>
                  <span>{btPrintStatus}</span>
                </div>
              )}

              {/* Modal Print & Call Actions */}
              <div className="mt-12 flex flex-wrap gap-4 print:hidden">
                {getCustomerDetails(selectedInvoice.customerId)?.phone && (
                  <a 
                    href={`tel:${getCustomerDetails(selectedInvoice.customerId)?.phone}`}
                    className="flex-1 min-w-[140px] py-5 bg-green-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-green-600/20 transition-all hover:bg-green-500"
                  >
                    <Phone size={22} />
                    <span>اتصال بالعميل</span>
                  </a>
                )}
                <button 
                  onClick={handleRawBTPrint} 
                  disabled={isBtPrinting}
                  className="flex-1 min-w-[200px] py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-emerald-600/20 transition-all hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer size={22} className={isBtPrinting ? "animate-spin" : ""} />
                  <span>طباعة فورية</span>
                </button>
                <button 
                  onClick={handlePrint} 
                  className="flex-grow md:flex-1 min-w-[140px] py-5 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-slate-900/20 transition-all hover:bg-slate-800"
                >
                  <Printer size={22} />
                  <span>طباعة المعاينة</span>
                </button>
                {canDelete && (
                  <button 
                    onClick={() => setIsDeleteConfirmOpen(true)} 
                    className="flex-1 min-w-[140px] py-5 bg-red-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-red-600/20 transition-all hover:bg-red-700"
                  >
                    <Trash2 size={22} />
                    <span>حذف الفاتورة</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 text-right"
              dir="rtl"
            >
              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-serif font-bold text-slate-900 mb-2 text-right">حذف فاتورة</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed text-right">
                هل أنت متأكد من حذف هذه الفاتورة نهائياً؟ لا يمكن التراجع عن هذه العملية وسيتم تحديث رصيد العميل بالخصم أو الإضافة بناءً على ذلك.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={handleDeleteInvoice}
                  disabled={isDeleting}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting && <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>}
                  {isDeleting ? "جاري الحذف..." : "حذف نهائياً"}
                </button>
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  disabled={isDeleting}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Message */}
      <AnimatePresence>
        {localToast && (
          <LocalToast 
            message={localToast.message} 
            type={localToast.type} 
            onClose={() => setLocalToast(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LocalToast({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 50, x: '-50%' }}
      className={`fixed bottom-24 left-1/2 z-[9999] px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-3 min-w-[280px] justify-center ${
        type === 'success' ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
      }`}
    >
      {type === 'success' ? <Check size={18} /> : <X size={18} />}
      {message}
    </motion.div>
  );
}
