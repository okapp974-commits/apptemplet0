import React from 'react';
import { WifiOff, RefreshCw, AlertTriangle, ShieldAlert } from 'lucide-react';

interface OfflineBlockerProps {
  onRetry: () => void;
  isChecking: boolean;
}

export default function OfflineBlocker({ onRetry, isChecking }: OfflineBlockerProps) {
  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-amber-100 flex flex-col text-right">
        {/* Header Icon */}
        <div className="bg-amber-50 p-6 flex flex-col items-center justify-center border-b border-amber-100 text-center">
          <div className="w-16 h-16 bg-amber-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-amber-600/30 mb-3 animate-bounce">
            <WifiOff size={36} />
          </div>
          <h2 className="text-xl font-black text-amber-950 font-serif">
            تنبيه: انقطاع الاتصال بالإنترنت
          </h2>
          <p className="text-xs text-amber-700 mt-1 font-bold">
            يتطلب استخدام التطبيق اتصالاً نشطاً ومستقراً بالإنترنت
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            تم إيقاف واجهة التطبيق مؤقتاً لحماية دقة البيانات ومزامنة اليوميات ولضمان التوقيت الصحيح للعمليات بدون تلاعب.
          </p>

          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 space-y-2 text-xs">
            <h4 className="font-black text-amber-950 flex items-center gap-1.5">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              خطوات استعادة الوصول للتطبيق:
            </h4>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-700 font-medium pr-1 leading-relaxed">
              <li>تأكد من تشغيل <strong className="text-amber-950">بيانات الهاتف (Mobile Data)</strong> أو شبكة <strong className="text-amber-950">Wi-Fi</strong>.</li>
              <li>تأكد من وجود باقة إنترنت فعالة في شريحة الجوال.</li>
              <li>اضغط على زر <strong className="text-amber-950">"إعادة المحاولة والتحقق من الاتصال"</strong> أسفله.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onRetry}
            disabled={isChecking}
            className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-amber-600/20 transition-all disabled:opacity-50 text-sm"
          >
            <RefreshCw size={18} className={isChecking ? 'animate-spin' : ''} />
            <span>{isChecking ? 'جاري اختبار الاتصال بالسيرفر...' : 'إعادة المحاولة والتحقق من الاتصال'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
