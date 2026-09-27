import React from 'react';
import { Clock, RefreshCw, AlertTriangle, ShieldAlert, Smartphone } from 'lucide-react';
import { TimeSyncResult } from '../services/timeService';

interface TimeSyncBlockerProps {
  syncResult: TimeSyncResult;
  onRecheck: () => void;
  isChecking: boolean;
}

export default function TimeSyncBlocker({
  syncResult,
  onRecheck,
  isChecking
}: TimeSyncBlockerProps) {
  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-red-100 flex flex-col text-right">
        {/* Header Icon */}
        <div className="bg-red-50 p-6 flex flex-col items-center justify-center border-b border-red-100 text-center">
          <div className="w-16 h-16 bg-red-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-red-600/30 mb-3 animate-pulse">
            <ShieldAlert size={36} />
          </div>
          <h2 className="text-xl font-black text-red-950 font-serif">
            تم إيقاف التطبيق: التاريخ غير مضبوط
          </h2>
          <p className="text-xs text-red-700 mt-1 font-bold">
            تم اكتشاف اختلاف بين توقيت هاتفك والتوقيت الفعلي للسيرفر
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            لحماية دقة البيانات واليومية وحفظ حق المبيعات، تم حظر استخدام التطبيق مؤقتاً حتى تقوم بتصحيح تاريخ وساعة جهازك.
          </p>

          {/* Time Comparison Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-500 flex items-center gap-1.5">
                <Smartphone size={16} className="text-slate-400" />
                تاريخ وهاتف الجوال الحالي:
              </span>
              <span className="font-mono font-black text-red-600 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100">
                {syncResult.formattedDeviceDate || 'غير معروف'}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs pt-1">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Clock size={16} className="text-emerald-600" />
                التوقيت الفعلي الصحيح للسيرفر:
              </span>
              <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                {syncResult.formattedServerDate || 'جاري الجلب...'}
              </span>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 space-y-2 text-xs">
            <h4 className="font-black text-amber-950 flex items-center gap-1.5">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              كيفية حل المشكلة وإعادة التشغيل:
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-700 font-medium pr-1 leading-relaxed">
              <li>ادخل إلى <strong className="text-amber-950">إعدادات الهاتف (Settings)</strong>.</li>
              <li>اختر <strong className="text-amber-950">التاريخ والوقت (Date & Time)</strong>.</li>
              <li>قم بتفعيل خيار <strong className="text-amber-950">"التاريخ والوقت التلقائي" (Automatic Date & Time)</strong> من الشبكة.</li>
              <li>عد للتطبيق واضغط على زر التحقق أدناه.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onRecheck}
            disabled={isChecking}
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-red-600/20 transition-all disabled:opacity-50 text-sm"
          >
            {isChecking ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <RefreshCw size={18} />
            )}
            <span>{isChecking ? 'جاري التحقق من السيرفر...' : 'إعادة التحقق من التاريخ والتشغيل'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
