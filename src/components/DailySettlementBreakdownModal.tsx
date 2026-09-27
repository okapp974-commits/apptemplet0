import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Package, 
  RotateCcw, 
  AlertTriangle, 
  Gift, 
  Percent, 
  FileText, 
  ArrowDownCircle, 
  Smartphone, 
  Scale, 
  Calculator, 
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronDown,
  Eye,
  Layers,
  TrendingDown,
  TrendingUp,
  CreditCard,
  User,
  Phone,
  HelpCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Product, Invoice, Customer, CarLoading, CarReturn, DailySettlement, UserProfile } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type SettlementBreakdownType = 
  | 'received' 
  | 'surplus' 
  | 'damaged' 
  | 'gifts' 
  | 'discounts' 
  | 'credit' 
  | 'collection' 
  | 'wallet' 
  | 'diffValue' 
  | 'cashRequired' 
  | 'invoices';

interface DailySettlementBreakdownModalProps {
  isOpen: boolean;
  type: SettlementBreakdownType | null;
  onClose: () => void;
  selectedDate: string;
  representativeName?: string;
  products: Product[];
  invoices: Invoice[];
  dailyInvoices: Invoice[];
  customers: Customer[];
  carLoading: CarLoading | null;
  carReturn: CarReturn | null;
  settlement: DailySettlement | null;
  settlementItems: {
    productId: string;
    productName: string;
    price: number;
    received: number;
    sold: number;
    gifts: number;
    surplus: number;
    damaged: number;
    remainingExpected: number;
    diff: number;
  }[];
  totals: {
    received: number;
    surplus: number;
    damaged: number;
    gifts: number;
    sold: number;
  };
  totalDiscounts: number;
  totalCredit: number;
  totalCollection: number;
  confirmedWalletTotal: number;
  totalDiffValue: number;
  cashRequired: number;
  finalRequired: number;
  totalInvoicesValue: number;
  cratesOutLarge: number;
  cratesOutSmall: number;
  cratesInLarge: number;
  cratesInSmall: number;
  cratesDiffLarge: number;
  cratesDiffSmall: number;
  onViewInvoice?: (invoice: Invoice) => void;
}

export default function DailySettlementBreakdownModal({
  isOpen,
  type,
  onClose,
  selectedDate,
  representativeName,
  products,
  invoices,
  dailyInvoices,
  customers,
  carLoading,
  carReturn,
  settlement,
  settlementItems,
  totals,
  totalDiscounts,
  totalCredit,
  totalCollection,
  confirmedWalletTotal,
  totalDiffValue,
  cashRequired,
  finalRequired,
  totalInvoicesValue,
  cratesOutLarge,
  cratesOutSmall,
  cratesInLarge,
  cratesInSmall,
  cratesDiffLarge,
  cratesDiffSmall,
  onViewInvoice
}: DailySettlementBreakdownModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeInvoiceDetail, setActiveInvoiceDetail] = useState<Invoice | null>(null);

  if (!isOpen || !type) return null;

  // Configuration for each modal type
  const config = {
    received: {
      title: 'تفاصيل إجمالي قيمة المستلم (التحميل)',
      subtitle: 'بيان الأصناف والكميات والأسعار التي تم تحميلها واستلامها في بداية اليوم',
      icon: Package,
      color: 'blue',
      badgeColor: 'bg-blue-100 text-blue-800'
    },
    surplus: {
      title: 'تفاصيل مرتجع السليم',
      subtitle: 'بيان البضاعة السليمة المتبقية في السيارة التي تم إرجاعها للمخزن في نهاية اليوم',
      icon: RotateCcw,
      color: 'green',
      badgeColor: 'bg-green-100 text-green-800'
    },
    damaged: {
      title: 'تفاصيل إجمالي الفاقد (التالف)',
      subtitle: 'بيان البضاعة التالفة المسجلة سواء من فواتير العملاء أو المرتجع التالف للمخزن',
      icon: AlertTriangle,
      color: 'red',
      badgeColor: 'bg-red-100 text-red-800'
    },
    gifts: {
      title: 'تفاصيل إجمالي الهدايا والعينات',
      subtitle: 'بيان الهدايا والعينات المجانية الممنوحة لكل عميل في الفواتير اليومية',
      icon: Gift,
      color: 'green',
      badgeColor: 'bg-emerald-100 text-emerald-800'
    },
    discounts: {
      title: 'تفاصيل إجمالي الخصومات',
      subtitle: 'بيان الخصومات الممنوحة على فواتير المبيعات لكل عميل اليوم',
      icon: Percent,
      color: 'red',
      badgeColor: 'bg-rose-100 text-rose-800'
    },
    credit: {
      title: 'تفاصيل إجمالي الآجل (المتبقي على العملاء)',
      subtitle: 'بيان المبيعات الآجلة والمبالغ المتبقية في ذمة العملاء من فواتير اليوم',
      icon: FileText,
      color: 'red',
      badgeColor: 'bg-amber-100 text-amber-800'
    },
    collection: {
      title: 'تفاصيل تحصيل الديون القديمة',
      subtitle: 'بيان المبالغ التي تم تحصيلها نقداً من الحسابات والديون السابقة للعملاء',
      icon: ArrowDownCircle,
      color: 'green',
      badgeColor: 'bg-teal-100 text-teal-800'
    },
    wallet: {
      title: 'تفاصيل مدفوعات المحفظة الإلكترونية',
      subtitle: 'بيان التحويلات عبر المحافظ الإلكترونية (فودافون كاش / إنستاباي) وحالة تأكيدها',
      icon: Smartphone,
      color: 'green',
      badgeColor: 'bg-purple-100 text-purple-800'
    },
    diffValue: {
      title: 'تفاصيل فرق العلب والصناديق والأصناف',
      subtitle: 'مقارنة بين الكميات المحسوبة والمرتجعة فعلياً وتحديد أي عجز أو زيادة',
      icon: Scale,
      color: 'blue',
      badgeColor: 'bg-indigo-100 text-indigo-800'
    },
    cashRequired: {
      title: 'معادلة وخطوات حساب المبلغ المستحق',
      subtitle: 'التسلسل الحسابي الدقيق لكيفية الوصول للمبلغ الواجب توريده للخزينة',
      icon: Calculator,
      color: 'primary',
      badgeColor: 'bg-primary/10 text-primary'
    },
    invoices: {
      title: 'سجل فواتير اليوم التفصيلي',
      subtitle: 'قائمة بجميع الفواتير المحررة اليوم مع إمكانية فحص تفاصيل كل فاتورة',
      icon: Receipt,
      color: 'primary',
      badgeColor: 'bg-primary/10 text-primary'
    }
  }[type];

  const IconComponent = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white w-full max-w-4xl rounded-3xl sm:rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden my-auto max-h-[94vh] sm:max-h-[90vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-8 bg-gradient-to-r from-slate-50 to-blue-50/50 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <div className={cn(
              "w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
              config.color === 'blue' && "bg-blue-500 text-white",
              config.color === 'green' && "bg-emerald-500 text-white",
              config.color === 'red' && "bg-rose-500 text-white",
              config.color === 'primary' && "bg-primary text-white"
            )}>
              <IconComponent className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                <h3 className="text-base sm:text-2xl font-black text-ink leading-snug">{config.title}</h3>
                <span className={cn("text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full", config.badgeColor)}>
                  {selectedDate}
                </span>
                {representativeName && (
                  <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-gray-100 text-gray-700 truncate max-w-[150px] sm:max-w-none">
                    المندوب: {representativeName}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-sm text-secondary font-medium line-clamp-2">{config.subtitle}</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white hover:bg-gray-100 text-gray-500 hover:text-ink flex items-center justify-center shadow-sm border border-gray-200 transition-all shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-6 md:p-8 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
          {/* 1. RECEIVED DETAILS */}
          {type === 'received' && (
            <ReceivedBreakdown 
              settlementItems={settlementItems}
              carLoading={carLoading}
              totalValue={totals.received}
            />
          )}

          {/* 2. SURPLUS DETAILS */}
          {type === 'surplus' && (
            <SurplusBreakdown 
              settlementItems={settlementItems}
              carReturn={carReturn}
              totalValue={totals.surplus}
            />
          )}

          {/* 3. DAMAGED DETAILS */}
          {type === 'damaged' && (
            <DamagedBreakdown 
              settlementItems={settlementItems}
              dailyInvoices={dailyInvoices}
              carReturn={carReturn}
              totalValue={totals.damaged}
              onViewInvoice={onViewInvoice}
            />
          )}

          {/* 4. GIFTS DETAILS */}
          {type === 'gifts' && (
            <GiftsBreakdown 
              dailyInvoices={dailyInvoices}
              totalValue={totals.gifts}
              onViewInvoice={onViewInvoice}
            />
          )}

          {/* 5. DISCOUNTS DETAILS */}
          {type === 'discounts' && (
            <DiscountsBreakdown 
              dailyInvoices={dailyInvoices}
              totalDiscounts={totalDiscounts}
              onViewInvoice={onViewInvoice}
            />
          )}

          {/* 6. CREDIT DETAILS */}
          {type === 'credit' && (
            <CreditBreakdown 
              dailyInvoices={dailyInvoices}
              customers={customers}
              totalCredit={totalCredit}
              onViewInvoice={onViewInvoice}
            />
          )}

          {/* 7. COLLECTION DETAILS */}
          {type === 'collection' && (
            <CollectionBreakdown 
              dailyInvoices={dailyInvoices}
              totalCollection={totalCollection}
              onViewInvoice={onViewInvoice}
            />
          )}

          {/* 8. WALLET DETAILS */}
          {type === 'wallet' && (
            <WalletBreakdown 
              dailyInvoices={dailyInvoices}
              confirmedTotal={confirmedWalletTotal}
              onViewInvoice={onViewInvoice}
            />
          )}

          {/* 9. DIFF VALUE DETAILS */}
          {type === 'diffValue' && (
            <DiffValueBreakdown 
              settlementItems={settlementItems}
              totalDiffValue={totalDiffValue}
              cratesOutLarge={cratesOutLarge}
              cratesOutSmall={cratesOutSmall}
              cratesInLarge={cratesInLarge}
              cratesInSmall={cratesInSmall}
              cratesDiffLarge={cratesDiffLarge}
              cratesDiffSmall={cratesDiffSmall}
            />
          )}

          {/* 10. CASH REQUIRED FORMULA */}
          {type === 'cashRequired' && (
            <CashRequiredBreakdown 
              totals={totals}
              totalDiscounts={totalDiscounts}
              totalCredit={totalCredit}
              totalCollection={totalCollection}
              cashRequired={cashRequired}
              totalInvoicesValue={totalInvoicesValue}
              finalRequired={finalRequired}
            />
          )}

          {/* 11. INVOICES LIST */}
          {type === 'invoices' && (
            <InvoicesListBreakdown 
              dailyInvoices={dailyInvoices}
              totalInvoicesValue={totalInvoicesValue}
              totalCredit={totalCredit}
              totalDiscounts={totalDiscounts}
              onViewInvoice={onViewInvoice}
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
          <span className="text-[11px] sm:text-xs text-secondary font-medium">
            اضغط في أي مكان خارج النافذة أو زر الإغلاق للرجوع
          </span>
          <button
            onClick={onClose}
            className="px-5 sm:px-6 py-2 sm:py-2.5 bg-ink hover:bg-slate-800 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm shrink-0"
          >
            إغلاق
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ----------------------------------------------------
// 1. RECEIVED BREAKDOWN COMPONENT
// ----------------------------------------------------
function ReceivedBreakdown({ 
  settlementItems, 
  carLoading, 
  totalValue 
}: { 
  settlementItems: any[]; 
  carLoading: CarLoading | null; 
  totalValue: number; 
}) {
  const loadedItems = settlementItems.filter(i => (i.received || 0) > 0);
  const totalQty = loadedItems.reduce((acc, i) => acc + (i.received || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-blue-50 p-3 sm:p-4 rounded-2xl border border-blue-100 col-span-2 sm:col-span-1">
          <p className="text-[11px] sm:text-xs font-bold text-blue-600 mb-1">إجمالي قيمة المستلم</p>
          <p className="text-lg sm:text-2xl font-black text-blue-800">{totalValue.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 mb-1">إجمالي كمية القطع</p>
          <p className="text-lg sm:text-2xl font-black text-slate-800">{totalQty.toLocaleString()} قطعة</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 mb-1">عدد الأصناف المحملة</p>
          <p className="text-lg sm:text-2xl font-black text-slate-800">{loadedItems.length} صنف</p>
        </div>
      </div>

      {carLoading && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
            <span className="font-bold">حالة إذن التحميل: {carLoading.status === 'confirmed' ? 'معتمد من المخزن' : 'قيد المراجعة'}</span>
          </div>
          <span className="font-medium text-[11px] sm:text-xs">صناديق خارجة: كبير ({carLoading.largeCratesOut || 0}) | صغير ({carLoading.smallCratesOut || 0})</span>
        </div>
      )}

      {/* Table */}
      <div>
        <p className="text-[10px] sm:hidden text-gray-400 font-bold mb-1">👈 مرر الجدول أفقياً لعرض باقي الأعمدة</p>
        <div className="border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
          <table className="w-full text-right border-collapse text-xs sm:text-sm min-w-[500px] sm:min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-secondary text-[11px] sm:text-xs">
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold">#</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold">اسم المنتج</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold">الكمية المستلمة</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold">سعر القطعة</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-bold">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400 font-bold">
                    لا توجد بضاعة مستلمة مسجلة في هذا اليوم
                  </td>
                </tr>
              ) : (
                loadedItems.map((item, idx) => {
                  const rowTotal = (item.received || 0) * (parseFloat(item.price as any) || 0);
                  return (
                    <tr key={item.productId} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold text-gray-400">{idx + 1}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-black text-ink whitespace-nowrap">{item.productName}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold text-blue-700 bg-blue-50/50 rounded-lg">
                        {item.received}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-medium text-gray-600 whitespace-nowrap">
                        {item.price} ج.م
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-black text-ink whitespace-nowrap">
                        {rowTotal.toLocaleString()} ج.م
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {loadedItems.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-black text-ink border-t-2 border-gray-200">
                  <td colSpan={2} className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">الإجمالي الكلي</td>
                  <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center text-blue-700">{totalQty.toLocaleString()}</td>
                  <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center">-</td>
                  <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-left text-blue-700 whitespace-nowrap">{totalValue.toLocaleString()} ج.م</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 2. SURPLUS BREAKDOWN COMPONENT
// ----------------------------------------------------
function SurplusBreakdown({ 
  settlementItems, 
  carReturn, 
  totalValue 
}: { 
  settlementItems: any[]; 
  carReturn: CarReturn | null; 
  totalValue: number; 
}) {
  const surplusItems = settlementItems.filter(i => (i.surplus || 0) > 0);
  const totalQty = surplusItems.reduce((acc, i) => acc + (i.surplus || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-green-50 p-3 sm:p-4 rounded-2xl border border-green-100 col-span-2 sm:col-span-1">
          <p className="text-[11px] sm:text-xs font-bold text-green-600 mb-1">إجمالي قيمة مرتجع السليم</p>
          <p className="text-lg sm:text-2xl font-black text-green-800">{totalValue.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 mb-1">إجمالي القطع المرتجعة</p>
          <p className="text-lg sm:text-2xl font-black text-slate-800">{totalQty.toLocaleString()} قطعة</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 mb-1">عدد الأصناف المرتجعة</p>
          <p className="text-lg sm:text-2xl font-black text-slate-800">{surplusItems.length} صنف</p>
        </div>
      </div>

      {carReturn && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 p-3 bg-green-50/70 border border-green-100 rounded-xl text-xs text-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            <span className="font-bold">حالة إذن المرتجع: {carReturn.status === 'confirmed' ? 'معتمد من المخزن' : 'قيد المراجعة'}</span>
          </div>
          <span className="font-medium text-[11px] sm:text-xs">صناديق واردة: كبير ({carReturn.largeCratesIn || 0}) | صغير ({carReturn.smallCratesIn || 0})</span>
        </div>
      )}

      {/* Table */}
      <div>
        <p className="text-[10px] sm:hidden text-gray-400 font-bold mb-1">👈 مرر الجدول أفقياً لعرض باقي الأعمدة</p>
        <div className="border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
          <table className="w-full text-right border-collapse text-xs sm:text-sm min-w-[500px] sm:min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-secondary text-[11px] sm:text-xs">
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold">#</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold">اسم المنتج</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold">الكمية المرتجعة (سليم)</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold">سعر القطعة</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-bold">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {surplusItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400 font-bold">
                    لا يوجد مرتجع سليم مسجل في هذا اليوم (تم بيع وتوزيع كامل البضاعة المستلمة)
                  </td>
                </tr>
              ) : (
                surplusItems.map((item, idx) => {
                  const rowTotal = (item.surplus || 0) * (parseFloat(item.price as any) || 0);
                  return (
                    <tr key={item.productId} className="hover:bg-green-50/30 transition-colors">
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold text-gray-400">{idx + 1}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-black text-ink whitespace-nowrap">{item.productName}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold text-green-700 bg-green-50/50 rounded-lg">
                        {item.surplus}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-medium text-gray-600 whitespace-nowrap">
                        {item.price} ج.م
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-black text-ink whitespace-nowrap">
                        {rowTotal.toLocaleString()} ج.م
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {surplusItems.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-black text-ink border-t-2 border-gray-200">
                  <td colSpan={2} className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">الإجمالي الكلي</td>
                  <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center text-green-700">{totalQty.toLocaleString()}</td>
                  <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center">-</td>
                  <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-left text-green-700 whitespace-nowrap">{totalValue.toLocaleString()} ج.م</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 3. DAMAGED BREAKDOWN COMPONENT
// ----------------------------------------------------
function DamagedBreakdown({ 
  settlementItems, 
  dailyInvoices, 
  carReturn, 
  totalValue,
  onViewInvoice 
}: { 
  settlementItems: any[]; 
  dailyInvoices: Invoice[]; 
  carReturn: CarReturn | null; 
  totalValue: number; 
  onViewInvoice?: (invoice: Invoice) => void;
}) {
  const damagedItems = settlementItems.filter(i => (i.damaged || 0) > 0);
  const totalDamagedQty = damagedItems.reduce((acc, i) => acc + (i.damaged || 0), 0);

  // Extract damaged items from customer invoices
  const customerDamagedList: {
    invoice: Invoice;
    customerName: string;
    items: { productName: string; quantity: number; price: number; total: number }[];
    totalInvoiceDamagedValue: number;
  }[] = [];

  dailyInvoices.forEach(inv => {
    const dItems: { productName: string; quantity: number; price: number; total: number }[] = [];
    let invDamVal = 0;
    (inv.items || []).forEach(it => {
      const retDam = it.returnDamaged !== undefined ? it.returnDamaged : ((it as any).returndamaged || 0);
      if (retDam > 0) {
        const itemVal = retDam * (it.price || 0);
        dItems.push({
          productName: it.productName,
          quantity: retDam,
          price: it.price || 0,
          total: itemVal
        });
        invDamVal += itemVal;
      }
    });
    if (dItems.length > 0) {
      customerDamagedList.push({
        invoice: inv,
        customerName: inv.customerName,
        items: dItems,
        totalInvoiceDamagedValue: invDamVal
      });
    }
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-red-50 p-3 sm:p-4 rounded-2xl border border-red-100 col-span-2 sm:col-span-1">
          <p className="text-[11px] sm:text-xs font-bold text-red-600 mb-1">إجمالي قيمة التالف</p>
          <p className="text-lg sm:text-2xl font-black text-red-800">{totalValue.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 mb-1">إجمالي قطع التالف</p>
          <p className="text-lg sm:text-2xl font-black text-slate-800">{totalDamagedQty.toLocaleString()} قطعة</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 mb-1">عملاء أرجعوا تالف</p>
          <p className="text-lg sm:text-2xl font-black text-slate-800">{customerDamagedList.length} عميل</p>
        </div>
      </div>

      {/* Section 1: Product Damaged Summary */}
      <div className="space-y-2 sm:space-y-3">
        <h4 className="text-xs sm:text-sm font-black text-ink flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500" />
          ملخص الأصناف التالفة المسجلة
        </h4>
        <p className="text-[10px] sm:hidden text-gray-400 font-bold mb-1">👈 مرر الجدول أفقياً لعرض باقي الأعمدة</p>
        <div className="border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
          <table className="w-full text-right border-collapse text-xs sm:text-sm min-w-[480px] sm:min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-secondary text-[11px] sm:text-xs">
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold">اسم المنتج</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold">كمية التالف</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold">سعر القطعة</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-bold">إجمالي القيمة التالفة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {damagedItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400 font-bold">
                    لا يوجد أي فاقد أو تالف مسجل اليوم 🎉
                  </td>
                </tr>
              ) : (
                damagedItems.map(item => {
                  const rowTotal = (item.damaged || 0) * (parseFloat(item.price as any) || 0);
                  return (
                    <tr key={item.productId} className="hover:bg-red-50/30 transition-colors">
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-black text-ink whitespace-nowrap">{item.productName}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold text-red-600 bg-red-50/50 rounded-lg">
                        {item.damaged}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-medium text-gray-600 whitespace-nowrap">{item.price} ج.م</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-black text-red-700 whitespace-nowrap">{rowTotal.toLocaleString()} ج.م</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Damaged from Customers Invoices */}
      {customerDamagedList.length > 0 && (
        <div className="space-y-2 sm:space-y-3">
          <h4 className="text-xs sm:text-sm font-black text-ink flex items-center gap-2">
            <User size={16} className="text-blue-500" />
            التالف المستلم من العملاء في فواتير اليوم
          </h4>
          <p className="text-[10px] sm:hidden text-gray-400 font-bold mb-1">👈 مرر الجدول أفقياً لعرض باقي الأعمدة</p>
          <div className="border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
            <table className="w-full text-right border-collapse text-xs sm:text-sm min-w-[520px] sm:min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-secondary text-[11px] sm:text-xs">
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold">العميل</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold">الأصناف التالفة المسترجعة</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-bold">القيمة المخصومة</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold">الفاتورة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customerDamagedList.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-black text-ink whitespace-nowrap">
                      {entry.customerName}
                      <p className="text-[10px] text-gray-400 font-mono">{entry.invoice.id.slice(-8).toUpperCase()}</p>
                    </td>
                    <td className="py-2.5 sm:py-3 px-3 sm:px-4">
                      <div className="space-y-1">
                        {entry.items.map((it, iIdx) => (
                          <div key={iIdx} className="text-xs flex items-center gap-2 whitespace-nowrap">
                            <span className="font-bold text-ink">{it.productName}:</span>
                            <span className="text-red-600 font-black">{it.quantity} قطعة</span>
                            <span className="text-gray-400">({it.total.toLocaleString()} ج.م)</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-black text-red-600 whitespace-nowrap">
                      {entry.totalInvoiceDamagedValue.toLocaleString()} ج.م
                    </td>
                    <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center">
                      {onViewInvoice && (
                        <button
                          onClick={() => onViewInvoice(entry.invoice)}
                          className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all"
                        >
                          <Eye size={14} />
                          عرض
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 4. GIFTS BREAKDOWN COMPONENT
// ----------------------------------------------------
function GiftsBreakdown({ 
  dailyInvoices, 
  totalValue,
  onViewInvoice 
}: { 
  dailyInvoices: Invoice[]; 
  totalValue: number;
  onViewInvoice?: (invoice: Invoice) => void;
}) {
  const giftsList: {
    invoice: Invoice;
    customerName: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
  }[] = [];

  dailyInvoices.forEach(inv => {
    (inv.items || []).forEach(it => {
      if ((it.gifts || 0) > 0) {
        giftsList.push({
          invoice: inv,
          customerName: inv.customerName,
          productName: it.productName,
          quantity: it.gifts,
          price: it.price || 0,
          total: (it.gifts || 0) * (it.price || 0)
        });
      }
    });
  });

  const totalGiftsCount = giftsList.reduce((acc, g) => acc + g.quantity, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-emerald-50 p-3 sm:p-4 rounded-2xl border border-emerald-100 col-span-2 sm:col-span-1">
          <p className="text-[11px] sm:text-xs font-bold text-emerald-600 mb-1">إجمالي قيمة الهدايا</p>
          <p className="text-lg sm:text-2xl font-black text-emerald-800">{totalValue.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 mb-1">إجمالي قطع الهدايا</p>
          <p className="text-lg sm:text-2xl font-black text-slate-800">{totalGiftsCount.toLocaleString()} قطعة</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 mb-1">عدد الفواتير بهدايا</p>
          <p className="text-lg sm:text-2xl font-black text-slate-800">{giftsList.length} فاتورة</p>
        </div>
      </div>

      {/* Table */}
      <div>
        <p className="text-[10px] sm:hidden text-gray-400 font-bold mb-1">👈 مرر الجدول أفقياً لعرض باقي الأعمدة</p>
        <div className="border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
          <table className="w-full text-right border-collapse text-xs sm:text-sm min-w-[620px] sm:min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-secondary text-[11px] sm:text-xs">
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold">#</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold">اسم العميل</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold">صنف الهدية / العينة</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold">عدد القطع</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold">سعر القطعة</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-bold">إجمالي القيمة</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold">الفاتورة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {giftsList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 font-bold">
                    لم يتم منح هدايا أو عينات في فواتير هذا اليوم
                  </td>
                </tr>
              ) : (
                giftsList.map((g, idx) => (
                  <tr key={idx} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold text-gray-400">{idx + 1}</td>
                    <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-black text-ink whitespace-nowrap">{g.customerName}</td>
                    <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold text-emerald-700 whitespace-nowrap">{g.productName}</td>
                    <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-black text-emerald-800 bg-emerald-50/50 rounded-lg">
                      {g.quantity}
                    </td>
                    <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-medium text-gray-600 whitespace-nowrap">{g.price} ج.م</td>
                    <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-black text-emerald-700 whitespace-nowrap">{g.total.toLocaleString()} ج.م</td>
                    <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center">
                      {onViewInvoice && (
                        <button
                          onClick={() => onViewInvoice(g.invoice)}
                          className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all"
                        >
                          <Eye size={14} />
                          عرض
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {giftsList.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-black text-ink border-t-2 border-gray-200">
                  <td colSpan={3} className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">الإجمالي الكلي</td>
                  <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center text-emerald-700">{totalGiftsCount.toLocaleString()}</td>
                  <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center">-</td>
                  <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-left text-emerald-700 whitespace-nowrap">{totalValue.toLocaleString()} ج.م</td>
                  <td className="py-2.5 sm:py-3 px-3 sm:px-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 5. DISCOUNTS BREAKDOWN COMPONENT
// ----------------------------------------------------
function DiscountsBreakdown({ 
  dailyInvoices, 
  totalDiscounts,
  onViewInvoice 
}: { 
  dailyInvoices: Invoice[]; 
  totalDiscounts: number;
  onViewInvoice?: (invoice: Invoice) => void;
}) {
  const discountInvoices = dailyInvoices.filter(inv => (parseFloat(inv.discountValue as any) || 0) > 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-rose-50 p-3 sm:p-4 rounded-2xl border border-rose-100 col-span-2 sm:col-span-1">
          <p className="text-[11px] sm:text-xs font-bold text-rose-600 mb-1">إجمالي الخصومات</p>
          <p className="text-lg sm:text-2xl font-black text-rose-800">{totalDiscounts.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 mb-1">عدد الفواتير المخصومة</p>
          <p className="text-lg sm:text-2xl font-black text-slate-800">{discountInvoices.length} فاتورة</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 mb-1">متوسط الخصم</p>
          <p className="text-lg sm:text-2xl font-black text-slate-800">
            {discountInvoices.length > 0 ? (totalDiscounts / discountInvoices.length).toFixed(1) : 0} ج.م
          </p>
        </div>
      </div>

      {/* Table */}
      <div>
        <p className="text-[10px] sm:hidden text-gray-400 font-bold mb-1">👈 مرر الجدول أفقياً لعرض باقي الأعمدة</p>
        <div className="border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
          <table className="w-full text-right border-collapse text-xs sm:text-sm min-w-[620px] sm:min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-secondary text-[11px] sm:text-xs">
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold">#</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold">اسم العميل</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold">إجمالي الفاتورة</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold">نوع الخصم</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold">قيمة الخصم</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-bold">الصافي بعد الخصم</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold">الفاتورة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {discountInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 font-bold">
                    لا توجد خصومات ممنوحة على فواتير هذا اليوم
                  </td>
                </tr>
              ) : (
                discountInvoices.map((inv, idx) => {
                  const sub = parseFloat(inv.subtotal as any) || 0;
                  const dVal = parseFloat(inv.discountValue as any) || 0;
                  const calculatedDiscount = inv.discountType === 'percentage' ? (sub * dVal / 100) : dVal;
                  const net = sub - calculatedDiscount;

                  return (
                    <tr key={inv.id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold text-gray-400">{idx + 1}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-black text-ink whitespace-nowrap">
                        {inv.customerName}
                        <p className="text-[10px] text-gray-400 font-mono">{inv.time || inv.date}</p>
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-medium text-gray-700 whitespace-nowrap">{sub.toLocaleString()} ج.م</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                          {inv.discountType === 'percentage' ? `${dVal}%` : 'مبلغ ثابت'}
                        </span>
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-black text-rose-600 bg-rose-50/50 rounded-lg whitespace-nowrap">
                        -{calculatedDiscount.toLocaleString()} ج.م
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-black text-ink whitespace-nowrap">{net.toLocaleString()} ج.م</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center">
                        {onViewInvoice && (
                          <button
                            onClick={() => onViewInvoice(inv)}
                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all"
                          >
                            <Eye size={14} />
                            عرض
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {discountInvoices.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-black text-ink border-t-2 border-gray-200">
                  <td colSpan={4} className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">إجمالي الخصومات</td>
                  <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center text-rose-600 whitespace-nowrap">-{totalDiscounts.toLocaleString()} ج.م</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 6. CREDIT BREAKDOWN COMPONENT
// ----------------------------------------------------
function CreditBreakdown({ 
  dailyInvoices, 
  customers, 
  totalCredit,
  onViewInvoice 
}: { 
  dailyInvoices: Invoice[]; 
  customers: Customer[]; 
  totalCredit: number;
  onViewInvoice?: (invoice: Invoice) => void;
}) {
  const creditInvoices = dailyInvoices.filter(inv => (parseFloat(inv.credit as any) || 0) > 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-amber-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-amber-100 col-span-2 sm:col-span-1">
          <p className="text-[11px] sm:text-xs font-bold text-amber-600 mb-0.5 sm:mb-1">إجمالي المبيعات الآجلة</p>
          <p className="text-lg sm:text-2xl font-black text-amber-800">{totalCredit.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 mb-0.5 sm:mb-1">عدد الفواتير الآجلة</p>
          <p className="text-lg sm:text-2xl font-black text-slate-800">{creditInvoices.length} عميل</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 mb-0.5 sm:mb-1">متوسط الآجل/فاتورة</p>
          <p className="text-lg sm:text-2xl font-black text-slate-800">
            {creditInvoices.length > 0 ? (totalCredit / creditInvoices.length).toFixed(1) : 0} ج.م
          </p>
        </div>
      </div>

      {/* Table Section */}
      <div className="space-y-2">
        <div className="sm:hidden flex items-center justify-between text-[11px] text-gray-500 px-1 font-medium">
          <span>اسحب أفقياً لعرض باقي الجدول ⟵</span>
          <span>{creditInvoices.length} فاتورة</span>
        </div>
        <div className="border border-gray-200 rounded-xl sm:rounded-2xl overflow-x-auto shadow-sm -mx-1 sm:mx-0">
          <table className="w-full min-w-[620px] text-right border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-secondary text-[11px] sm:text-xs">
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold whitespace-nowrap">#</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold whitespace-nowrap">اسم العميل</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">إجمالي الفاتورة</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">المدفوع كاش اليوم</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">المتبقي آجل</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-bold whitespace-nowrap">رصيد العميل الحالي</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">الفاتورة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {creditInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 font-bold">
                    لا توجد أي مبيعات آجلة مسجلة اليوم (جميع الفواتير سُددت نقدياً بالكامل) 🎉
                  </td>
                </tr>
              ) : (
                creditInvoices.map((inv, idx) => {
                  const customer = customers.find(c => c.id === inv.customerId);
                  const sub = parseFloat(inv.subtotal as any) || 0;
                  const creditVal = parseFloat(inv.credit as any) || 0;
                  const paidToday = parseFloat(inv.totalPaidToday as any) || 0;

                  return (
                    <tr key={inv.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold text-gray-400 whitespace-nowrap">{idx + 1}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-black text-ink whitespace-nowrap">
                        {inv.customerName}
                        <p className="text-[10px] text-gray-400">{inv.time || inv.date}</p>
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-medium text-gray-700 whitespace-nowrap">{sub.toLocaleString()} ج.م</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold text-emerald-600 whitespace-nowrap">{paidToday.toLocaleString()} ج.م</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-black text-red-600 bg-red-50/50 rounded-lg whitespace-nowrap">
                        {creditVal.toLocaleString()} ج.م
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-bold text-ink whitespace-nowrap">
                        {customer ? `${(customer.openingBalance || 0).toLocaleString()} ج.م` : '-'}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                        {onViewInvoice && (
                          <button
                            onClick={() => onViewInvoice(inv)}
                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all"
                          >
                            <Eye size={14} />
                            عرض
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {creditInvoices.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-black text-ink border-t-2 border-gray-200">
                  <td colSpan={4} className="py-2.5 sm:py-3 px-3 sm:px-4 text-right whitespace-nowrap">إجمالي المبالغ الآجلة</td>
                  <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center text-red-600 whitespace-nowrap">{totalCredit.toLocaleString()} ج.م</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 7. COLLECTION BREAKDOWN COMPONENT
// ----------------------------------------------------
function CollectionBreakdown({ 
  dailyInvoices, 
  totalCollection,
  onViewInvoice 
}: { 
  dailyInvoices: Invoice[]; 
  totalCollection: number;
  onViewInvoice?: (invoice: Invoice) => void;
}) {
  const collectionInvoices = dailyInvoices.filter(inv => (parseFloat(inv.collection as any) || 0) > 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
        <div className="bg-teal-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-teal-100">
          <p className="text-[11px] sm:text-xs font-bold text-teal-600 mb-0.5 sm:mb-1">إجمالي تحصيل الديون القديمة</p>
          <p className="text-lg sm:text-2xl font-black text-teal-800">{totalCollection.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 mb-0.5 sm:mb-1">عدد العملاء الذين سددوا ديون</p>
          <p className="text-lg sm:text-2xl font-black text-slate-800">{collectionInvoices.length} عميل</p>
        </div>
      </div>

      {/* Table Section */}
      <div className="space-y-2">
        <div className="sm:hidden flex items-center justify-between text-[11px] text-gray-500 px-1 font-medium">
          <span>اسحب أفقياً لعرض باقي الجدول ⟵</span>
          <span>{collectionInvoices.length} تحصيل</span>
        </div>
        <div className="border border-gray-200 rounded-xl sm:rounded-2xl overflow-x-auto shadow-sm -mx-1 sm:mx-0">
          <table className="w-full min-w-[550px] text-right border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-secondary text-[11px] sm:text-xs">
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold whitespace-nowrap">#</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold whitespace-nowrap">اسم العميل</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">وقت التحصيل</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">مبلغ تحصيل الدين</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-bold whitespace-nowrap">إجمالي المستلم من العميل</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">الفاتورة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {collectionInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 font-bold">
                    لم يتم تسجيل أي تحصيلات لديون قديمة في فواتير هذا اليوم
                  </td>
                </tr>
              ) : (
                collectionInvoices.map((inv, idx) => {
                  const colVal = parseFloat(inv.collection as any) || 0;
                  const paid = parseFloat(inv.totalPaidToday as any) || 0;

                  return (
                    <tr key={inv.id} className="hover:bg-teal-50/30 transition-colors">
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold text-gray-400 whitespace-nowrap">{idx + 1}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-black text-ink whitespace-nowrap">{inv.customerName}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-mono text-gray-600 whitespace-nowrap">{inv.time || inv.date}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-black text-teal-700 bg-teal-50/50 rounded-lg whitespace-nowrap">
                        +{colVal.toLocaleString()} ج.م
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-black text-ink whitespace-nowrap">{paid.toLocaleString()} ج.م</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                        {onViewInvoice && (
                          <button
                            onClick={() => onViewInvoice(inv)}
                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all"
                          >
                            <Eye size={14} />
                            عرض
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {collectionInvoices.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-black text-ink border-t-2 border-gray-200">
                  <td colSpan={3} className="py-2.5 sm:py-3 px-3 sm:px-4 text-right whitespace-nowrap">إجمالي التحصيلات</td>
                  <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center text-teal-700 whitespace-nowrap">+{totalCollection.toLocaleString()} ج.م</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 8. WALLET BREAKDOWN COMPONENT
// ----------------------------------------------------
function WalletBreakdown({ 
  dailyInvoices, 
  confirmedTotal,
  onViewInvoice 
}: { 
  dailyInvoices: Invoice[]; 
  confirmedTotal: number;
  onViewInvoice?: (invoice: Invoice) => void;
}) {
  const walletInvoices = dailyInvoices.filter(inv => (parseFloat(inv.walletAmount as any) || 0) > 0);
  const pendingTotal = walletInvoices
    .filter(inv => !inv.isWalletConfirmed)
    .reduce((acc, inv) => acc + (parseFloat(inv.walletAmount as any) || 0), 0);
  const allWalletTotal = walletInvoices.reduce((acc, inv) => acc + (parseFloat(inv.walletAmount as any) || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-purple-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-purple-100">
          <p className="text-[11px] sm:text-xs font-bold text-purple-600 mb-0.5 sm:mb-1">المحفظة المؤكدة (تُخصم)</p>
          <p className="text-lg sm:text-2xl font-black text-purple-800">{confirmedTotal.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-amber-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-amber-100">
          <p className="text-[11px] sm:text-xs font-bold text-amber-600 mb-0.5 sm:mb-1">محفظة قيد التأكيد</p>
          <p className="text-lg sm:text-2xl font-black text-amber-800">{pendingTotal.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 col-span-2 sm:col-span-1">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 mb-0.5 sm:mb-1">إجمالي تحويلات المحفظة</p>
          <p className="text-lg sm:text-2xl font-black text-slate-800">{allWalletTotal.toLocaleString()} ج.م</p>
        </div>
      </div>

      {/* Table Section */}
      <div className="space-y-2">
        <div className="sm:hidden flex items-center justify-between text-[11px] text-gray-500 px-1 font-medium">
          <span>اسحب أفقياً لعرض باقي الجدول ⟵</span>
          <span>{walletInvoices.length} تحويل</span>
        </div>
        <div className="border border-gray-200 rounded-xl sm:rounded-2xl overflow-x-auto shadow-sm -mx-1 sm:mx-0">
          <table className="w-full min-w-[560px] text-right border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-secondary text-[11px] sm:text-xs">
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold whitespace-nowrap">#</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold whitespace-nowrap">اسم العميل</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">مبلغ المحفظة</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">المدفوع نقداً</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">حالة التأكيد</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">الفاتورة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {walletInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 font-bold">
                    لا توجد أي مدفوعات محفظة إلكترونية مسجلة في هذا اليوم
                  </td>
                </tr>
              ) : (
                walletInvoices.map((inv, idx) => {
                  const wAmount = parseFloat(inv.walletAmount as any) || 0;
                  const paid = parseFloat(inv.totalPaidToday as any) || 0;
                  const cashPortion = Math.max(0, paid - wAmount);

                  return (
                    <tr key={inv.id} className="hover:bg-purple-50/30 transition-colors">
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold text-gray-400 whitespace-nowrap">{idx + 1}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-black text-ink whitespace-nowrap">{inv.customerName}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-black text-purple-700 bg-purple-50/50 rounded-lg whitespace-nowrap">
                        {wAmount.toLocaleString()} ج.م
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold text-gray-700 whitespace-nowrap">
                        {cashPortion.toLocaleString()} ج.م
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                        {inv.isWalletConfirmed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold bg-green-100 text-green-800">
                            <CheckCircle2 size={12} />
                            مؤكدة
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold bg-amber-100 text-amber-800">
                            <Clock size={12} />
                            قيد المراجعة
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                        {onViewInvoice && (
                          <button
                            onClick={() => onViewInvoice(inv)}
                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all"
                          >
                            <Eye size={14} />
                            عرض
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {walletInvoices.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-black text-ink border-t-2 border-gray-200">
                  <td colSpan={2} className="py-2.5 sm:py-3 px-3 sm:px-4 text-right whitespace-nowrap">الإجمالي</td>
                  <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center text-purple-700 whitespace-nowrap">{allWalletTotal.toLocaleString()} ج.م</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 9. DIFF VALUE BREAKDOWN COMPONENT
// ----------------------------------------------------
function DiffValueBreakdown({
  settlementItems,
  totalDiffValue,
  cratesOutLarge,
  cratesOutSmall,
  cratesInLarge,
  cratesInSmall,
  cratesDiffLarge,
  cratesDiffSmall
}: {
  settlementItems: any[];
  totalDiffValue: number;
  cratesOutLarge: number;
  cratesOutSmall: number;
  cratesInLarge: number;
  cratesInSmall: number;
  cratesDiffLarge: number;
  cratesDiffSmall: number;
}) {
  const diffItems = settlementItems.filter(i => (i.diff || 0) !== 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className={cn(
          "p-3 sm:p-4 rounded-xl sm:rounded-2xl border col-span-2 sm:col-span-1",
          totalDiffValue === 0 ? "bg-green-50 border-green-100 text-green-800" : "bg-red-50 border-red-100 text-red-800"
        )}>
          <p className="text-[11px] sm:text-xs font-bold mb-0.5 sm:mb-1">إجمالي قيمة فرق البضاعة</p>
          <p className="text-lg sm:text-2xl font-black">
            {totalDiffValue > 0 ? `+${totalDiffValue.toLocaleString()}` : totalDiffValue.toLocaleString()} ج.م
          </p>
          <p className="text-[10px] font-bold mt-0.5 sm:mt-1 opacity-80">
            {totalDiffValue === 0 ? 'مطابقة تامة 100%' : totalDiffValue > 0 ? 'عجز على المندوب' : 'زيادة لصالح المندوب'}
          </p>
        </div>

        <div className="bg-blue-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-100">
          <p className="text-[11px] sm:text-xs font-bold text-blue-600 mb-0.5 sm:mb-1">فرق الصناديق الكبيرة</p>
          <p className="text-lg sm:text-2xl font-black text-blue-800">{cratesDiffLarge} صندوق</p>
          <p className="text-[10px] text-blue-600 mt-0.5 sm:mt-1">خرج: {cratesOutLarge} | رجع: {cratesInLarge}</p>
        </div>

        <div className="bg-indigo-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-indigo-100">
          <p className="text-[11px] sm:text-xs font-bold text-indigo-600 mb-0.5 sm:mb-1">فرق الصناديق الصغيرة</p>
          <p className="text-lg sm:text-2xl font-black text-indigo-800">{cratesDiffSmall} صندوق</p>
          <p className="text-[10px] text-indigo-600 mt-0.5 sm:mt-1">خرج: {cratesOutSmall} | رجع: {cratesInSmall}</p>
        </div>
      </div>

      {/* Section 1: Item-level differences */}
      <div className="space-y-2 sm:space-y-3">
        <h4 className="text-xs sm:text-sm font-black text-ink flex items-center gap-2">
          <Scale size={16} className="text-primary" />
          جدول فروقات الأصناف والكميات
        </h4>
        <div className="sm:hidden flex items-center justify-between text-[11px] text-gray-500 px-1 font-medium">
          <span>اسحب أفقياً لعرض باقي الجدول ⟵</span>
          <span>{settlementItems.length} صنف</span>
        </div>
        <div className="border border-gray-200 rounded-xl sm:rounded-2xl overflow-x-auto shadow-sm -mx-1 sm:mx-0">
          <table className="w-full min-w-[580px] text-right border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-secondary text-[11px] sm:text-xs">
                <th className="py-2.5 sm:py-3 px-3 font-bold whitespace-nowrap">المنتج</th>
                <th className="py-2.5 sm:py-3 px-2 text-center font-bold whitespace-nowrap">المستلم</th>
                <th className="py-2.5 sm:py-3 px-2 text-center font-bold whitespace-nowrap">المباع</th>
                <th className="py-2.5 sm:py-3 px-2 text-center font-bold whitespace-nowrap">الهدايا</th>
                <th className="py-2.5 sm:py-3 px-2 text-center font-bold whitespace-nowrap">المتوقع</th>
                <th className="py-2.5 sm:py-3 px-2 text-center font-bold whitespace-nowrap">المرتجع الفعلي</th>
                <th className="py-2.5 sm:py-3 px-2 text-center font-bold whitespace-nowrap">الفرق</th>
                <th className="py-2.5 sm:py-3 px-3 text-left font-bold whitespace-nowrap">قيمة الفرق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {settlementItems.map(item => {
                const rowDiffVal = (item.diff || 0) * (parseFloat(item.price as any) || 0);
                const hasDiff = item.diff !== 0;

                return (
                  <tr key={item.productId} className={cn("hover:bg-gray-50/50", hasDiff && "bg-red-50/30")}>
                    <td className="py-2.5 sm:py-3 px-3 font-black text-ink whitespace-nowrap">{item.productName}</td>
                    <td className="py-2.5 sm:py-3 px-2 text-center font-bold text-blue-600 whitespace-nowrap">{item.received}</td>
                    <td className="py-2.5 sm:py-3 px-2 text-center font-bold text-gray-700 whitespace-nowrap">{item.sold}</td>
                    <td className="py-2.5 sm:py-3 px-2 text-center font-bold text-emerald-600 whitespace-nowrap">{item.gifts}</td>
                    <td className="py-2.5 sm:py-3 px-2 text-center font-bold text-gray-500 whitespace-nowrap">{item.remainingExpected}</td>
                    <td className="py-2.5 sm:py-3 px-2 text-center font-bold text-green-600 whitespace-nowrap">{item.surplus}</td>
                    <td className={cn(
                      "py-2.5 sm:py-3 px-2 text-center font-black rounded-lg whitespace-nowrap",
                      item.diff === 0 ? "text-green-600" : "text-red-600 bg-red-100/50"
                    )}>
                      {item.diff}
                    </td>
                    <td className={cn(
                      "py-2.5 sm:py-3 px-3 text-left font-black whitespace-nowrap",
                      rowDiffVal === 0 ? "text-gray-400" : "text-red-600"
                    )}>
                      {rowDiffVal.toLocaleString()} ج.م
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 10. CASH REQUIRED FORMULA BREAKDOWN
// ----------------------------------------------------
function CashRequiredBreakdown({
  totals,
  totalDiscounts,
  totalCredit,
  totalCollection,
  cashRequired,
  totalInvoicesValue,
  finalRequired
}: {
  totals: { received: number; surplus: number; damaged: number; gifts: number; sold: number };
  totalDiscounts: number;
  totalCredit: number;
  totalCollection: number;
  cashRequired: number;
  totalInvoicesValue: number;
  finalRequired: number;
}) {
  const steps = [
    {
      label: 'إجمالي قيمة البضاعة المستلمة (التحميل)',
      amount: totals.received,
      operation: '+',
      color: 'text-blue-600 bg-blue-50 border-blue-100',
      badge: 'عهدة أولية',
      description: 'قيمة كامل البضاعة التي خرج بها المندوب في بداية اليوم'
    },
    {
      label: 'يُخصم: قيمة مرتجع السليم',
      amount: -totals.surplus,
      operation: '-',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      badge: 'مرتجع للمخزن',
      description: 'بضاعة سليمة أعادها المندوب للمخزن وتم إثباتها في المرتجع'
    },
    {
      label: 'يُخصم: إجمالي التالف والفاقد',
      amount: -totals.damaged,
      operation: '-',
      color: 'text-rose-600 bg-rose-50 border-rose-100',
      badge: 'تالف معتمد',
      description: 'بضاعة تالفة مسترجعة من العملاء أو مسجلة في كشف المرتجع'
    },
    {
      label: 'يُخصم: إجمالي الهدايا والعينات',
      amount: -totals.gifts,
      operation: '-',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      badge: 'ترويج مجاني',
      description: 'عينات وهدايا مجانية مخصومة من عهدة البضاعة للمندوب'
    },
    {
      label: 'يُخصم: إجمالي المبيعات الآجلة',
      amount: -totalCredit,
      operation: '-',
      color: 'text-amber-600 bg-amber-50 border-amber-100',
      badge: 'آجل على العملاء',
      description: 'مبالغ متبقية على العملاء لم تُستلم نقدياً اليوم'
    },
    {
      label: 'يُخصم: إجمالي الخصومات الممنوحة',
      amount: -totalDiscounts,
      operation: '-',
      color: 'text-rose-600 bg-rose-50 border-rose-100',
      badge: 'خصومات رسمية',
      description: 'خصومات تجارية معتمدة على فواتير المبيعات'
    },
    {
      label: 'يُضاف: تحصيل الديون القديمة',
      amount: +totalCollection,
      operation: '+',
      color: 'text-teal-600 bg-teal-50 border-teal-100',
      badge: 'تحصيل كاش',
      description: 'مبالغ نقدية استلمها المندوب من ديون سابقة للعملاء'
    }
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Visual Formula Steps */}
      <div className="space-y-2 sm:space-y-3">
        <h4 className="text-xs sm:text-sm font-black text-ink flex items-center gap-2">
          <Calculator size={18} className="text-primary" />
          خطوات المعادلة الحسابية خطوة بخطوة:
        </h4>

        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div 
              key={idx} 
              className={cn(
                "p-3 sm:p-4 rounded-xl sm:rounded-2xl border flex items-center justify-between gap-2.5 sm:gap-4 transition-all hover:shadow-sm",
                step.color
              )}
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white flex items-center justify-center font-black text-base sm:text-lg shrink-0 shadow-sm">
                  {step.operation}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <p className="font-bold text-ink text-xs sm:text-sm md:text-base leading-tight">{step.label}</p>
                    <span className="text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-white/80 shrink-0">
                      {step.badge}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-secondary/70 truncate hidden sm:block">{step.description}</p>
                </div>
              </div>

              <div className="text-left shrink-0 pl-1">
                <span className="font-black text-sm sm:text-lg whitespace-nowrap">
                  {step.amount > 0 ? `+${step.amount.toLocaleString()}` : step.amount < 0 ? step.amount.toLocaleString() : '0'} ج.م
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Final Result Card */}
      <div className="p-4 sm:p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl sm:rounded-3xl shadow-lg space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/20 pb-3 sm:pb-4">
          <div>
            <p className="text-[11px] sm:text-xs font-bold text-blue-100">المبلغ المستحق حسب معادلة العهدة</p>
            <p className="text-2xl sm:text-3xl font-black">{cashRequired.toLocaleString()} ج.م</p>
          </div>
          <div className="text-right sm:text-left">
            <p className="text-[11px] sm:text-xs font-bold text-blue-100">إجمالي الفواتير النقدية اليوم</p>
            <p className="text-xl sm:text-2xl font-black text-blue-200">{totalInvoicesValue.toLocaleString()} ج.م</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-300 shrink-0" />
            <span className="font-bold text-sm sm:text-base">المطلوب نهائياً للتوريد للخزينة:</span>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-emerald-300 underline decoration-emerald-400 underline-offset-4">
            {finalRequired.toLocaleString()} ج.م
          </span>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 11. INVOICES LIST BREAKDOWN COMPONENT
// ----------------------------------------------------
function InvoicesListBreakdown({
  dailyInvoices,
  totalInvoicesValue,
  totalCredit,
  totalDiscounts,
  onViewInvoice
}: {
  dailyInvoices: Invoice[];
  totalInvoicesValue: number;
  totalCredit: number;
  totalDiscounts: number;
  onViewInvoice?: (invoice: Invoice) => void;
}) {
  const [filterQuery, setFilterQuery] = useState('');

  const filtered = useMemo(() => {
    if (!filterQuery.trim()) return dailyInvoices;
    const q = filterQuery.toLowerCase().trim();
    return dailyInvoices.filter(inv => 
      (inv.customerName || '').toLowerCase().includes(q) ||
      (inv.id || '').toLowerCase().includes(q)
    );
  }, [dailyInvoices, filterQuery]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-primary/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-primary/20">
          <p className="text-[11px] sm:text-xs font-bold text-primary mb-0.5 sm:mb-1">إجمالي المقبوض كاش</p>
          <p className="text-lg sm:text-2xl font-black text-primary">{totalInvoicesValue.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 mb-0.5 sm:mb-1">عدد الفواتير</p>
          <p className="text-lg sm:text-2xl font-black text-slate-800">{dailyInvoices.length} فاتورة</p>
        </div>
        <div className="bg-amber-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-amber-100">
          <p className="text-[11px] sm:text-xs font-bold text-amber-600 mb-0.5 sm:mb-1">إجمالي الآجل</p>
          <p className="text-lg sm:text-2xl font-black text-amber-800">{totalCredit.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-rose-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-rose-100">
          <p className="text-[11px] sm:text-xs font-bold text-rose-600 mb-0.5 sm:mb-1">إجمالي الخصومات</p>
          <p className="text-lg sm:text-2xl font-black text-rose-800">{totalDiscounts.toLocaleString()} ج.م</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input 
          type="text"
          placeholder="بحث برقم الفاتورة أو اسم العميل..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          className="w-full bg-slate-50 border border-gray-200 rounded-xl sm:rounded-2xl pl-4 pr-11 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-ink focus:outline-none focus:border-primary transition-all shadow-inner"
        />
        <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>

      {/* Table Section */}
      <div className="space-y-2">
        <div className="sm:hidden flex items-center justify-between text-[11px] text-gray-500 px-1 font-medium">
          <span>اسحب أفقياً لعرض باقي الجدول ⟵</span>
          <span>{filtered.length} فاتورة</span>
        </div>
        <div className="border border-gray-200 rounded-xl sm:rounded-2xl overflow-x-auto shadow-sm -mx-1 sm:mx-0">
          <table className="w-full min-w-[680px] text-right border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-secondary text-[11px] sm:text-xs">
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold whitespace-nowrap">#</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold whitespace-nowrap">العميل</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">الوقت</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">الأصناف</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">الإجمالي</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">الخصم</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">الآجل</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-bold whitespace-nowrap">المدفوع كاش اليوم</th>
                <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold whitespace-nowrap">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400 font-bold">
                    لا توجد فواتير مطابقة
                  </td>
                </tr>
              ) : (
                filtered.map((inv, idx) => {
                  const sub = parseFloat(inv.subtotal as any) || 0;
                  const credit = parseFloat(inv.credit as any) || 0;
                  const paid = parseFloat(inv.totalPaidToday as any) || 0;
                  const dVal = parseFloat(inv.discountValue as any) || 0;
                  const discountAmount = inv.discountType === 'percentage' ? (sub * dVal / 100) : dVal;
                  const itemsCount = (inv.items || []).reduce((acc, it) => acc + (it.sold || 0) + (it.gifts || 0), 0);

                  return (
                    <tr key={inv.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold text-gray-400 whitespace-nowrap">{idx + 1}</td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-black text-ink whitespace-nowrap">
                        {inv.customerName}
                        <p className="text-[10px] text-gray-400 font-mono">#{inv.id.slice(-6).toUpperCase()}</p>
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-mono text-[11px] sm:text-xs text-gray-600 whitespace-nowrap">
                        {inv.time || '-'}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold text-gray-700 whitespace-nowrap">
                        {itemsCount} ق
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-medium text-gray-700 whitespace-nowrap">
                        {sub.toLocaleString()} ج.م
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold text-rose-600 whitespace-nowrap">
                        {discountAmount > 0 ? `-${discountAmount.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-bold text-amber-600 whitespace-nowrap">
                        {credit > 0 ? `${credit.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-left font-black text-emerald-700 bg-emerald-50/40 rounded-lg whitespace-nowrap">
                        {paid.toLocaleString()} ج.م
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                        {onViewInvoice && (
                          <button
                            onClick={() => onViewInvoice(inv)}
                            className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg sm:rounded-xl text-xs font-bold inline-flex items-center gap-1 sm:gap-1.5 transition-all shadow-sm"
                          >
                            <Eye size={14} />
                            تفاصيل
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-black text-ink border-t-2 border-gray-200">
                  <td colSpan={7} className="py-2.5 sm:py-3 px-3 sm:px-4 text-right whitespace-nowrap">إجمالي المقبوض كاش لجميع الفواتير</td>
                  <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-left text-emerald-700 whitespace-nowrap">{totalInvoicesValue.toLocaleString()} ج.م</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
