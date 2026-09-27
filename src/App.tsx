/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useMemo, useRef, Component, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Edit3,
  Save, 
  Printer, 
  Share2, 
  MapPin, 
  History, 
  Users, 
  Package, 
  FileText, 
  LogOut, 
  ChevronRight, 
  ChevronLeft,
  ArrowUpDown,
  Check,
  X,
  Menu,
  Settings as SettingsIcon,
  User as UserIcon,
  UserPlus,
  UserPlus as UserPlusIcon,
  ShieldCheck,
  Phone,
  Map as MapIcon,
  Calendar,
  Clock,
  Download,
  Camera,
  MessageCircle,
  Target,
  CreditCard,
  Bell,
  RefreshCcw,
  Wallet,
  Maximize,
  Minimize,
  ClipboardList,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  CheckCircle,
  Calculator,
  Lock,
  Unlock,
  Database,
  Snowflake,
  Copy,
  Navigation,
  Compass,
  LayoutGrid,
  Table,
  ArrowDownToLine,
  Truck,
  Filter,
  CheckCheck
} from 'lucide-react';
import { authService, type AuthUser } from './services/authService';
import { dataService } from './services/dataService';
import { supabase } from './supabase';
import { SUPABASE_SETUP_SQL } from './services/setupSql';
import { 
  WEEKDAYS, 
  normalizeDayValue, 
  getArabicWeekdayLabel, 
  parseCustomerPreferredDays, 
  isCustomerPreferredOnDay, 
  formatPreferredDaysArabic 
} from './utils/dayUtils';
import { notificationService } from './services/notificationService';
import { 
  type Role, 
  type UserProfile, 
  type Product, 
  type LoadingRequest, 
  type LoadingRequestItem,
  type SelectedVisitCustomer,
  type Customer, 
  type MasterRoute,
  type Invoice, 
  type DailySettlement, 
  type DailySettlementItem,
  type Loan, 
  type LoanStatus,
  type Attendance, 
  type Settings, 
  type SystemConfig, 
  type Route, 
  type Notification,
  CarLoading,
  CarReturn
} from './types';
import { motion, AnimatePresence } from 'framer-motion';
import { format, getDaysInMonth, parseISO } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toPng, toBlob } from 'html-to-image';
import jsPDF from 'jspdf';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet marker icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

import * as XLSX from 'xlsx';
import InvoiceReviewTab from './components/InvoiceReviewTab';
import InvoicesTableSection from './components/InvoicesTableSection';
import EditInvoiceModal from './components/EditInvoiceModal';
import DailySettlementBreakdownModal, { SettlementBreakdownType } from './components/DailySettlementBreakdownModal';
import { printInvoiceReceipt } from './utils/invoicePrinter';
import { printElementViaBluetooth, printElementViaRawBT, printInvoiceDataViaRawBT } from './utils/bluetoothPrinter';
import { checkDeviceTimeSync, checkNetworkConnectivity, getVerifiedServerTime, normalizeDateStringToISO, TimeSyncResult } from './services/timeService';
import TimeSyncBlocker from './components/TimeSyncBlocker';
import OfflineBlocker from './components/OfflineBlocker';

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorInfo: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    (this as any).state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, errorInfo: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if ((this as any).state.hasError) {
      let isQuotaError = false;
      try {
        const parsed = JSON.parse((this as any).state.errorInfo || '{}');
        if (parsed.error?.includes('quota exceeded') || parsed.error?.includes('resource-exhausted')) {
          isQuotaError = true;
        }
      } catch (e) {
        if ((this as any).state.errorInfo?.includes('quota exceeded') || (this as any).state.errorInfo?.includes('resource-exhausted')) {
          isQuotaError = true;
        }
      }

      return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-6 text-right" dir="rtl">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-red-100 max-w-md w-full space-y-6">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={40} className="text-red-500" />
            </div>
            <h2 className="text-2xl font-serif font-black text-ink text-center">
              {isQuotaError ? 'عذراً، تم تجاوز الحد اليومي' : 'حدث خطأ غير متوقع'}
            </h2>
            <p className="text-secondary text-center font-medium leading-relaxed">
              {isQuotaError 
                ? 'لقد استنفذ التطبيق حصة العمليات المجانية لهذا اليوم. سيتم تصفير العداد والعودة للعمل تلقائياً غداً صباحاً.' 
                : 'نعتذر عن هذا العطل الفني. يرجى محاولة إعادة تحميل الصفحة أو التواصل مع الدعم الفني.'}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              إعادة تحميل الصفحة
            </button>
            {process.env.NODE_ENV === 'development' && !isQuotaError && (
              <pre className="mt-4 p-4 bg-slate-50 rounded-xl text-[10px] overflow-auto text-left dir-ltr">
                {(this as any).state.errorInfo}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Helpers ---
const getWorkingDaysInMonth = (monthStr: string) => {
  const date = parseISO(monthStr + '-01');
  const year = date.getFullYear();
  const month = date.getMonth();
  const days = getDaysInMonth(date);
  let count = 0;
  for (let i = 1; i <= days; i++) {
    const d = new Date(year, month, i);
    if (d.getDay() !== 5) { // 5 is Friday
      count++;
    }
  }
  return count;
};

// --- Components ---

const LockedScreen = ({ message, onLogout }: { message?: string, onLogout: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-bg p-6 text-center">
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 border border-red-100"
    >
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertCircle className="text-red-500 w-10 h-10" />
      </div>
      <h2 className="text-2xl font-bold text-ink mb-4">تنبيه النظام</h2>
      <p className="text-secondary/60 mb-8 leading-relaxed">
        {message || 'عذراً، تم إيقاف البرنامج مؤقتاً. يرجى التواصل مع المطور لتجديد الاشتراك.'}
      </p>
      
      <button 
        onClick={onLogout}
        className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-3 mb-8 active:scale-[0.98]"
      >
        <LogOut size={20} className="rotate-180" />
        <span>تسجيل الخروج</span>
      </button>

      <div className="pt-6 border-t border-accent/10">
        <p className="text-[10px] font-black text-secondary/30 uppercase tracking-widest">
          نظام شركة OK المعتمد
        </p>
      </div>
    </motion.div>
  </div>
);

const SubscriptionManager = ({ config, showToast }: { config: SystemConfig | null, showToast: (msg: string, type?: 'success' | 'error') => void }) => {
  const [expiryDate, setExpiryDate] = useState(config?.expiryDate || '');
  const [isActive, setIsActive] = useState(config?.isActive ?? true);
  const [lockMessage, setLockMessage] = useState(config?.lockMessage || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setExpiryDate(config.expiryDate);
      setIsActive(config.isActive);
      setLockMessage(config.lockMessage || '');
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await dataService.updateSettings('config', {
        expiryDate,
        isActive,
        lockMessage
      });
      showToast('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      console.error('Error saving system config:', error);
      showToast('خطأ في حفظ الإعدادات: ' + (error instanceof Error ? error.message : String(error)), 'error');
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-accent/10 space-y-6">
        <h2 className="text-2xl font-bold text-ink">إدارة الاشتراك (للمطور فقط)</h2>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-secondary/60">تاريخ انتهاء الاشتراك</label>
            <input 
              type="date" 
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-bg/50 rounded-2xl">
            <span className="font-bold text-secondary/60">حالة البرنامج</span>
            <button 
              onClick={() => setIsActive(!isActive)}
              className={cn(
                "px-6 py-2 rounded-xl font-bold transition-all",
                isActive ? "bg-green-500 text-white" : "bg-red-500 text-white"
              )}
            >
              {isActive ? 'نشط' : 'متوقف'}
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-secondary/60">رسالة القفل</label>
            <textarea 
              value={lockMessage}
              onChange={(e) => setLockMessage(e.target.value)}
              className="input-field min-h-[100px] py-4"
              placeholder="اكتب الرسالة التي ستظهر عند قفل البرنامج..."
            />
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-secondary transition-all disabled:opacity-50"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </div>
    </div>
  );
};

// --- Main App Component ---

const parseTimestamp = (ts: any) => {
  if (!ts) return 0;
  if (typeof ts === 'string') return new Date(ts).getTime();
  if (ts.toMillis) return ts.toMillis();
  if (ts.seconds !== undefined) return ts.seconds * 1000;
  return 0;
};

export default function App() {
  console.log('App component rendering...');
  const isSupabaseConfigured = !!(import.meta as any).env.VITE_SUPABASE_URL && !!(import.meta as any).env.VITE_SUPABASE_ANON_KEY;
  console.log('Supabase configured:', isSupabaseConfigured);
  console.log('URL:', (import.meta as any).env.VITE_SUPABASE_URL ? 'PRESENT' : 'MISSING');
  console.log('KEY:', (import.meta as any).env.VITE_SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING');

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6 text-right" dir="rtl">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-blue-100 max-w-md w-full space-y-6">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
            <Database size={40} className="text-blue-500" />
          </div>
          <h2 className="text-2xl font-serif font-black text-ink text-center">إعداد Supabase مطلوب</h2>
          <p className="text-secondary text-center font-medium leading-relaxed">
            يرجى ضبط متغيرات البيئة <strong>VITE_SUPABASE_URL</strong> و <strong>VITE_SUPABASE_ANON_KEY</strong> في قائمة الإعدادات (Settings) في AI Studio لتشغيل التطبيق.
          </p>
          <div className="p-4 bg-slate-50 rounded-2xl text-[10px] space-y-2 dir-ltr text-left">
            <p>1. Open <strong>Settings</strong> in AI Studio.</p>
            <p>2. Go to <strong>Secrets</strong> or <strong>Environment Variables</strong>.</p>
            <p>3. Add the required Supabase keys.</p>
          </div>
        </div>
      </div>
    );
  }

  const navGroups = [
    {
      title: 'وظائف المندوب',
      items: [
        { id: 'invoice', label: 'فاتورة جديدة', icon: FileText, roles: ['manager', 'accountant', 'representative', 'supervisor'] },
        // مخفي مؤقتاً: { id: 'loading_request', label: 'التشغيلة', icon: ClipboardList, roles: ['manager', 'accountant', 'representative', 'supervisor'] },
        { id: 'customers', label: 'العملاء', icon: Users, roles: ['manager', 'accountant', 'representative', 'supervisor'] },
        { id: 'history', label: 'سجل المبيعات', icon: History, roles: ['manager', 'accountant', 'representative', 'supervisor'] },
        { id: 'settlement', label: 'تقفيلة اليوم', icon: ArrowUpDown, roles: ['manager', 'accountant', 'supervisor'] },
        { id: 'map', label: 'تتبع المناديب', icon: MapPin, roles: ['manager', 'supervisor'] },
      ]
    },
    {
      title: 'وظائف المخزن',
      items: [
        { id: 'products', label: 'المنتجات', icon: Package, roles: ['manager', 'supervisor'] },
        { id: 'loading', label: 'تحميل السيارة', icon: Package, roles: ['manager', 'accountant', 'storekeeper', 'supervisor'] },
        { id: 'receiving', label: 'الاستلام والتقفيل', icon: ArrowUpDown, roles: ['manager', 'accountant', 'storekeeper', 'supervisor'] },
        { id: 'attendance', label: 'حضور المناديب', icon: Clock, roles: ['manager', 'storekeeper'] },
        { id: 'phone_review', label: 'مراجعة الفواتير تليفونياً', icon: Phone, roles: ['manager', 'storekeeper'] },
      ]
    },
    {
      title: 'الإدارة والمالية',
      items: [
        { id: 'notifications', label: 'الإشعارات', icon: Bell, roles: ['manager', 'accountant', 'representative', 'supervisor', 'storekeeper'] },
        { id: 'admin_users', label: 'إدارة الموظفين', icon: Users, roles: ['manager'] },
        { id: 'admin_master_routes', label: 'خطوط السير', icon: Navigation, roles: ['manager', 'supervisor'] },
        { id: 'admin_target', label: 'إعدادات التارجت', icon: Target, roles: ['manager'] },
        // مخفي مؤقتاً: { id: 'admin_loading_requests', label: 'طلبات التشغيل (مجمعة)', icon: ClipboardList, roles: ['manager', 'supervisor', 'storekeeper'] },
        { id: 'admin_loans', label: 'إدارة السلف', icon: CreditCard, roles: ['manager', 'accountant'] },
        { id: 'admin_salaries', label: 'إدارة المرتبات', icon: Wallet, roles: ['manager', 'accountant'] },
        { id: 'admin_wallet', label: 'تأكيد المحفظة', icon: CheckCircle, roles: ['manager', 'accountant'] },
        { id: 'admin_subscription', label: 'إدارة الاشتراك', icon: SettingsIcon, roles: ['developer'] },
        { id: 'profile', label: 'الملف الشخصي', icon: UserIcon, roles: ['manager', 'accountant', 'representative', 'supervisor', 'storekeeper'] },
      ]
    }
  ];

  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'invoice' | 'products' | 'customers' | 'history' | 'settlement' | 'profile' | 'admin' | 'loading' | 'receiving' | 'map' | 'notifications' | 'attendance' | 'admin_users' | 'admin_master_routes' | 'admin_target' | 'admin_loans' | 'admin_salaries' | 'admin_loading_requests' | 'loading_request' | 'admin_subscription' | 'admin_wallet' | 'phone_review'>('profile');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        showToast(`خطأ في تفعيل وضع ملء الشاشة: ${err.message}`, 'error');
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auth States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [dbSetupError, setDbSetupError] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settlements, setSettlements] = useState<DailySettlement[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [masterRoutes, setMasterRoutes] = useState<MasterRoute[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const prevNotificationsRef = useRef<string[]>([]);

  // Deep Linking states
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');

  const isDeveloper = user?.email === 'mohsen@ok.com' || user?.email === 'okapp974@gmail.com' || user?.email === 'okkapp974@gmail.com' || profile?.role === 'developer';
  const isManager = profile?.role === 'manager' || user?.email === 'amin@ok.com' || user?.email === 'admin@ok.com' || isDeveloper;
  const isAccountant = profile?.role === 'accountant';
  const isSupervisor = profile?.role === 'supervisor';
  const isRepresentative = profile?.role === 'representative' || profile?.role === 'backup_representative';
  const isStorekeeper = profile?.role === 'storekeeper';

  // Time Sync State
  const [timeSyncResult, setTimeSyncResult] = useState<TimeSyncResult | null>(null);
  const [isCheckingTime, setIsCheckingTime] = useState(false);

  // Offline Protection State
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isCheckingOffline, setIsCheckingOffline] = useState(false);

  const handleCheckOffline = async () => {
    setIsCheckingOffline(true);
    try {
      const isConnected = await checkNetworkConnectivity();
      setIsOnline(isConnected);
    } catch {
      setIsOnline(false);
    } finally {
      setIsCheckingOffline(false);
    }
  };

  useEffect(() => {
    handleCheckOffline();
    const onOnline = () => handleCheckOffline();
    const onOffline = () => setIsOnline(false);

    const handleUserInteraction = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('pointerdown', handleUserInteraction, { capture: true });
    window.addEventListener('touchstart', handleUserInteraction, { capture: true });
    window.addEventListener('keydown', handleUserInteraction, { capture: true });

    // Listen to network connection type changes if supported
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      connection.addEventListener('change', handleCheckOffline);
    }

    // Ping every 4 seconds for instant offline detection
    const interval = setInterval(handleCheckOffline, 4000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('pointerdown', handleUserInteraction, { capture: true });
      window.removeEventListener('touchstart', handleUserInteraction, { capture: true });
      window.removeEventListener('keydown', handleUserInteraction, { capture: true });
      if (connection) {
        connection.removeEventListener('change', handleCheckOffline);
      }
      clearInterval(interval);
    };
  }, []);

  const handleCheckTimeSync = async () => {
    setIsCheckingTime(true);
    try {
      const res = await checkDeviceTimeSync();
      setTimeSyncResult(res);
    } catch (err) {
      console.error('Time sync check error:', err);
    } finally {
      setIsCheckingTime(false);
    }
  };

  useEffect(() => {
    handleCheckTimeSync();
    const interval = setInterval(handleCheckTimeSync, 60000);
    const onFocus = () => handleCheckTimeSync();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const canSeeAllData = isManager || isAccountant || isSupervisor || isDeveloper || isStorekeeper;

  const checkedMissedDaysRef = useRef(false);

  useEffect(() => {
    // Disabled automatic "يوم زيارة فائت" notifications to prevent spamming and reduce database egress.
    // Replaced with the requested feature: downloading missed visits report on daily sheet settlement.
  }, []);

  const isLocked = useMemo(() => {
    if (isDeveloper) return false;
    if (!systemConfig) return false;
    if (!systemConfig.isActive) return true;
    const expiry = new Date(systemConfig.expiryDate);
    return new Date() > expiry;
  }, [systemConfig, isDeveloper]);

  useEffect(() => {
    // Safety timeout to ensure loading screen doesn't stay forever
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const unsubscribe = authService.onAuthStateChanged((u) => {
      clearTimeout(safetyTimeout);
      setUser(u);
      if (!u) {
        setProfile(null);
        dataService.setCurrentUserProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      console.log('Loading profile for user:', user.email, user.uid);
      try {
        let data = await dataService.getDoc('users', user.uid);
        
        // Fallback: If not found by UID, search by email in database
        if (!data && user.email) {
          try {
            const { data: usersByEmail } = await supabase
              .from('users')
              .select('*')
              .ilike('email', user.email.toLowerCase().trim());
            if (usersByEmail && usersByEmail.length > 0) {
              data = usersByEmail[0];
            }
          } catch (e) {
            console.warn('Fallback search by email failed:', e);
          }
        }

        // Fallback: If master account and profile still not found, auto-bootstrap
        if (!data && user.email) {
          const lowerEmail = user.email.toLowerCase().trim();
          const isDev = lowerEmail === 'okapp974@gmail.com' || lowerEmail === 'okkapp974@gmail.com';
          const isMgr = lowerEmail === 'admin@ok.com' || lowerEmail === 'amin@ok.com';
          const isAcc = lowerEmail === 'mohsen@ok.com';

          if (isDev || isMgr || isAcc) {
            const bootstrapProfile: UserProfile = {
              uid: user.uid,
              id: user.uid,
              name: isDev ? 'المطور الرئيسي' : (lowerEmail.startsWith('amin') ? 'أمين - الإدارة' : (isAcc ? 'محسن - المحاسبة' : 'المدير العام (الرئيسي)')),
              email: lowerEmail,
              role: isDev ? 'developer' : (isAcc ? 'accountant' : 'manager'),
              baseSalary: 0,
              salaryType: 'monthly',
              targetBonus: 0,
              status: 'active'
            };
            try {
              await dataService.createUserProfile(user.uid, bootstrapProfile);
            } catch (e) {
              console.warn('Could not save bootstrapped profile:', e);
            }
            data = bootstrapProfile;
          }
        }

        if (data) {
          const p = data as UserProfile;
          if (p.status === 'inactive') {
            showToast('تم تعطيل هذا الحساب من قِبل الإدارة.', 'error');
            await authService.signOut();
            setUser(null);
            setProfile(null);
            return;
          }

          // Check if password on database was changed and no longer matches the active session
          if (user.sessionPassword && p.password && p.password.trim() !== user.sessionPassword.trim()) {
            showToast('تم تغيير كلمة المرور لهذا الحساب. يرجى تسجيل الدخول بكلمة المرور الجديدة.', 'error');
            await authService.signOut();
            setUser(null);
            setProfile(null);
            return;
          }

          console.log('Profile loaded successfully:', p);
          setProfile(p);
          dataService.setCurrentUserProfile(p);
          // Set active tab to profile or first available tab after login
          if (activeTab === 'invoice' && p.role !== 'manager' && p.role !== 'representative' && p.role !== 'accountant' && p.role !== 'supervisor') {
            setActiveTab('profile');
          }
        } else {
          console.warn('Profile document not found in "users" collection for UID:', user.uid);
          showToast('تم حذف هذا الحساب من قِبل الإدارة. تم تسجيل الخروج.', 'error');
          await authService.signOut();
          setUser(null);
          setProfile(null);
        }
      } catch (err: any) {
        console.error('Error loading user profile:', err);
        const errMsg = err?.message || JSON.stringify(err) || '';
        if (errMsg.includes('relation') || errMsg.includes('does not exist') || errMsg.includes('42P01')) {
          setDbSetupError(true);
          setShowSetupModal(true);
          showToast('تنبيه: جداول قاعدة البيانات غير موجودة. يرجى تهيئتها من مساعد الإعداد.', 'error');
        } else {
          showToast('فشل تحميل ملف تعريف المستخدم: ' + errMsg, 'error');
        }
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadProfile();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    console.log('Attaching Firestore listeners for user:', user.uid, 'Profile ready:', !!profile);
    // Start fetching even if profile is still loading for admins/developers
    const masterEmails = ['amin@ok.com', 'admin@ok.com', 'okapp974@gmail.com', 'okkapp974@gmail.com', 'mohsen@ok.com'];
    if (!profile && !isDeveloper && !masterEmails.includes(user.email || '')) {
      console.log('Waiting for profile to start listeners...');
      return;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const unsubProducts = dataService.getProducts((data) => {
      setProducts(data as Product[]);
    });
    
    const unsubCustomers = dataService.getCustomers((data) => {
      let filtered = (data as any[]).map(c => {
        // Direct mapping from Supabase columns as seen in user screenshot
        const name = c.shopname || c.shopName || c.name || 'بدون اسم';
        const owner = c.ownername || c.ownerName || c.owner || 'بدون اسم';
        const balance = c.openingbalance !== undefined ? c.openingbalance : (c.openingBalance || 0);
        const parsedDays = parseCustomerPreferredDays(c);

        return {
          ...c,
          shopName: name,
          ownerName: owner,
          openingBalance: balance,
          preferredDays: parsedDays
        };
      }) as Customer[];
      
      if (isRepresentative) {
        filtered = filtered.filter(c => {
          const userRouteId = profile?.routeId || (profile as any)?.routeid;
          const userRouteName = profile?.routeName || (profile as any)?.routename;
          const custRouteId = (c as any).routeId || (c as any).routeid;
          const custRouteName = (c as any).routeName || (c as any).routename;

          const isDirectCustomer = Boolean(
            (c.representativeId && profile?.uid && String(c.representativeId) === String(profile.uid)) ||
            (c.representativeId && user?.uid && String(c.representativeId) === String(user.uid)) ||
            (c.representativeId && (profile as any)?.id && String(c.representativeId) === String((profile as any)?.id)) ||
            (c.representativeName && profile?.name && c.representativeName.trim() === profile.name.trim())
          );

          const matchesRouteOfRep = Boolean(
            (userRouteId && custRouteId && String(userRouteId) === String(custRouteId)) ||
            (userRouteName && custRouteName && String(userRouteName).trim() === String(custRouteName).trim())
          );

          const repHasRoute = Boolean(userRouteId || userRouteName);

          if (isDirectCustomer) return true;
          if (repHasRoute) return matchesRouteOfRep;
          return true;
        });
      }
      setCustomers(filtered);
    });

    const unsubInvoices = dataService.getInvoices((data) => {
      let filtered = (data as any[]).map(i => {
        // Map top-level fields
        const id = i.id;
        const rawDate = i.date || i.timestamp || '';
        const date = normalizeDateStringToISO(rawDate);
        const time = i.time || (i.timestamp && i.timestamp.includes('T') ? i.timestamp.split('T')[1].substring(0, 8) : '');
        const customerId = i.customerid || i.customerId || '';
        const name = i.customername || i.customerName || i.shopname || i.shopName || 'عميل بدون اسم';
        const representativeId = i.representativeid || i.representativeId || '';
        const repName = i.representativename || i.representativeName || '';
        const totalPaid = Number(i.totalpaidtoday !== undefined ? i.totalpaidtoday : (i.totalPaidToday || 0));
        const sub = Number(i.subtotal !== undefined ? i.subtotal : (i.subtotal || 0));
        const discVal = Number(i.discountvalue !== undefined ? i.discountvalue : (i.discountValue || 0));
        const discType = i.discounttype || i.discountType || 'fixed';
        const cr = Number(i.credit !== undefined ? i.credit : (i.credit || 0));
        const coll = Number(i.collection !== undefined ? i.collection : (i.collection || 0));
        const wallet = Number(i.walletamount !== undefined ? i.walletamount : (i.walletAmount || 0));
        const walletConfirmed = i.iswalletconfirmed !== undefined ? i.iswalletconfirmed : (i.isWalletConfirmed || false);

        const routeId = i.routeid || i.routeId || '';
        const routeName = i.routename || i.routeName || '';

        // Map items array fields
        const rawItems = Array.isArray(i.items) 
          ? i.items 
          : (typeof i.items === 'string' 
              ? (() => { try { return JSON.parse(i.items); } catch { return []; } })() 
              : []);
        const mappedItems = rawItems.map((item: any) => {
          const price = Number(item.price !== undefined ? item.price : 0);
          const sold = Number(item.sold !== undefined ? item.sold : 0);
          const returnDamaged = Number(item.returndamaged !== undefined ? item.returndamaged : (item.returnDamaged || 0));
          const gifts = Number(item.gifts !== undefined ? item.gifts : 0);
          const total = item.total !== undefined ? Number(item.total) : ((sold - returnDamaged) * price);
          
          return {
            productId: item.productid || item.productId,
            productName: item.productname || item.productName,
            price,
            sold,
            returnDamaged,
            gifts,
            total
          };
        });
        
        return {
          ...i,
          id,
          date,
          time,
          customerId,
          customerName: name,
          representativeId,
          representativeName: repName,
          routeId,
          routeName,
          totalPaidToday: totalPaid,
          subtotal: sub,
          discountValue: discVal,
          discountType: discType,
          credit: cr,
          collection: coll,
          walletAmount: wallet,
          isWalletConfirmed: walletConfirmed,
          items: mappedItems
        };
      }) as Invoice[];
      
      if (isRepresentative) {
        const userRouteId = profile?.routeId || (profile as any)?.routeid;
        const userRouteName = profile?.routeName || (profile as any)?.routename;

        filtered = filtered.filter(i => {
          const invRepId = (i as any).representativeId || (i as any).representativeid || (i as any).representative_id;
          const invRouteId = (i as any).routeId || (i as any).routeid;
          const invRouteName = (i as any).routeName || (i as any).routename;

          const isDirectRep = Boolean(
            (invRepId && profile?.uid && String(invRepId) === String(profile.uid)) ||
            (invRepId && user?.uid && String(invRepId) === String(user.uid)) ||
            (invRepId && (profile as any)?.id && String(invRepId) === String((profile as any)?.id)) ||
            (i.representativeName && profile?.name && i.representativeName.trim() === profile.name.trim()) ||
            (profile?.email && (i as any).representativeEmail && (i as any).representativeEmail.toLowerCase() === profile.email.toLowerCase())
          );
          const matchesInvRoute = Boolean(
            (userRouteId && invRouteId && String(userRouteId) === String(invRouteId)) ||
            (userRouteName && invRouteName && String(userRouteName).trim() === String(invRouteName).trim())
          );

          const custObj = customers.find(c => c.id === i.customerId || c.id === (i as any).customerid);
          const custRouteId = custObj?.routeId || (custObj as any)?.routeid;
          const custRouteName = custObj?.routeName || (custObj as any)?.routename;
          const matchesCustRoute = Boolean(
            (userRouteId && custRouteId && String(userRouteId) === String(custRouteId)) ||
            (userRouteName && custRouteName && String(userRouteName).trim() === String(custRouteName).trim())
          );

          const repHasRoute = Boolean(userRouteId || userRouteName);

          if (isDirectRep) return true;
          if (repHasRoute) return matchesInvRoute || matchesCustRoute;
          return true;
        });
      }
      setInvoices(filtered);
    });

    const unsubSettlements = dataService.getSettlements((data) => {
      let filtered = data as DailySettlement[];
      if (isRepresentative) {
        filtered = filtered.filter(s => s.representativeId === user.uid);
      }
      setSettlements(filtered);
    });

    const unsubSettings = dataService.getSettings((data) => {
      if (data.length > 0) {
        setSettings(data[0] as Settings);
      }
    });

    const unsubSystemConfig = dataService.getSystemConfig((data) => {
      if (data.length > 0) {
        setSystemConfig(data[0] as SystemConfig);
      }
    });

    let unsubLoans = () => {};
    if (canSeeAllData || isRepresentative) {
      unsubLoans = dataService.getLoans((data) => {
        let filtered = data as Loan[];
        if (isRepresentative) {
          filtered = filtered.filter(l => l.employeeId === user.uid);
        }
        setLoans(filtered);
      });
    }

    const unsubRoutes = dataService.getRoutes((data) => {
      let filtered = data as Route[];
      const today = format(new Date(), 'yyyy-MM-dd');
      filtered = filtered.filter(r => r.date === today);
      if (isRepresentative) {
        filtered = filtered.filter(r => r.representativeId === user.uid);
      }
      setRoutes(filtered);
    });

    const unsubMasterRoutes = dataService.getMasterRoutes((data) => {
      setMasterRoutes(data as MasterRoute[]);
    });

    let unsubAttendance = () => {};
    if (canSeeAllData || isRepresentative) {
      unsubAttendance = dataService.getAttendance((data) => {
        let filtered = data as Attendance[];
        if (isRepresentative) {
          filtered = filtered.filter(a => a.employeeId === user.uid);
        }
        setAttendance(filtered);
      });
    }

    let unsubUsers = () => {};
    unsubUsers = dataService.getUsers((data) => {
      const allFetchedUsers = data as UserProfile[];
      const filtered = allFetchedUsers.filter(u => u.role !== 'developer' || profile?.role === 'developer');
      setAllUsers(canSeeAllData ? filtered : (profile ? [profile] : []));

      // Real-time check if currently logged in user was deleted, deactivated, or password changed
      if (user && user.uid && allFetchedUsers.length > 0) {
        const currentUserInDb = allFetchedUsers.find(u => u.uid === user.uid || (u as any).id === user.uid || (u.email && user.email && u.email.toLowerCase() === user.email.toLowerCase()));
        if (!currentUserInDb) {
          showToast('تم حذف حسابك من قِبل الإدارة. تم تسجيل الخروج تلقائياً.', 'error');
          authService.signOut();
        } else if (currentUserInDb.status === 'inactive') {
          showToast('تم تعطيل حسابك من قِبل الإدارة. تم تسجيل الخروج تلقائياً.', 'error');
          authService.signOut();
        } else if (
          (user.sessionPassword && currentUserInDb.password && currentUserInDb.password.trim() !== user.sessionPassword.trim()) ||
          (profile && profile.password && currentUserInDb.password && currentUserInDb.password.trim() !== profile.password.trim())
        ) {
          showToast('تم تغيير كلمة المرور لهذا الحساب من قِبل الإدارة. تم تسجيل الخروج تلقائياً.', 'error');
          authService.signOut();
          setUser(null);
          setProfile(null);
        }
      }
    });

    let unsubNotifications = () => {};
    if (profile) {
      unsubNotifications = dataService.getNotifications((data) => {
        let filtered = data as Notification[];
        if (!canSeeAllData) {
          filtered = filtered.filter(n => n.recipientId === profile.uid);
        } else if (isStorekeeper) {
          // Storekeeper only sees notifications when work is finished (settlement) or direct notifications
          filtered = filtered.filter(n => n.recipientId === profile.uid || (n.recipientId === null && n.type === 'settlement'));
        } else {
          filtered = filtered.filter(n => n.recipientId === null || n.recipientId === profile.uid);
        }
        
        // Sort in memory
        filtered.sort((a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp));

        setNotifications(filtered);

        // Check for new notifications to show browser alert
        const newIds = filtered.map(n => n.id);
        const addedNotifications = filtered.filter(n => !prevNotificationsRef.current.includes(n.id) && !n.isRead);
        
        if (addedNotifications.length > 0 && prevNotificationsRef.current.length > 0) {
          addedNotifications.forEach(async (n) => {
            // Show in-app toast
            showToast(`${n.title}: ${n.message}`);
            
            if (Notification.permission === 'granted') {
              const options = {
                body: n.message,
                icon: 'https://cdn-icons-png.flaticon.com/512/1162/1162456.png',
                data: { targetTab: n.targetTab, type: n.type },
                badge: 'https://cdn-icons-png.flaticon.com/512/1162/1162456.png'
              };

              // Use Service Worker for more reliable notifications on mobile
              if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                registration.showNotification(n.title, options);
              } else {
                const notification = new Notification(n.title, options);
                notification.onclick = (event) => {
                  event.preventDefault();
                  window.focus();
                  
                  let target = n.targetTab;
                  if (!target) {
                    if (n.type === 'invoice' || n.type === 'settlement') target = 'history';
                    else if (n.type === 'customer') target = 'customers';
                    else if (n.type === 'loan') target = 'admin_loans';
                  }

                  if (target) {
                    setActiveTab(target);
                    setIsSidebarOpen(false);
                  }
                  notification.close();
                };
              }
            }
          });
        }
        prevNotificationsRef.current = newIds;
      });
    }

    return () => {
      unsubProducts();
      unsubCustomers();
      unsubInvoices();
      unsubSettlements();
      unsubSettings();
      unsubSystemConfig();
      unsubLoans();
      unsubRoutes();
      unsubMasterRoutes();
      unsubAttendance();
      unsubUsers();
      unsubNotifications();
    };
  }, [user, profile, canSeeAllData, isRepresentative, isDeveloper]);

  useEffect(() => {
    if (!user || !profile) return;

    // Expose requestPermission to window for manual trigger
    (window as any).requestNotificationPermission = () => notificationService.requestPermission(user.uid, showToast);

    const checkPermission = async () => {
      if (Notification.permission === 'default') {
        // Only auto-request on desktop, mobile usually requires user gesture
        if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          notificationService.requestPermission(user.uid, showToast);
        }
      }
    };
    checkPermission();

    return () => {};
  }, [user, profile]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);
    console.log('Attempting auth:', { email });
    const lowerEmail = email.toLowerCase().trim();
    const adminEmails = ['admin@ok.com', 'amin@ok.com', 'mohsen@ok.com', 'okapp974@gmail.com', 'okkapp974@gmail.com'];
    const isActuallyAdminEmail = adminEmails.includes(lowerEmail);

    try {
      const u = await authService.signIn(lowerEmail, password);
      setUser(u);
      console.log('User signed in successfully');
    } catch (err: any) {
      console.error('Auth error details:', err);
      let message = err.message || 'فشل المصادقة. يرجى التحقق من بيانات الاعتماد الخاصة بك.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        message = 'بيانات الاعتماد غير صالحة. تأكد من البريد وكلمة المرور.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'تم حظر الحساب مؤقتاً بسبب تكرار المحاولات الخاطئة. حاول لاحقاً.';
      } else if (err.code === 'auth/user-disabled') {
        message = 'هذا الحساب تم تعطيله.';
      }
      setAuthError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setAuthError('يرجى إدخال البريد الإلكتروني أولاً لإعادة تعيين كلمة المرور.');
      return;
    }
    try {
      await authService.resetPassword(email);
      showToast('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.');
    } catch (err: any) {
      setAuthError('فشل إرسال بريد إعادة التعيين: ' + err.message);
    }
  };

  const handleLogout = () => authService.signOut();

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // Initialize settings if they don't exist and user is manager
  useEffect(() => {
    if (profile?.role === 'manager' && !settings) {
      const checkSettings = async () => {
        try {
          const data = await dataService.getDoc('settings', 'global');
          if (!data) {
            await dataService.updateSettings('global', { dailyTarget: 1000 });
          }
        } catch (err) {
          console.error('Error checking/initializing settings:', err);
        }
      };
      checkSettings();
    }
  }, [profile?.role, settings]);

  const filteredNavGroups = useMemo(() => {
    return navGroups.map(group => ({
      ...group,
      items: group.items.filter(item => {
        const userRole = profile?.role;
        if (!userRole && !isDeveloper && user?.email !== 'amin@ok.com') return false;

        if (item.roles.includes('developer')) return isDeveloper;
        if (isManager && item.roles.includes('manager')) return true;
        if (isAccountant && item.roles.includes('accountant')) return true;
        if (isSupervisor && item.roles.includes('supervisor')) return true;
        if (isRepresentative && item.roles.includes('representative')) return true;
        if (isStorekeeper && item.roles.includes('storekeeper')) return true;
        
        // Fallback check
        return userRole && item.roles.includes(userRole);
      })
    })).filter(group => group.items.length > 0);
  }, [navGroups, profile, isDeveloper, user?.email, isManager, isAccountant, isSupervisor, isRepresentative, isStorekeeper]);

  const allFilteredItems = useMemo(() => {
    return filteredNavGroups.flatMap(g => g.items);
  }, [filteredNavGroups]);

  // Auto-switch to a valid tab if the current one is not allowed for the user's role
  useEffect(() => {
    if (profile && allFilteredItems.length > 0) {
      const isCurrentTabValid = allFilteredItems.some(item => item.id === activeTab);
      if (!isCurrentTabValid) {
        console.log('Current tab invalid for role, switching to:', allFilteredItems[0].id);
        setActiveTab(allFilteredItems[0].id as any);
      }
    }
  }, [profile, activeTab, allFilteredItems]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-4">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-secondary/40 font-serif font-bold animate-pulse">جاري تحميل البيانات...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-primary/5 p-10 border border-accent/20"
        >
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-primary rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/20">
              <Package className="text-white w-12 h-12" />
            </div>
            <h1 className="text-4xl font-serif font-bold text-ink mb-2">شركة OK</h1>
            <p className="text-secondary/60 text-sm font-medium tracking-wide">
              تسجيل دخول الموظفين
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-secondary/40 uppercase tracking-[0.2em] px-1">البريد الإلكتروني</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field text-right"
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-secondary/40 uppercase tracking-[0.2em] px-1">كلمة المرور</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field text-right"
                placeholder="••••••••"
              />
            </div>
            
            {authError && (
              <motion.p 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-red-500 text-xs font-bold text-center bg-red-50 py-2 rounded-lg"
              >
                {authError}
              </motion.p>
            )}

            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-5 px-6 bg-primary text-white rounded-[1.5rem] font-bold hover:bg-secondary transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-70"
            >
              {isLoggingIn ? (
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-white"></div>
              ) : (
                <>
                  <LogOut size={22} className="rotate-180" />
                  <span className="text-lg">دخول النظام</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-accent/10">
            <p className="text-center text-[9px] text-secondary/30 uppercase tracking-[0.3em] font-black">
              نظام شركة OK المعتمد
            </p>
          </div>
        </motion.div>

        {/* Supabase Database Setup Modal */}
        <AnimatePresence>
          {showSetupModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" dir="rtl">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-[2rem] max-w-lg w-full p-8 shadow-2xl relative border border-accent/20 text-ink overflow-y-auto max-h-[90vh]"
              >
                <button
                  type="button"
                  onClick={() => setShowSetupModal(false)}
                  className="absolute top-6 left-6 text-secondary/40 hover:text-secondary hover:bg-red-50 p-2 rounded-full transition-all"
                >
                  <X size={20} />
                </button>

                <div className="flex items-center gap-3 mb-6 text-right">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold font-serif text-right text-ink">مساعد تهيئة قاعدة بيانات Supabase</h3>
                    <p className="text-xs text-secondary/50 font-sans font-medium text-right">خطوات بسيطة لتفعيل تطبيقك بنجاح</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-xs font-sans leading-relaxed mb-6 font-medium text-right">
                  ⚠️ <strong>تنبيه هام:</strong> يبدو أن جداول قاعدة البيانات غير موجودة في حساب سوبابيس الخاص بك حتى الآن. يرجى تهيئتها باتباع الخطوات البسيطة التالية لتتمكن من تسجيل الدخول واستخدام كافة ميزات البرنامج.
                </div>

                <div className="space-y-6 text-sm font-sans mb-8 text-right">
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">1</div>
                    <div>
                      <p className="font-bold text-ink mb-1 text-right">نسخ كود التهيئة</p>
                      <p className="text-xs text-secondary/60 mb-2 font-medium text-right">اضغط على الزر أدناه لنسخ الكود البرمجي بالكامل لتجهيز الجداول والبيانات الأساسية تلقائياً.</p>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
                          setCopiedSql(true);
                          showToast('تم نسخ كود SQL بنجاح! جاهز للصق.', 'success');
                          setTimeout(() => setCopiedSql(false), 3000);
                        }}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all mx-auto md:mx-0 ${
                          copiedSql 
                            ? 'bg-green-600 text-white shadow-lg shadow-green-100' 
                            : 'bg-primary text-white hover:bg-secondary shadow-lg shadow-primary/10'
                        }`}
                      >
                        {copiedSql ? <Check size={14} /> : <Copy size={14} />}
                        {copiedSql ? 'تم نسخ الكود!' : 'نسخ كود SQL للتهيئة'}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">2</div>
                    <div>
                      <p className="font-bold text-ink mb-1 text-right">فتح لوحة تحكم Supabase</p>
                      <p className="text-xs text-secondary/60 mb-2 font-medium text-right">افتح لوحة تحكم سوبابيس الخاصة بمشروعك الحالي:</p>
                      <a 
                        href="https://supabase.com/dashboard" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline"
                      >
                        فتح موقع Supabase Dashboard ↗
                      </a>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">3</div>
                    <div>
                      <p className="font-bold text-ink mb-1 text-right">تشغيل الكود البرمجي (Run SQL)</p>
                      <ul className="text-xs text-secondary/60 list-disc list-inside space-y-1 pr-2 font-medium text-right">
                        <li>من القائمة الجانبية اليسرى، اضغط على أيقونة <strong>SQL Editor</strong>.</li>
                        <li>اضغط على <strong>New Query</strong> لإنشاء صفحة فارغة.</li>
                        <li>قم بلصق الكود الذي نسخته في الخطوة الأولى.</li>
                        <li>اضغط على زر <strong>Run</strong> (أو الاختصار Ctrl+Enter) لتنفيذ الأمر.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">4</div>
                    <div>
                      <p className="font-bold text-ink mb-1 text-right">تمت التهيئة بنجاح!</p>
                      <p className="text-xs text-secondary/60 font-medium text-right">بمجرد الانتهاء، ستنشأ كافة الجداول تلقائياً والمنتجات الافتراضية. يمكنك تسجيل الدخول الآن بكل سهولة!</p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowSetupModal(false);
                    window.location.reload();
                  }}
                  className="w-full py-4 bg-secondary text-white rounded-2xl font-bold hover:bg-primary transition-all shadow-xl shadow-secondary/10 flex items-center justify-center gap-2"
                >
                  <RefreshCcw size={18} />
                  <span>لقد قمت بالتهيئة، تحديث لتسجيل الدخول</span>
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (isLocked) {
    return <LockedScreen message={systemConfig?.lockMessage} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row font-sans text-ink" dir="rtl">
      {/* Mobile Header */}
      <div className="md:hidden bg-white/90 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-accent/10 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
            <Package className="text-white w-5 h-5" />
          </div>
          <span className="font-serif font-bold text-xl tracking-tight">شركة OK</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleFullScreen}
            className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-secondary/60 hover:bg-accent/20 transition-all active:scale-90"
            title={isFullscreen ? "خروج من ملء الشاشة" : "ملء الشاشة"}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <div className="text-[10px] font-bold text-secondary/60 bg-accent/20 px-2 py-1 rounded-md uppercase">
            {profile?.role === 'manager' ? 'مدير' : 'موظف'}
          </div>
        </div>
      </div>

      {/* Sidebar (Desktop Only) */}
      <aside className="hidden md:flex w-80 bg-white border-l border-accent/10 flex-col sticky top-0 h-screen">
        <div className="p-10">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20">
              <Package className="text-white w-7 h-7" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-2xl leading-tight">شركة OK</h1>
              <p className="text-[10px] text-secondary/40 uppercase tracking-[0.2em] font-black">نظام الإدارة المتكامل</p>
            </div>
            <button 
              onClick={toggleFullScreen}
              className="mr-auto w-10 h-10 bg-accent/5 rounded-xl flex items-center justify-center text-secondary/40 hover:bg-accent/10 hover:text-primary transition-all active:scale-90"
              title={isFullscreen ? "خروج من ملء الشاشة" : "ملء الشاشة"}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>

        <nav className="flex-1 px-6 space-y-6 overflow-y-auto custom-scrollbar py-4">
          {filteredNavGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="px-4 text-[10px] font-black text-secondary/30 uppercase tracking-[0.2em] mb-3">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={cn(
                      "w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                      activeTab === item.id 
                        ? "bg-primary text-white shadow-xl shadow-primary/20" 
                        : "text-secondary/60 hover:bg-accent/10 hover:text-primary"
                    )}
                  >
                    <item.icon size={20} className={cn("transition-transform duration-300 group-hover:scale-110", activeTab === item.id ? "text-white" : "text-secondary/40 group-hover:text-primary")} />
                    <span className="font-bold tracking-wide text-sm">{item.label}</span>
                    {item.id === 'notifications' && notifications.filter(n => !n.isRead).length > 0 && (
                      <span className="mr-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {notifications.filter(n => !n.isRead).length}
                      </span>
                    )}
                    {activeTab === item.id && (
                      <motion.div layoutId="active-indicator" className="mr-auto">
                        <ChevronLeft size={16} />
                      </motion.div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-8 border-t border-accent/10">
          <div className="flex items-center gap-4 p-4 bg-bg rounded-[1.5rem] border border-accent/5 mb-6">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-accent/10 overflow-hidden">
              {profile?.photoURL ? (
                <img 
                  src={profile.photoURL} 
                  alt={profile.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserIcon className="text-primary w-5 h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{profile?.name}</p>
              <p className="text-[10px] text-secondary/50 truncate uppercase tracking-tighter">{profile?.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full py-4 px-6 border border-red-100 text-red-500 rounded-2xl font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-3 active:scale-95"
          >
            <LogOut size={20} />
            خروج من النظام
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-2 md:p-12 overflow-y-auto custom-scrollbar pb-24 md:pb-12">
        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'invoice' && <InvoiceTab products={products} customers={customers} profile={profile} showToast={showToast} invoices={invoices} settings={settings} settlements={settlements} />}
              {activeTab === 'products' && <ProductsTab products={products} setProducts={setProducts} profile={profile} showToast={showToast} />}
               {activeTab === 'customers' && (
                <CustomersTab 
                  customers={customers} 
                  profile={profile} 
                  showToast={showToast} 
                  searchQuery={customerSearchQuery}
                  setSearchQuery={setCustomerSearchQuery}
                  masterRoutes={masterRoutes}
                />
              )}
              {activeTab === 'history' && (
                <HistoryTab 
                  invoices={invoices} 
                  customers={customers} 
                  profile={profile} 
                  showToast={showToast} 
                  allUsers={allUsers} 
                  products={products} 
                  settings={settings} 
                  invoiceSearchQuery={invoiceSearchQuery}
                  setInvoiceSearchQuery={setInvoiceSearchQuery}
                />
              )}
              {activeTab === 'settlement' && <DailySettlementTab products={products} invoices={invoices} profile={profile} showToast={showToast} allUsers={allUsers} customers={customers} />}
              {activeTab === 'loading' && <CarLoadingTab products={products} profile={profile} showToast={showToast} allUsers={allUsers} />}
              {activeTab === 'receiving' && <ReceivingTab products={products} invoices={invoices} profile={profile} showToast={showToast} allUsers={allUsers} customers={customers} />}
              {activeTab === 'attendance' && <AttendanceTab allUsers={allUsers} attendance={attendance} showToast={showToast} profile={profile} />}
              {activeTab === 'profile' && <ProfileTab profile={profile} showToast={showToast} loans={loans} attendance={attendance} settlements={settlements} invoices={invoices} customers={customers} products={products} settings={settings} />}
              {activeTab === 'notifications' && (
                <NotificationsTab 
                  notifications={notifications} 
                  showToast={showToast} 
                  setActiveTab={setActiveTab} 
                  setIsSidebarOpen={setIsSidebarOpen} 
                  customers={customers}
                  invoices={invoices}
                  setCustomerSearchQuery={setCustomerSearchQuery}
                  setInvoiceSearchQuery={setInvoiceSearchQuery}
                />
              )}
              {activeTab === 'admin_users' && <AdminTab mode="users" profile={profile} showToast={showToast} settings={settings} loans={loans} attendance={attendance} settlements={settlements} invoices={invoices} customers={customers} products={products} masterRoutes={masterRoutes} onUpdateProfile={(updated) => setProfile(updated)} />}
              {activeTab === 'admin_master_routes' && <MasterRoutesTab masterRoutes={masterRoutes} allUsers={allUsers} customers={customers} showToast={showToast} />}
              {activeTab === 'admin_target' && <AdminTab mode="target" profile={profile} showToast={showToast} settings={settings} loans={loans} attendance={attendance} settlements={settlements} invoices={invoices} customers={customers} products={products} masterRoutes={masterRoutes} onUpdateProfile={(updated) => setProfile(updated)} />}
              {activeTab === 'admin_loans' && <AdminTab mode="loans" profile={profile} showToast={showToast} settings={settings} loans={loans} attendance={attendance} settlements={settlements} invoices={invoices} customers={customers} products={products} onUpdateProfile={(updated) => setProfile(updated)} />}
              {activeTab === 'admin_salaries' && <AdminTab mode="salaries" profile={profile} showToast={showToast} settings={settings} loans={loans} attendance={attendance} settlements={settlements} invoices={invoices} customers={customers} products={products} onUpdateProfile={(updated) => setProfile(updated)} />}
              {activeTab === 'admin_wallet' && <AdminTab mode="wallet_confirmation" profile={profile} showToast={showToast} settings={settings} loans={loans} attendance={attendance} settlements={settlements} invoices={invoices} customers={customers} products={products} onUpdateProfile={(updated) => setProfile(updated)} />}
              {activeTab === 'admin_loading_requests' && <AdminTab mode="loading_requests" profile={profile} showToast={showToast} settings={settings} loans={loans} attendance={attendance} settlements={settlements} invoices={invoices} customers={customers} products={products} onUpdateProfile={(updated) => setProfile(updated)} />}
              {activeTab === 'admin_subscription' && <SubscriptionManager config={systemConfig} showToast={showToast} />}
              {activeTab === 'loading_request' && <LoadingRequestTab products={products} customers={customers} profile={profile} showToast={showToast} />}
              {activeTab === 'map' && <MapTab users={allUsers} customers={customers} routes={routes} settings={settings} />}
              {activeTab === 'phone_review' && <PhoneReviewTab invoices={invoices} customers={customers} allUsers={allUsers} products={products} showToast={showToast} profile={profile} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <LocationTracker profile={profile} />

      {/* Time Sync Blocker for Non-Managers */}
      {timeSyncResult && !timeSyncResult.isSync && !isManager && !isDeveloper && (
        <TimeSyncBlocker 
          syncResult={timeSyncResult}
          onRecheck={handleCheckTimeSync}
          isChecking={isCheckingTime}
        />
      )}

      {/* Offline Blocker for Non-Managers */}
      {!isOnline && !isManager && !isDeveloper && (
        <OfflineBlocker 
          onRetry={handleCheckOffline}
          isChecking={isCheckingOffline}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-accent/10 px-2 py-2 flex items-center z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-4 min-w-max px-4">
          {allFilteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all relative",
                activeTab === item.id ? "text-primary" : "text-secondary/40"
              )}
            >
              <item.icon size={20} className={cn("transition-transform", activeTab === item.id && "scale-110")} />
              {item.id === 'notifications' && notifications.filter(n => !n.isRead).length > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-white">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              )}
              <span className="text-[8px] font-black uppercase tracking-tighter">{item.label.split(' ')[0]}</span>
              {activeTab === item.id && (
                <motion.div 
                  layoutId="mobile-active"
                  className="absolute -top-1 w-1 h-1 bg-primary rounded-full"
                />
              )}
            </button>
          ))}
          <button 
            onClick={handleLogout}
            className="flex flex-col items-center gap-1 p-1.5 text-red-400"
          >
            <LogOut size={20} />
            <span className="text-[8px] font-black uppercase tracking-tighter">خروج</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

// --- Components ---

function LocationTracker({ profile }: { profile: UserProfile | null }) {
  const watchId = useRef<number | null>(null);
  const intervalId = useRef<any>(null);

  useEffect(() => {
    if (profile?.role === 'representative' || profile?.role === 'backup_representative') {
      if (!navigator.geolocation) {
        console.error('Geolocation is not supported by your browser');
        return;
      }

      const updateLocation = async (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        const now = new Date();
        const dateStr = format(now, 'yyyy-MM-dd');
        const timestamp = now.toISOString();

        try {
          // Update user's last location
          await dataService.updateUser(profile.uid, {
            lastLocation: {
              lat: latitude,
              lng: longitude,
              timestamp
            }
          });

          // Update daily route
          const routeId = `${profile.uid}_${dateStr}`;
          const newPoint = { lat: latitude, lng: longitude, timestamp };

          const existingRoute = await dataService.getRoute(routeId);
          
          if (existingRoute) {
            const currentPoints = existingRoute.points || [];
            const lastPoint = currentPoints[currentPoints.length - 1];
            // Only add if significantly different from last point (approx 10-15 meters)
            if (!lastPoint || (Math.abs(lastPoint.lat - latitude) > 0.0001 || Math.abs(lastPoint.lng - longitude) > 0.0001)) {
              await dataService.updateRoute(routeId, {
                points: [...currentPoints, newPoint]
              });
            }
          } else {
            await dataService.upsertRoute(routeId, {
              representativeId: profile.uid,
              date: dateStr,
              points: [newPoint]
            });
          }
        } catch (err) {
          console.error('Error updating location/route:', err);
        }
      };

      watchId.current = navigator.geolocation.watchPosition(
        updateLocation,
        (err) => console.warn('Geolocation watch notice (normal in sandbox/iframe):', err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      // Fallback interval to ensure "live" updates even if watchPosition stalls
      intervalId.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          updateLocation,
          (err) => console.warn('Geolocation fallback notice (normal in sandbox/iframe):', err.message),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }, 30000); // Every 30 seconds
    }

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      if (intervalId.current !== null) clearInterval(intervalId.current);
    };
  }, [profile]);

  return null;
}

function MapTab({ users, customers, routes, settings }: { users: UserProfile[], customers: Customer[], routes: Route[], settings: Settings | null }) {
  const reps = users.filter(u => (u.role === 'representative' || u.role === 'backup_representative') && u.lastLocation);
  const [selectedRep, setSelectedRep] = useState<UserProfile | null>(null);

  const MapUpdater = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
      map.setView(center, 13);
    }, [center, map]);
    return null;
  };

  const selectedRoute = useMemo(() => {
    if (!selectedRep) return null;
    return routes.find(r => r.representativeId === selectedRep.uid);
  }, [selectedRep, routes]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-serif font-bold text-ink mb-1">تتبع المناديب</h2>
          <p className="text-secondary/60 text-sm font-medium">مواقع المناديب والعملاء وخطوط السير</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {reps.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-[2rem] border border-accent/10">
              <MapPin className="w-12 h-12 text-secondary/20 mx-auto mb-4" />
              <p className="text-secondary/40 font-bold">لا يوجد مناديب نشطين حالياً</p>
            </div>
          ) : (
            reps.map(rep => (
              <div 
                key={rep.uid}
                className={cn(
                  "bg-white p-4 rounded-2xl border transition-all cursor-pointer",
                  selectedRep?.uid === rep.uid ? "border-primary shadow-md" : "border-accent/10 shadow-sm hover:shadow-md"
                )}
                onClick={() => setSelectedRep(rep)}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink">{rep.name}</h3>
                    <p className="text-[10px] text-secondary/40 uppercase tracking-wider font-bold">مندوب مبيعات</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-secondary/60">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {rep.lastLocation && (new Date().getTime() - new Date(rep.lastLocation.timestamp).getTime() < 60000) ? (
                      <span className="flex items-center gap-1 text-green-500 font-bold">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        مباشر الآن
                      </span>
                    ) : (
                      <span>{rep.lastLocation ? format(new Date(rep.lastLocation.timestamp), 'HH:mm:ss') : '-'}</span>
                    )}
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://www.google.com/maps?q=${rep.lastLocation?.lat},${rep.lastLocation?.lng}`, '_blank');
                    }}
                    className="flex items-center gap-1 text-primary font-bold hover:underline"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>خرائط Google</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-3 bg-white rounded-[2rem] border border-accent/10 overflow-hidden min-h-[600px] relative shadow-xl">
          <MapContainer 
            center={[30.0444, 31.2357]} 
            zoom={10} 
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Factory Marker */}
            {settings?.factoryLocation && (
              <Marker position={[settings.factoryLocation.lat, settings.factoryLocation.lng]}>
                <Popup>
                  <div className="text-right font-sans">
                    <p className="font-bold text-primary">المصنع</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Customer Markers */}
            {customers.map(customer => customer.location && (
              <Marker 
                key={customer.id} 
                position={[customer.location.lat, customer.location.lng]}
                icon={L.icon({
                  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                  iconSize: [25, 41],
                  iconAnchor: [12, 41],
                  popupAnchor: [1, -34],
                  shadowSize: [41, 41]
                })}
              >
                <Popup>
                  <div className="text-right font-sans">
                    <p className="font-bold text-ink">{customer.shopName}</p>
                    <p className="text-xs text-secondary/60">{customer.ownerName}</p>
                    <p className="text-xs text-secondary/60">{customer.area}</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Representative Markers */}
            {reps.map(rep => {
              const isLive = rep.lastLocation && (new Date().getTime() - new Date(rep.lastLocation.timestamp).getTime() < 60000);
              return rep.lastLocation && (
                <Marker 
                  key={rep.uid} 
                  position={[rep.lastLocation.lat, rep.lastLocation.lng]}
                >
                  <Popup>
                    <div className="text-right font-sans">
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <p className="font-bold text-primary">{rep.name}</p>
                        {isLive && (
                          <span className="flex items-center gap-1 text-[10px] text-green-500 font-bold">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            مباشر
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-secondary/60">آخر تحديث: {format(new Date(rep.lastLocation.timestamp), 'HH:mm:ss')}</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Route Polyline */}
            {selectedRoute && selectedRoute.points.length > 1 && (
              <Polyline 
                positions={selectedRoute.points.map(p => [p.lat, p.lng] as [number, number])}
                color="#3b82f6"
                weight={4}
                opacity={0.6}
              />
            )}

            {selectedRep?.lastLocation && <MapUpdater center={[selectedRep.lastLocation.lat, selectedRep.lastLocation.lng]} />}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 50, x: '-50%' }}
      className={cn(
        "fixed bottom-24 left-1/2 z-[9999] px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-3 min-w-[280px] justify-center",
        type === 'success' ? "bg-primary text-white" : "bg-red-500 text-white"
      )}
    >
      {type === 'success' ? <Check size={18} /> : <X size={18} />}
      {message}
    </motion.div>
  );
}

function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = "تأكيد",
  cancelText = "إلغاء",
  isDestructive = false,
  loading = false
}: { 
  isOpen: boolean, 
  title: string, 
  message: string, 
  onConfirm: () => void, 
  onCancel: () => void,
  confirmText?: string,
  cancelText?: string,
  isDestructive?: boolean,
  loading?: boolean
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-accent/20"
        >
          <h3 className="text-xl font-serif font-bold text-ink mb-2">{title}</h3>
          <p className="text-secondary/60 text-sm mb-8 leading-relaxed">{message}</p>
          <div className="flex gap-3">
            <button 
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                "flex-1 py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2",
                isDestructive ? "bg-red-500 text-white shadow-red-500/20" : "bg-primary text-white shadow-primary/20",
                loading && "opacity-50 cursor-not-allowed"
              )}
            >
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>}
              {confirmText}
            </button>
            <button 
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-4 bg-bg text-secondary rounded-2xl font-bold hover:bg-accent/10 transition-all active:scale-95 disabled:opacity-50"
            >
              {cancelText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// --- Tab Components ---

function InvoiceTab({ products, customers, profile, showToast, invoices, settings, settlements = [] }: { 
  products: Product[], 
  customers: Customer[], 
  profile: UserProfile | null, 
  showToast: (m: string, t?: 'success' | 'error') => void,
  invoices: Invoice[],
  settings: Settings | null,
  settlements?: DailySettlement[]
}) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<Record<string, { sold: number, returnDamaged: number, gifts: number }>>({});
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState(0);
  const [credit, setCredit] = useState(0);
  const [collectionValue, setCollectionValue] = useState(0);
  const [walletAmount, setWalletAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [productSort, setProductSort] = useState<{ field: 'name' | 'price' | 'sortOrder', direction: 'asc' | 'desc' }>({ field: 'sortOrder', direction: 'asc' });
  const invoiceRef = useRef<HTMLDivElement>(null);

  const isRep = profile?.role === 'representative' || profile?.role === 'backup_representative';
  const isManager = profile?.role === 'manager';
  const isDeveloper = profile?.role === 'developer';
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isTodaySettled = useMemo(() => {
    if (!settlements || !profile) return false;
    return settlements.some(s => s.date === todayStr && s.representativeId === profile.uid && s.isConfirmed);
  }, [settlements, profile, todayStr]);

  if (!products || !customers) return null;

  const sortedProducts = useMemo(() => {
    return [...products]
      .filter(p => !p.isFrozen) // Hide frozen products from invoice creation
      .sort((a, b) => {
        const field = productSort.field;
      const dir = productSort.direction;
      
      if (field === 'name') {
        return dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      
      const valA = a[field] || 0;
      const valB = b[field] || 0;
      return dir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [products, productSort]);

  const filteredCustomers = customers.filter(c => 
    c && (c.status === 'active' || !c.status) && (
      (c.shopName || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
      (c.ownerName || '').toLowerCase().includes((searchQuery || '').toLowerCase())
    )
  );

  const subtotal = useMemo(() => sortedProducts.reduce((acc, p) => {
    const item = items[p.id] || { sold: 0, returnDamaged: 0, gifts: 0 };
    const price = Number(p.price) || 0;
    return acc + (Number(item.sold) * price);
  }, 0), [sortedProducts, items]);

  const returnsTotal = useMemo(() => sortedProducts.reduce((acc, p) => {
    const item = items[p.id] || { sold: 0, returnDamaged: 0, gifts: 0 };
    return acc + (Number(item.returnDamaged) * (Number(p.price) || 0));
  }, 0), [sortedProducts, items]);

  const giftsTotal = useMemo(() => sortedProducts.reduce((acc, p) => {
    const item = items[p.id] || { sold: 0, returnDamaged: 0, gifts: 0 };
    return acc + (Number(item.gifts) * (Number(p.price) || 0));
  }, 0), [sortedProducts, items]);

  const discountAmount = useMemo(() => {
    const val = Number(discountValue) || 0;
    return discountType === 'fixed' ? val : (subtotal * val / 100);
  }, [discountType, discountValue, subtotal]);

  const totalAfterDiscount = subtotal - returnsTotal - discountAmount;
  const totalPaidToday = totalAfterDiscount - (Number(credit) || 0) + (Number(collectionValue) || 0);

  const isOldStyleProfile = profile?.uid && profile.uid.startsWith('user_');

  const handleSave = async () => {
    if (!selectedCustomer) {
      showToast('اختار العميل أولاً', 'error');
      return;
    }
    if (!profile) {
      showToast('لا يمكن الحفظ: ملف تعريف المستخدم غير مكتمل', 'error');
      return;
    }

    if (isRep && isTodaySettled) {
      showToast('لا يمكن إنشاء فاتورة جديدة لأن اليومية قد تم تقفيلها وتأكيدها بالفعل لهذا اليوم', 'error');
      return;
    }
    
    // Check if there are any items in the invoice
    const itemValues = Object.values(items) as { sold: number; returnDamaged: number; gifts: number }[];
    const hasItems = itemValues.some(i => i.sold > 0 || i.returnDamaged > 0 || i.gifts > 0);
    if (!hasItems && collectionValue <= 0) {
      showToast('لا يمكن حفظ فاتورة فارغة بدون مبيعات أو تحصيل', 'error');
      return;
    }

    setSaving(true);
    try {
      // Verify network connectivity and time sync before creating invoice
      const isConnected = await checkNetworkConnectivity();
      if (!isConnected && !isManager && !isDeveloper) {
        showToast('خطأ: تم منع حفظ الفاتورة لعدم وجود اتصال بالإنترنت!', 'error');
        setSaving(false);
        return;
      }

      const timeVerified = await getVerifiedServerTime();
      const syncResult = await checkDeviceTimeSync();
      if (!syncResult.isSync && !isManager && !isDeveloper) {
        showToast('خطأ: تم منع الحفظ لأن تاريخ وساعة الهاتف غير مضبوطين مع التوقيت الفعلي للشبكة والسيرفر!', 'error');
        setSaving(false);
        return;
      }

      const actualDate = timeVerified.date;
      const actualTime = timeVerified.time;

      const newBalance = (Number(selectedCustomer.openingBalance) || 0) + (Number(credit) || 0) - (Number(collectionValue) || 0);
      const invoiceData = {
        date: actualDate,
        time: actualTime,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.shopName || (selectedCustomer as any).name || 'بدون اسم',
        items: products.map(p => {
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
        }),
        subtotal: subtotal || 0,
        discountType,
        discountValue: Number(discountValue) || 0,
        credit: Number(credit) || 0,
        collection: Number(collectionValue) || 0,
        totalPaidToday: totalPaidToday || 0,
        walletAmount: Number(walletAmount) || 0,
        isWalletConfirmed: false,
        representativeId: profile.uid,
        representativeName: profile.name,
        routeId: selectedCustomer.routeId || (selectedCustomer as any).routeid || profile.routeId || (profile as any).routeid || '',
        routeName: selectedCustomer.routeName || (selectedCustomer as any).routename || profile.routeName || (profile as any).routename || '',
        timestamp: new Date().toISOString(),
        customerBalanceAfter: newBalance
      };
      
      console.log('Sending invoice to dataService...');
      await dataService.addInvoice(invoiceData);
      
      // Update customer balance (wrapped in separate try/catch to ensure invoice save is noted)
      try {
        await dataService.updateCustomer(selectedCustomer.id, {
          openingBalance: newBalance
        });
      } catch (balanceError) {
        console.error('Failed to update customer balance, but invoice was saved:', balanceError);
        showToast('تم حفظ الفاتورة، ولكن فشل تحديث رصيد العميل بشكل آلي. يرجى مراجعة الرصيد لاحقاً.', 'error');
      }
      
      // Create notification for manager
      try {
        await dataService.createNotification(
          'فاتورة جديدة',
          `قام المندوب ${profile.name} بإنشاء فاتورة للعميل ${selectedCustomer.shopName} بقيمة ${totalPaidToday.toFixed(2)}`,
          'invoice',
          profile.uid,
          profile.name,
          'history'
        );
      } catch(e) {}

      // Check if today is one of the preferred days for visit
      try {
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayWeekday = daysOfWeek[new Date().getDay()]; // 'Saturday', 'Sunday', etc.
        const rawPreferredDays = selectedCustomer.preferredDays || (selectedCustomer as any).preferreddays || [];
        let preferredDays: string[] = [];
        if (Array.isArray(rawPreferredDays)) {
          preferredDays = rawPreferredDays;
        } else if (typeof rawPreferredDays === 'string' && rawPreferredDays.trim()) {
          try {
            preferredDays = JSON.parse(rawPreferredDays);
          } catch (e) {
            preferredDays = [];
          }
        }

        if (preferredDays.length > 0 && !preferredDays.includes(todayWeekday)) {
          const arabicToday = WEEKDAYS.find(w => w.value === todayWeekday)?.label || todayWeekday;
          const arabicPreferred = preferredDays.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(' - ');
          await dataService.createNotification(
            'زيارة في يوم غير مفضل',
            `قام المندوب ${profile.name} بعمل فاتورة للعميل ${selectedCustomer.shopName} في يوم ${arabicToday} وهو ليس من الأيام المفضلة المحددة للزيارة (${arabicPreferred})`,
            'system',
            profile.uid,
            profile.name,
            'notifications'
          );
        }
      } catch (visitErr) {
        console.error('Failed checking preferred visit day match:', visitErr);
      }

      showToast('تم حفظ الفاتورة بنجاح ✓');
      
      // Check for target achievement
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayInvoices = invoices.filter(inv => inv.representativeId === profile.uid && inv.date === today);
      const todayTotal = todayInvoices.reduce((acc, inv) => acc + inv.totalPaidToday, 0) + totalPaidToday;
      
      // Get target from settings (assuming it's available or use a default)
      // For simplicity, we'll just send a notification if they reach a milestone
      if (todayTotal >= 1000 && (todayTotal - totalPaidToday) < 1000) {
        await dataService.createNotification(
          'إنجاز رائع!',
          'لقد وصلت إلى أول 1000 ج.م مبيعات اليوم. استمر في العمل الجيد!',
          'system',
          'system',
          'النظام',
          'profile',
          profile.uid
        );
      }
      // Reset
      setSelectedCustomer(null);
      setItems({});
      setDiscountValue(0);
      setCredit(0);
      setCollectionValue(0);
      setWalletAmount(0);
    } catch (err: any) {
      console.error(err);
      showToast(`فشل حفظ الفاتورة: ${err.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-ink">فاتورة جديدة</h2>
      </div>

      {isOldStyleProfile && (
        <div className="bg-red-50 border-2 border-red-200 text-red-600 p-6 rounded-3xl flex items-start gap-4 shadow-sm animate-pulse mx-2">
          <AlertCircle className="shrink-0 mt-1" size={24} />
          <div className="space-y-1">
            <p className="font-bold text-lg">تنبيه تقني: معرف مستخدم غير متوافق</p>
            <p className="text-sm">حسابك الحالي لديه معرف قديم ({profile?.uid}). يرجى التواصل مع المسؤول لحذف حسابك وإعادة إنشائه لضمان توافق البيانات مع تحديثات النظام الجديدة.</p>
          </div>
        </div>
      )}

      {isRep && isTodaySettled && (
        <div className="bg-orange-50 border-2 border-orange-200 text-orange-700 p-6 rounded-3xl flex items-start gap-4 shadow-sm mx-2">
          <AlertCircle className="shrink-0 mt-1 animate-pulse" size={24} />
          <div className="space-y-1">
            <p className="font-bold text-lg">تنبيه: اليومية مغلقة</p>
            <p className="text-sm text-orange-600 font-medium">لقد قمت بتقفيل وتأكيد اليومية بنجاح لهذا اليوم. لا يمكن إنشاء فواتير جديدة حتى اليوم التالي.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Customer Search & Info */}
        <div className="lg:col-span-1 space-y-6 px-2">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border-2 border-blue-100">
            <label className="block text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em] mb-4 px-1">اختر العميل</label>
            <div className="relative mb-6">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-300" size={18} />
              <input 
                type="text" 
                placeholder="ابحث عن المحل أو المالك..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pr-12 border-blue-100 focus:border-primary"
              />
            </div>
            
            <div className="max-h-60 overflow-y-auto space-y-2 pl-2 custom-scrollbar">
              {filteredCustomers.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCustomer(c)}
                  className={cn(
                    "w-full text-right p-4 rounded-2xl transition-all duration-300 flex items-center justify-between group active:scale-[0.98] border-2",
                    selectedCustomer?.id === c.id 
                      ? "bg-primary text-white shadow-lg shadow-primary/20 border-primary" 
                      : "bg-blue-50 hover:bg-blue-100 border-blue-100"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{c.shopName || (c as any).name}</p>
                    <p className={cn("text-[10px] truncate", selectedCustomer?.id === c.id ? "text-white/70" : "text-blue-400")}>{c.ownerName || (c as any).ownername}</p>
                  </div>
                  {selectedCustomer?.id === c.id && <Check size={18} />}
                </button>
              ))}
            </div>
          </div>

          {selectedCustomer && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-primary text-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-2xl shadow-primary/20 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
              <h3 className="text-xl font-serif font-bold mb-6 relative z-10">تفاصيل العميل</h3>
              <div className="mb-6 relative z-10">
                <p className="text-2xl font-black">{selectedCustomer.shopName || (selectedCustomer as any).name}</p>
                <p className="text-white/60 text-xs font-bold">{selectedCustomer.ownerName || (selectedCustomer as any).ownername}</p>
              </div>
              <div className="space-y-4 text-sm relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                    <MapPin size={16} className="text-white/60" />
                  </div>
                  <span className="font-medium">{selectedCustomer.area}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                    <Phone size={16} className="text-white/60" />
                  </div>
                  <span className="font-medium">{selectedCustomer.phone}</span>
                </div>
                <div className="pt-6 mt-6 border-t border-white/10 flex justify-between items-center">
                  <span className="text-white/60 font-medium">الرصيد الحالي</span>
                  <span className="text-xl font-serif font-black">{selectedCustomer.openingBalance.toLocaleString()} ج.م</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right: Product Table */}
        <div className="lg:col-span-2 space-y-6 px-2">
          <div ref={invoiceRef} className="bg-white p-4 md:p-10 rounded-[1.5rem] md:rounded-[2.5rem] shadow-md border-2 border-blue-100 overflow-x-auto" dir="rtl">
            <div className="flex justify-between items-start mb-6 md:mb-10">
              <div>
                <h3 className="text-3xl font-serif font-bold text-ink">فاتورة</h3>
                <p className="text-lg font-bold text-primary mt-1">{selectedCustomer?.shopName || (selectedCustomer as any)?.name}</p>
                <p className="text-[10px] text-secondary font-black tracking-[0.3em] uppercase mt-1">#{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
              </div>
              <div className="text-left text-sm space-y-2">
                <div className="flex flex-col items-end gap-1 mb-2">
                  <h2 className="text-2xl font-serif font-black text-primary">شركة OK</h2>
                </div>
                <div className="flex items-center gap-2 justify-end text-secondary font-bold">
                  <Calendar size={14} className="text-primary" />
                  <span>{format(new Date(), 'dd MMM yyyy')}</span>
                </div>
                <div className="flex items-center gap-2 justify-start text-secondary font-bold">
                  <Clock size={14} className="text-primary" />
                  <span>{format(new Date(), 'HH:mm')}</span>
                </div>
              </div>
            </div>

        {/* Mobile View for Products */}
        <div className="md:hidden space-y-4 mb-8">
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 px-1">
            <button 
              onClick={() => setProductSort({ field: 'name', direction: productSort.field === 'name' && productSort.direction === 'asc' ? 'desc' : 'asc' })}
              className={cn("px-4 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all", productSort.field === 'name' ? "bg-primary text-white" : "bg-blue-50 text-secondary")}
            >
              ترتيب بالاسم {productSort.field === 'name' && (productSort.direction === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => setProductSort({ field: 'price', direction: productSort.field === 'price' && productSort.direction === 'asc' ? 'desc' : 'asc' })}
              className={cn("px-4 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all", productSort.field === 'price' ? "bg-primary text-white" : "bg-blue-50 text-secondary")}
            >
              ترتيب بالسعر {productSort.field === 'price' && (productSort.direction === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => setProductSort({ field: 'sortOrder', direction: productSort.field === 'sortOrder' && productSort.direction === 'asc' ? 'desc' : 'asc' })}
              className={cn("px-4 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all", productSort.field === 'sortOrder' ? "bg-primary text-white" : "bg-blue-50 text-secondary")}
            >
              الترتيب الافتراضي {productSort.field === 'sortOrder' && (productSort.direction === 'asc' ? '↑' : '↓')}
            </button>
          </div>
          {sortedProducts.map(p => {
            const item = items[p.id] || { sold: 0, returnDamaged: 0, gifts: 0 };
            return (
              <div key={p.id} className="bg-white p-5 rounded-3xl border-2 border-blue-100 shadow-sm space-y-4 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-900">{p.name}</span>
                  <span className="text-xs font-black text-primary">{p.price} ج.م</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-blue-500 uppercase block text-center">عدد العلب</label>
                    <input 
                      type="number" 
                      min="0"
                      value={item.sold || ''}
                      onChange={(e) => setItems({ ...items, [p.id]: { ...item, sold: parseInt(e.target.value) || 0 } })}
                      className="w-full text-center py-2 bg-blue-50 rounded-xl focus:outline-none border-2 border-blue-100 text-sm font-bold focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-red-600 uppercase block text-center">تالف</label>
                    <input 
                      type="number" 
                      min="0"
                      value={item.returnDamaged || ''}
                      onChange={(e) => setItems({ ...items, [p.id]: { ...item, returnDamaged: parseInt(e.target.value) || 0 } })}
                      className="w-full text-center py-2 bg-red-50 rounded-xl focus:outline-none border-2 border-red-100 text-sm font-bold text-red-600 focus:border-red-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-green-600 uppercase block text-center">هدايا</label>
                    <input 
                      type="number" 
                      min="0"
                      value={item.gifts || ''}
                      onChange={(e) => setItems({ ...items, [p.id]: { ...item, gifts: parseInt(e.target.value) || 0 } })}
                      className="w-full text-center py-2 bg-green-50 rounded-xl focus:outline-none border-2 border-green-100 text-sm font-bold text-green-600 focus:border-green-500"
                    />
                  </div>
                </div>
                <div className="pt-2 border-t border-blue-100 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-blue-400 uppercase">الإجمالي</span>
                  <span className="font-black text-sm text-primary">{((item.sold - item.returnDamaged) * p.price).toLocaleString()} ج.م</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View for Products */}
        <table className="hidden md:table w-full text-right border-collapse mb-8">
          <thead>
            <tr className="border-b-2 border-blue-200">
              <th 
                className="py-6 font-bold text-blue-500 uppercase text-[10px] tracking-[0.2em] cursor-pointer hover:text-primary transition-colors"
                onClick={() => setProductSort({ field: 'name', direction: productSort.field === 'name' && productSort.direction === 'asc' ? 'desc' : 'asc' })}
              >
                <div className="flex items-center gap-2">
                  المنتج
                  {productSort.field === 'name' && (productSort.direction === 'asc' ? <ChevronLeft className="rotate-90" size={12} /> : <ChevronLeft className="-rotate-90" size={12} />)}
                </div>
              </th>
              <th 
                className="py-6 font-bold text-blue-500 uppercase text-[10px] tracking-[0.2em] text-center cursor-pointer hover:text-primary transition-colors"
                onClick={() => setProductSort({ field: 'price', direction: productSort.field === 'price' && productSort.direction === 'asc' ? 'desc' : 'asc' })}
              >
                <div className="flex items-center justify-center gap-2">
                  السعر
                  {productSort.field === 'price' && (productSort.direction === 'asc' ? <ChevronLeft className="rotate-90" size={12} /> : <ChevronLeft className="-rotate-90" size={12} />)}
                </div>
              </th>
              <th className="py-6 font-bold text-blue-500 uppercase text-[10px] tracking-[0.2em] text-center">عدد العلب</th>
              <th className="py-6 font-bold text-blue-500 uppercase text-[10px] tracking-[0.2em] text-center">تالف/مرتجع</th>
              <th className="py-6 font-bold text-blue-500 uppercase text-[10px] tracking-[0.2em] text-center">هدايا</th>
              <th className="py-6 font-bold text-blue-500 uppercase text-[10px] tracking-[0.2em] text-left">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map(p => {
              const item = items[p.id] || { sold: 0, returnDamaged: 0, gifts: 0 };
              return (
                <tr key={p.id} className="border-b border-blue-100 group hover:bg-blue-50 transition-colors">
                  <td className="py-5">
                    <p className="font-bold text-sm text-blue-900">{p.name}</p>
                  </td>
                  <td className="py-5 text-center text-sm font-bold text-blue-600">{p.price}</td>
                      <td className="py-5 text-center">
                        <input 
                          type="number" 
                          min="0"
                          value={item.sold || ''}
                          onChange={(e) => setItems({ ...items, [p.id]: { ...item, sold: parseInt(e.target.value) || 0 } })}
                          className="w-16 text-center py-2 bg-blue-50 rounded-xl focus:outline-none border-2 border-blue-100 text-sm font-bold focus:border-primary"
                        />
                      </td>
                      <td className="py-5 text-center">
                        <input 
                          type="number" 
                          min="0"
                          value={item.returnDamaged || ''}
                          onChange={(e) => setItems({ ...items, [p.id]: { ...item, returnDamaged: parseInt(e.target.value) || 0 } })}
                          className="w-16 text-center py-2 bg-red-50 text-red-600 rounded-xl focus:outline-none border-2 border-red-100 text-sm font-bold focus:border-red-400"
                        />
                      </td>
                      <td className="py-5 text-center">
                        <input 
                          type="number" 
                          min="0"
                          value={item.gifts || ''}
                          onChange={(e) => setItems({ ...items, [p.id]: { ...item, gifts: parseInt(e.target.value) || 0 } })}
                          className="w-16 text-center py-2 bg-green-50 text-green-600 rounded-xl focus:outline-none border-2 border-green-100 text-sm font-bold focus:border-green-500"
                        />
                      </td>
                      <td className="py-5 text-left font-black text-sm text-blue-900">
                        {((item.sold - item.returnDamaged) * p.price).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-blue-200 bg-blue-50/30">
                  <td className="py-4 font-black text-sm text-blue-900">الإجمالي</td>
                  <td className="py-4 text-center text-sm font-black text-blue-600">-</td>
                  <td className="py-4 text-center text-sm font-black text-blue-900">
                    {products.reduce((acc, p) => acc + (items[p.id]?.sold || 0), 0)}
                  </td>
                  <td className="py-4 text-center text-sm font-black text-red-600">
                    {products.reduce((acc, p) => acc + (items[p.id]?.returnDamaged || 0), 0)}
                  </td>
                  <td className="py-4 text-center text-sm font-black text-green-600">
                    {products.reduce((acc, p) => acc + (items[p.id]?.gifts || 0), 0)}
                  </td>
                  <td className="py-4 text-left font-black text-sm text-blue-900">
                    {subtotal.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="bg-blue-50 p-6 md:p-8 rounded-[2rem] border-2 border-blue-100 shadow-inner">
              <div className="flex justify-between items-center">
                <span className="font-bold text-blue-500 uppercase text-[10px] tracking-[0.2em]">الإجمالي الفرعي</span>
                <span className="text-2xl font-serif font-black text-primary">{subtotal.toLocaleString()} ج.م</span>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em] mb-3 px-1">الخصم</label>
                  <div className="flex gap-3">
                    <select 
                      value={discountType || 'fixed'} 
                      onChange={(e) => setDiscountType(e.target.value as any)}
                      className="bg-blue-50 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none border-2 border-blue-100 text-primary focus:border-primary"
                    >
                      <option value="fixed">ج.م</option>
                      <option value="percentage">%</option>
                    </select>
                    <input 
                      type="number" 
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                      className="flex-1 bg-blue-50 border-2 border-blue-100 rounded-2xl px-6 py-4 focus:outline-none focus:ring-4 focus:ring-blue-100 font-bold text-primary focus:border-primary"
                      placeholder="القيمة"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em] mb-3 px-1">آجل (مديونية)</label>
                  <input 
                    type="number" 
                    value={credit || ''}
                    onChange={(e) => setCredit(parseFloat(e.target.value) || 0)}
                    className="w-full bg-blue-50 border-2 border-blue-100 rounded-2xl px-6 py-4 focus:outline-none focus:ring-4 focus:ring-blue-100 font-bold text-primary focus:border-primary"
                    placeholder="المبلغ"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em] mb-3 px-1">تحصيل (سداد قديم)</label>
                  <input 
                    type="number" 
                    value={collectionValue || ''}
                    onChange={(e) => setCollectionValue(parseFloat(e.target.value) || 0)}
                    className="w-full bg-blue-50 border-2 border-blue-100 rounded-2xl px-6 py-4 focus:outline-none focus:ring-4 focus:ring-blue-100 font-bold text-primary focus:border-primary"
                    placeholder="المبلغ"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-purple-500 uppercase tracking-[0.2em] mb-3 px-1">تحويل محفظة (فودافون كاش)</label>
                  <input 
                    type="number" 
                    value={walletAmount || ''}
                    onChange={(e) => setWalletAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-purple-50 border-2 border-purple-100 rounded-2xl px-6 py-4 focus:outline-none focus:ring-4 focus:ring-purple-100 font-bold text-purple-600 focus:border-purple-400"
                    placeholder="المبلغ المحول"
                  />
                </div>
              </div>

              <div className="bg-blue-50 p-8 rounded-[2.5rem] flex flex-col justify-center space-y-5 border-2 border-blue-100 shadow-inner">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-500 font-medium">قيمة المرتجع</span>
                  <span className="font-black text-red-600">-{returnsTotal.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-500 font-medium">قيمة الهدايا</span>
                  <span className="font-black text-green-600">{giftsTotal.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-500 font-medium">قيمة الخصم</span>
                  <span className="font-black text-red-600">-{discountAmount.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-500 font-medium">آجل (مديونية)</span>
                  <span className="font-black text-red-600">-{credit.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-500 font-medium">تحصيل</span>
                  <span className="font-black text-green-600">+{collectionValue.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-purple-500 font-medium">تحويل محفظة</span>
                  <span className="font-black text-purple-600">{walletAmount.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-purple-100 pt-2 mt-2">
                  <span className="text-blue-500 font-medium">المبلغ النقدي (كاش)</span>
                  <span className="font-black text-blue-600">{(totalPaidToday - walletAmount).toLocaleString()} ج.م</span>
                </div>
                <div className="pt-6 mt-6 border-t-2 border-blue-200 flex justify-between items-center">
                  <span className="text-lg font-serif font-bold text-primary">إجمالي المدفوع</span>
                  <span className="text-3xl font-serif font-black text-primary">{totalPaidToday.toLocaleString()} ج.م</span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={saving || isOldStyleProfile || (isRep && isTodaySettled)}
              className="w-full mt-10 py-5 bg-primary text-white rounded-[1.5rem] font-bold hover:bg-secondary transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-2xl shadow-primary/20 active:scale-[0.98]"
            >
              {saving ? <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-white"></div> : <Save size={22} />}
              <span className="text-lg">حفظ الفاتورة الآن</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductsTab({ products, setProducts, profile, showToast }: { 
  products: Product[], 
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>,
  profile: UserProfile | null, 
  showToast: (m: string, t?: 'success' | 'error') => void 
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ name: string, price: number, flavors: string[] }>({ name: '', price: 0, flavors: [] });
  const [newFlavor, setNewFlavor] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isManager = profile?.role === 'manager' || profile?.role === 'developer';
  const isSupervisor = profile?.role === 'supervisor';
  const canEdit = isManager || isSupervisor;

  const handleSave = async () => {
    if (!canEdit) return;
    if (!formData.name || formData.price <= 0) {
      showToast('يرجى إدخال اسم المنتج وسعر صحيح', 'error');
      return;
    }
    setSaving(true);
    const oldProducts = [...products];
    try {
      if (editingId) {
        // Optimistic Update for Edit
        const updatedProducts = products.map(p => 
          p.id === editingId ? { ...p, ...formData } : p
        );
        setProducts(updatedProducts);

        await dataService.updateProduct(editingId, formData);
        showToast('تم تحديث المنتج بنجاح');
      } else {
        const maxOrder = products.length > 0 ? Math.max(...products.map(p => p.sortOrder || 0)) : -1;
        const newProductData = {
          ...formData,
          sortOrder: maxOrder + 1,
          isFrozen: false
        };
        
        // Optimistic Update for Add (with temporary ID)
        const tempId = 'temp-' + Date.now();
        setProducts([...products, { id: tempId, ...newProductData } as Product]);

        await dataService.addProduct(newProductData);
        showToast('تم إضافة المنتج بنجاح');
      }
      setFormData({ name: '', price: 0, flavors: [] });
      setIsAdding(false);
      setEditingId(null);
      setNewFlavor('');
    } catch (err: any) {
      console.error('Error saving product:', err);
      // Revert optimistic update
      setProducts(oldProducts);
      showToast('حدث خطأ أثناء حفظ المنتج: ' + (err.message || 'خطأ غير معروف'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    const oldProducts = [...products];
    try {
      // Optimistic Update
      setProducts(products.filter(p => p.id !== productToDelete));
      
      await dataService.deleteProduct(productToDelete);
      showToast('تم حذف المنتج بنجاح');
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (err: any) {
      console.error(err);
      // Revert optimistic update
      setProducts(oldProducts);
      showToast(err.message || 'حدث خطأ أثناء حذف المنتج', 'error');
    }
  };

  const toggleFreeze = async (id: string, currentStatus: boolean) => {
    const oldProducts = [...products];
    try {
      // Optimistic Update
      setProducts(products.map(p => p.id === id ? { ...p, isFrozen: !currentStatus } : p));
      
      await dataService.updateProduct(id, { isFrozen: !currentStatus });
      showToast(currentStatus ? 'تم إلغاء تجميد المنتج' : 'تم تجميد المنتج بنجاح');
    } catch (err: any) {
      console.error(err);
      setProducts(oldProducts);
      showToast('حدث خطأ أثناء تغيير حالة المنتج', 'error');
    }
  };

  const moveProduct = async (id: string, direction: 'up' | 'down') => {
    const sortedProducts = [...products].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const idx = sortedProducts.findIndex(p => p.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sortedProducts.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const currentProduct = sortedProducts[idx];
    const targetProduct = sortedProducts[targetIdx];

    const currentOrder = currentProduct.sortOrder || 0;
    const targetOrder = targetProduct.sortOrder || 0;

    // Optimistic Update
    const optimisticProducts = [...products];
    const cIdx = optimisticProducts.findIndex(p => p.id === currentProduct.id);
    const tIdx = optimisticProducts.findIndex(p => p.id === targetProduct.id);
    if (cIdx !== -1 && tIdx !== -1) {
      optimisticProducts[cIdx] = { ...currentProduct, sortOrder: targetOrder };
      optimisticProducts[tIdx] = { ...targetProduct, sortOrder: currentOrder };
      setProducts(optimisticProducts);
    }

    try {
      setSaving(true);
      
      // If they have the same order, we need to force them to be different first
      if (currentOrder === targetOrder) {
        console.log('Orders are identical, fixing sequence...');
        // Assign sequential orders based on current list position to all products
        for (let i = 0; i < sortedProducts.length; i++) {
          await dataService.updateProduct(sortedProducts[i].id, { sortOrder: i + 1 });
        }
        showToast('تمت إعادة تهيئة الترتيب، يرجى المحاولة مرة أخرى');
        return;
      }

      console.log(`Swapping ${currentProduct.name} (${currentOrder}) with ${targetProduct.name} (${targetOrder})`);

      // Standard swap - sequential for maximum reliability
      await dataService.updateProduct(currentProduct.id, { sortOrder: targetOrder });
      await dataService.updateProduct(targetProduct.id, { sortOrder: currentOrder });
      
      showToast('تم تغيير الترتيب بنجاح');
    } catch (err) {
      console.error('Move product error:', err);
      // Revert optimistic update
      setProducts(products);
      showToast('حدث خطأ أثناء تغيير الترتيب', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-ink">المنتجات</h2>
        {canEdit && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-primary text-white rounded-2xl font-bold hover:bg-secondary transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            <Plus size={20} />
            <span className="text-sm md:text-base">إضافة منتج</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 px-2">
        <AnimatePresence>
          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-xl border border-primary/10 flex flex-col gap-4"
            >
              <h3 className="text-xl font-serif font-bold text-ink">منتج جديد</h3>
              <div>
                <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">اسم المنتج</label>
                <input 
                  type="text" 
                  placeholder="مثال: حليب كامل الدسم" 
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">السعر (ج.م)</label>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  value={formData.price || ''}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">الأطعم / النكهات</label>
                <div className="flex gap-2 mb-2">
                  <input 
                    type="text" 
                    placeholder="إضافة طعم..." 
                    value={newFlavor}
                    onChange={(e) => setNewFlavor(e.target.value)}
                    className="input-field flex-1"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newFlavor.trim()) {
                          setFormData({ ...formData, flavors: [...formData.flavors, newFlavor.trim()] });
                          setNewFlavor('');
                        }
                      }
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (newFlavor.trim()) {
                        setFormData({ ...formData, flavors: [...formData.flavors, newFlavor.trim()] });
                        setNewFlavor('');
                      }
                    }}
                    className="p-3 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.flavors.map((f, idx) => (
                    <span key={idx} className="bg-bg px-3 py-1.5 rounded-lg text-xs font-bold text-secondary flex items-center gap-2">
                      {f}
                      <button onClick={() => setFormData({ ...formData, flavors: formData.flavors.filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-600">
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 mt-2">
                <button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {saving ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div> : null}
                  <span>حفظ</span>
                </button>
                <button 
                  onClick={() => setIsAdding(false)} 
                  disabled={saving}
                  className="flex-1 py-3 bg-bg text-secondary rounded-xl font-bold active:scale-95 disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {[...products].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((p, i) => (
          <motion.div 
            layout
            key={p.id}
            className={`p-6 rounded-[2rem] shadow-sm border flex flex-col justify-between group hover:shadow-md transition-all ${
              p.isFrozen ? 'bg-gray-50 border-gray-200 grayscale-[0.5]' : 'bg-white border-accent/10'
            }`}
          >
            {editingId === p.id ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-secondary/60 uppercase tracking-widest mb-1.5 px-1">تعديل الاسم</label>
                  <input 
                    type="text" 
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary/60 uppercase tracking-widest mb-1.5 px-1">تعديل السعر</label>
                  <input 
                    type="number" 
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary/60 uppercase tracking-widest mb-1.5 px-1">الأطعم / النكهات</label>
                  <div className="flex gap-2 mb-2">
                    <input 
                      type="text" 
                      placeholder="إضافة طعم..." 
                      value={newFlavor}
                      onChange={(e) => setNewFlavor(e.target.value)}
                      className="input-field flex-1"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newFlavor.trim()) {
                            setFormData({ ...formData, flavors: [...formData.flavors, newFlavor.trim()] });
                            setNewFlavor('');
                          }
                        }
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        if (newFlavor.trim()) {
                          setFormData({ ...formData, flavors: [...formData.flavors, newFlavor.trim()] });
                          setNewFlavor('');
                        }
                      }}
                      className="p-3 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.flavors.map((f, idx) => (
                      <span key={idx} className="bg-bg px-3 py-1.5 rounded-lg text-xs font-bold text-secondary flex items-center gap-2">
                        {f}
                        <button onClick={() => setFormData({ ...formData, flavors: formData.flavors.filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-600">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="flex-1 btn-primary py-2 text-sm flex items-center justify-center gap-2"
                  >
                    {saving ? <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-white"></div> : null}
                    <span>تحديث</span>
                  </button>
                  <button 
                    onClick={() => setEditingId(null)} 
                    disabled={saving}
                    className="flex-1 py-2 bg-bg text-secondary rounded-xl text-sm font-bold active:scale-95 disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-serif font-bold text-ink">{p.name}</h3>
                      {p.isFrozen && (
                        <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <Snowflake size={10} />
                          مجمد
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-primary mt-1">{p.price} <span className="text-xs font-normal opacity-60">ج.م</span></p>
                    {p.flavors && p.flavors.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.flavors.map((f, idx) => (
                          <span key={idx} className="bg-primary/5 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex flex-col gap-1">
                      <button onClick={() => moveProduct(p.id, 'up')} className="p-1.5 hover:bg-bg rounded-lg text-secondary/40 hover:text-primary transition-colors"><ChevronLeft className="rotate-90" size={16} /></button>
                      <button onClick={() => moveProduct(p.id, 'down')} className="p-1.5 hover:bg-bg rounded-lg text-secondary/40 hover:text-primary transition-colors"><ChevronLeft className="-rotate-90" size={16} /></button>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-bg">
                  <span className="text-[10px] font-bold text-secondary/40 uppercase tracking-widest">الترتيب: {i + 1} <span className="text-blue-300 ml-1">(#{p.sortOrder})</span></span>
                  {canEdit && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => toggleFreeze(p.id, !!p.isFrozen)}
                        className={`p-2.5 rounded-xl transition-all ${
                          p.isFrozen ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={p.isFrozen ? "إلغاء التجميد" : "تجميد المنتج"}
                      >
                        <Snowflake size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingId(p.id);
                          setFormData({ name: p.name, price: p.price, flavors: p.flavors || [] });
                          setNewFlavor('');
                        }}
                        className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          setProductToDelete(p.id);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        ))}
      </div>

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        title="حذف المنتج"
        message="هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء."
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
        confirmText="حذف المنتج"
        isDestructive={true}
      />
    </div>
  );
}

export { WEEKDAYS };

function LoadingRequestsAdmin({ showToast, profile, customers = [] }: { showToast: (m: string, t?: 'success' | 'error') => void, profile?: UserProfile | null, customers?: Customer[] }) {
  const [requests, setRequests] = useState<LoadingRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')); // Tomorrow by default
  const [loading, setLoading] = useState(true);
  const [editingFlavors, setEditingFlavors] = useState<string | null>(null);
  const [newFlavor, setNewFlavor] = useState('');
  const [expandedCustomerListId, setExpandedCustomerListId] = useState<string | null>(null);

  // Manager Direct Edit state
  const [managerEditingRequest, setManagerEditingRequest] = useState<LoadingRequest | null>(null);
  const [managerEditingItems, setManagerEditingItems] = useState<LoadingRequestItem[]>([]);
  const [managerAddProductId, setManagerAddProductId] = useState<string>('');
  const [managerAddFlavor, setManagerAddFlavor] = useState<string>('');
  const [managerAddQuantity, setManagerAddQuantity] = useState<number>(1);
  const [savingManagerEdit, setSavingManagerEdit] = useState(false);

  // Delete Confirmation Modal state
  const [requestToDelete, setRequestToDelete] = useState<LoadingRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const isStorekeeper = profile?.role === 'storekeeper';
  const [viewMode, setViewMode] = useState<'requests' | 'summary' | 'storekeeper'>(isStorekeeper ? 'storekeeper' : 'requests');
  const [summaryViewMode, setSummaryViewMode] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    setLoading(true);
    const unsub = dataService.subscribeToLoadingRequestsByDate(selectedDate, (data) => {
      setRequests(data as LoadingRequest[]);
      setLoading(false);
    }, (err) => {
      console.error('LoadingRequestsAdmin database error:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [selectedDate]);

  useEffect(() => {
    const unsub = dataService.getProducts((data) => {
      setProducts(data as Product[]);
    });
    return () => unsub();
  }, []);

  const selectedWeekday = useMemo(() => {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return daysOfWeek[dateObj.getDay()];
    }
    return '';
  }, [selectedDate]);

  const arabicWeekday = useMemo(() => {
    return WEEKDAYS.find(w => w.value === selectedWeekday)?.label || selectedWeekday;
  }, [selectedWeekday]);

  const totalPieces = useMemo(() => {
    return requests.reduce((sum, r) => sum + (r.items || []).reduce((s, i) => s + (i.quantity || 0), 0), 0);
  }, [requests]);

  const approvedPieces = useMemo(() => {
    return requests.filter(r => r.status === 'approved').reduce((sum, r) => sum + (r.items || []).reduce((s, i) => s + (i.quantity || 0), 0), 0);
  }, [requests]);

  const totalVisits = useMemo(() => {
    return requests.reduce((sum, r) => sum + (r.selectedCustomers?.length || 0), 0);
  }, [requests]);

  const totalWarnings = useMemo(() => {
    return requests.filter(r => r.nonPreferredWarning || (r.selectedCustomers && r.selectedCustomers.some(c => !c.isPreferredDay))).length;
  }, [requests]);

  const handleUpdateStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      await dataService.updateLoadingRequest(requestId, { 
        status,
        canEdit: false,
        editRequested: false
      });
      const request = requests.find(r => r.id === requestId);
      if (request) {
        await dataService.createNotification(
          status === 'approved' ? 'تمت الموافقة على تشغيلتك' : 'تم رفض تشغيلتك',
          `تم ${status === 'approved' ? 'الموافقة على' : 'رفض'} طلب التشغيلة الخاص بك لتاريخ ${selectedDate}`,
          'system',
          'admin',
          'المدير',
          'loading_request',
          request.representativeId
        );
      }
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status, canEdit: false, editRequested: false } : r));
      showToast(status === 'approved' ? 'تمت الموافقة على الطلب' : 'تم رفض الطلب');
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تحديث حالة الطلب', 'error');
    }
  };

  const handleToggleRepEdit = async (requestId: string, allow: boolean) => {
    try {
      await dataService.updateLoadingRequest(requestId, { 
        canEdit: allow,
        editRequested: false
      });
      const request = requests.find(r => r.id === requestId);
      if (request) {
        await dataService.createNotification(
          allow ? 'تم فتح إمكانية التعديل' : 'تم قفل التعديل',
          allow 
            ? `قام المدير بالسماح لك بتعديل تشغيلة تاريخ ${selectedDate}. يمكنك الآن تعديل الكميات وحفظ الطلب.`
            : `قام المدير بإغلاق إمكانية تعديل تشغيلة تاريخ ${selectedDate}.`,
          'system',
          'admin',
          'المدير',
          'loading_request',
          request.representativeId
        );
      }
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, canEdit: allow, editRequested: false } : r));
      showToast(allow ? 'تم فتح إمكانية التعديل للمندوب' : 'تم قفل التعديل للمندوب');
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تحديث صلاحية التعديل', 'error');
    }
  };

  const handleOpenManagerEdit = (req: LoadingRequest) => {
    setManagerEditingRequest(req);
    const clonedItems: LoadingRequestItem[] = (req.items || []).map(i => ({ ...i }));
    setManagerEditingItems(clonedItems);
    if (products.length > 0) {
      setManagerAddProductId(products[0].id);
      const flvs = products[0].flavors && products[0].flavors.length > 0 ? products[0].flavors : ['بدون طعم'];
      setManagerAddFlavor(flvs[0]);
    }
    setManagerAddQuantity(1);
  };

  const handleManagerAddItem = () => {
    if (!managerAddProductId) return;
    const prod = products.find(p => p.id === managerAddProductId);
    if (!prod) return;
    const flavor = managerAddFlavor || (prod.flavors && prod.flavors[0]) || 'بدون طعم';
    const qty = Math.max(1, Number(managerAddQuantity) || 1);

    setManagerEditingItems(prev => {
      const idx = prev.findIndex(i => i.productId === prod.id && i.flavor === flavor);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: (next[idx].quantity || 0) + qty };
        return next;
      } else {
        return [...prev, {
          productId: prod.id,
          productName: prod.name,
          flavor,
          quantity: qty
        }];
      }
    });
    setManagerAddQuantity(1);
    showToast(`تمت إضافة ${prod.name} (${flavor})`);
  };

  const handleManagerUpdateQty = (index: number, newQty: number) => {
    setManagerEditingItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: Math.max(0, newQty) };
      return next;
    });
  };

  const handleManagerRemoveItem = (index: number) => {
    setManagerEditingItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveManagerEdit = async () => {
    if (!managerEditingRequest?.id) return;
    setSavingManagerEdit(true);
    try {
      const cleanItems = managerEditingItems.filter(i => (i.quantity || 0) > 0);
      await dataService.updateLoadingRequest(managerEditingRequest.id, {
        items: cleanItems
      });

      setRequests(prev => prev.map(r => r.id === managerEditingRequest.id ? { ...r, items: cleanItems } : r));

      await dataService.createNotification(
        'تم تعديل تشغيلتك من قبل المدير',
        `قام المدير بتعديل أصناف وكميات طلب تشغيلة تاريخ ${managerEditingRequest.date}`,
        'system',
        'admin',
        'المدير',
        'loading_request',
        managerEditingRequest.representativeId
      );

      showToast('تم حفظ تعديلات المدير على الطلب بنجاح', 'success');
      setManagerEditingRequest(null);
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء حفظ التعديلات', 'error');
    } finally {
      setSavingManagerEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!requestToDelete?.id) return;
    setIsDeleting(true);
    try {
      await dataService.deleteLoadingRequest(requestToDelete.id);
      setRequests(prev => prev.filter(r => r.id !== requestToDelete.id));
      showToast('تم حذف طلب التشغيلة نهائياً بنجاح', 'success');
      setRequestToDelete(null);
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء حذف الطلب', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const summary = useMemo(() => {
    const totals: { [key: string]: { productName: string, flavor: string, total: number } } = {};
    requests.filter(r => r.status === 'approved').forEach(req => {
      (req.items || []).forEach(item => {
        const key = `${item.productId}_${item.flavor}`;
        if (!totals[key]) {
          totals[key] = { productName: item.productName, flavor: item.flavor, total: 0 };
        }
        totals[key].total += item.quantity;
      });
    });
    return Object.values(totals).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [requests]);

  const groupedSummary = useMemo(() => {
    const groups: { [productName: string]: { flavor: string, total: number }[] } = {};
    summary.forEach(item => {
      if (!groups[item.productName]) groups[item.productName] = [];
      groups[item.productName].push({ flavor: item.flavor, total: item.total });
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [summary]);

  const allFlavors = useMemo(() => {
    const flavors = new Set<string>();
    products.forEach(p => {
      if (p.flavors && p.flavors.length > 0) {
        p.flavors.forEach(f => flavors.add(f));
      } else {
        flavors.add('بدون طعم');
      }
    });
    return Array.from(flavors).sort();
  }, [products]);

  const handleAddFlavor = async (productId: string) => {
    if (!newFlavor.trim()) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;
      const updatedFlavors = [...(product.flavors || []), newFlavor.trim()];
      try {
        await dataService.updateProduct(productId, { flavors: updatedFlavors });
        setNewFlavor('');
      showToast('تم إضافة الطعم بنجاح');
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء إضافة الطعم', 'error');
    }
  };

  const handleRemoveFlavor = async (productId: string, flavorToRemove: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const updatedFlavors = (product.flavors || []).filter(f => f !== flavorToRemove);
    try {
      await dataService.updateProduct(productId, { flavors: updatedFlavors });
      showToast('تم إزالة الطعم بنجاح');
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء إزالة الطعم', 'error');
    }
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const tomorrowStr = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      {/* Header & Date Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] border border-accent/10 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-ink">إدارة طلبات التشغيل</h2>
            <span className="bg-primary/10 text-primary font-bold text-xs px-3 py-1 rounded-full">
              يوم {arabicWeekday}
            </span>
          </div>
          <p className="text-secondary/60 text-xs font-medium">متابعة طلبات المناديب المجمعة وتفاصيل العملاء المستهدفين والأطعم المطلوبة</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Quick Date Shortcuts */}
          <div className="flex gap-1.5 bg-bg p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setSelectedDate(tomorrowStr)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                selectedDate === tomorrowStr ? "bg-white text-primary shadow-sm" : "text-secondary/60 hover:text-ink"
              )}
            >
              تشغيلة الغد
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                selectedDate === todayStr ? "bg-white text-primary shadow-sm" : "text-secondary/60 hover:text-ink"
              )}
            >
              تشغيلة اليوم
            </button>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-bg px-3 py-1.5 rounded-xl border border-accent/10">
            <Calendar size={16} className="text-primary" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-xs font-bold text-ink p-0"
            />
          </div>

          {/* View Mode Switcher */}
          <div className="flex bg-bg p-1 rounded-xl border border-accent/10">
            <button 
              onClick={() => setViewMode('requests')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                viewMode === 'requests' ? "bg-primary text-white shadow-sm" : "text-secondary/60 hover:text-primary"
              )}
            >
              الطلبات ({requests.length})
            </button>
            <button 
              onClick={() => setViewMode('summary')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                viewMode === 'summary' ? "bg-primary text-white shadow-sm" : "text-secondary/60 hover:text-primary"
              )}
            >
              المجمع
            </button>
            <button 
              onClick={() => setViewMode('storekeeper')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                viewMode === 'storekeeper' ? "bg-primary text-white shadow-sm" : "text-secondary/60 hover:text-primary"
              )}
            >
              المخزن
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-accent/10 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Package size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-secondary/60 uppercase">إجمالي القطع المطلوبة</p>
            <p className="text-xl font-black text-ink">{totalPieces.toLocaleString()} <span className="text-xs font-bold text-secondary/40">قطعة</span></p>
            <p className="text-[10px] text-green-600 font-bold">{approvedPieces.toLocaleString()} معتمد</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-accent/10 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <ClipboardList size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-secondary/60 uppercase">طلبات المناديب</p>
            <p className="text-xl font-black text-ink">{requests.length} <span className="text-xs font-bold text-secondary/40">طلب</span></p>
            <p className="text-[10px] text-secondary/60 font-bold">
              {requests.filter(r => r.status === 'approved').length} معتمد • {requests.filter(r => r.status === 'pending').length} انتظار
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-accent/10 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-secondary/60 uppercase">إجمالي العملاء المحددين</p>
            <p className="text-xl font-black text-ink">{totalVisits} <span className="text-xs font-bold text-secondary/40">زيارة مستهدفة</span></p>
            <p className="text-[10px] text-emerald-600 font-bold">ليوم {arabicWeekday}</p>
          </div>
        </div>

        <div className={cn(
          "p-4 rounded-2xl border shadow-sm flex items-center gap-3 transition-colors",
          totalWarnings > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-accent/10"
        )}>
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            totalWarnings > 0 ? "bg-amber-100 text-amber-700" : "bg-green-50 text-green-600"
          )}>
            {totalWarnings > 0 ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
          </div>
          <div>
            <p className="text-[10px] font-bold text-secondary/60 uppercase">تنبيهات الزيارات</p>
            <p className={cn("text-xl font-black", totalWarnings > 0 ? "text-amber-700" : "text-green-700")}>
              {totalWarnings > 0 ? `${totalWarnings} تنبيه غير مفضل` : 'كل الزيارات منتظمة'}
            </p>
            <p className="text-[10px] font-bold text-secondary/60">
              {totalWarnings > 0 ? 'يوجد عملاء في غير يومهم المفضل' : 'مطابقة للأيام المفضلة ✓'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {viewMode === 'requests' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                    <ClipboardList size={18} />
                  </div>
                  <h3 className="text-xl font-serif font-bold text-ink">طلبات المناديب لتشغيلة {arabicWeekday}</h3>
                </div>
                <span className="text-xs font-bold text-secondary/50">({requests.length} طلب)</span>
              </div>

              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
                </div>
              ) : requests.length === 0 ? (
                <div className="bg-white p-12 rounded-[2rem] border border-dashed border-accent/20 text-center space-y-4">
                  <div className="w-16 h-16 bg-bg rounded-full flex items-center justify-center mx-auto text-secondary/20">
                    <ClipboardList size={32} />
                  </div>
                  <p className="text-secondary/40 font-bold">لا توجد طلبات تشغيل مسجلة لتاريخ {selectedDate} ({arabicWeekday})</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {requests.map(request => {
                    const reqPieces = (request.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
                    const nonPreferredCustomers = request.selectedCustomers?.filter(c => !c.isPreferredDay) || [];
                    const hasNonPreferred = request.nonPreferredWarning || nonPreferredCustomers.length > 0;
                    const isExpanded = expandedCustomerListId === request.id;

                    return (
                      <motion.div 
                        key={request.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "bg-white p-6 rounded-[2rem] shadow-sm border space-y-4 transition-all",
                          hasNonPreferred ? "border-amber-300 ring-1 ring-amber-100" : "border-accent/10"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-primary">
                              <UserIcon size={20} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-ink text-base">{request.representativeName}</h4>
                                <span className="bg-primary/10 text-primary font-bold text-[10px] px-2 py-0.5 rounded-md">
                                  {reqPieces} قطعة
                                </span>
                              </div>
                              <p className="text-[10px] text-secondary/40 uppercase tracking-widest font-black">
                                مندوب مبيعات • تاريخ الطلب: {request.date}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                              request.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                              request.status === 'approved' ? "bg-green-100 text-green-700" :
                              "bg-red-100 text-red-700"
                            )}>
                              {request.status === 'pending' ? 'قيد الانتظار' :
                               request.status === 'approved' ? 'تمت الموافقة' : 'تم الرفض'}
                            </div>
                            {request.editRequested && (
                              <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-600 animate-pulse">
                                <AlertCircle size={12} />
                                طلب تعديل
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Non-Preferred Visit Warning Box */}
                        {hasNonPreferred && (
                          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-start gap-2.5">
                            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                            <div className="text-xs text-amber-900 space-y-1">
                              <p className="font-bold">
                                تنبيه المدير: حدد المندوب زيارة {nonPreferredCustomers.length > 0 ? `(${nonPreferredCustomers.length}) عملاء` : 'عملاء'} في غير يومهم المفضل ليوم {arabicWeekday}:
                              </p>
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {nonPreferredCustomers.map((cust, cIdx) => {
                                  const pDays = (cust as any).preferredDays || ((cust as any).preferredDay ? [(cust as any).preferredDay] : []);
                                  const label = formatPreferredDaysArabic(pDays);
                                  return (
                                    <span key={cIdx} className="bg-white/80 border border-amber-300 text-amber-900 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                      {cust.customerName} (المفضل: {label})
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Product Flavors Breakdown - Small Table per Product */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Object.entries(
                            (request.items || []).reduce((acc, item) => {
                              if (!acc[item.productName]) acc[item.productName] = [];
                              acc[item.productName].push(item);
                              return acc;
                            }, {} as { [key: string]: LoadingRequestItem[] })
                          ).map(([productName, items], idx) => {
                            const rowTotal = (items as LoadingRequestItem[]).reduce((sum, it) => sum + (it.quantity || 0), 0);
                            return (
                              <div key={idx} className="bg-bg/40 rounded-2xl p-3 border border-accent/10 flex flex-col justify-between shadow-2xs">
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-accent/10">
                                  <div className="flex items-center gap-1.5">
                                    <Package size={14} className="text-primary shrink-0" />
                                    <span className="font-bold text-ink text-xs">{productName}</span>
                                  </div>
                                  <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-md">
                                    {rowTotal} قطعة
                                  </span>
                                </div>
                                <div className="overflow-hidden rounded-xl border border-accent/10 bg-white">
                                  <table className="w-full text-right text-xs">
                                    <thead>
                                      <tr className="bg-bg/60 text-[10px] font-bold text-secondary/60 border-b border-accent/5">
                                        <th className="py-1.5 px-2.5">الطعم</th>
                                        <th className="py-1.5 px-2.5 text-center">الكمية</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-accent/5">
                                      {(items as LoadingRequestItem[]).map((it, fIdx) => (
                                        <tr key={fIdx} className="hover:bg-bg/20">
                                          <td className="py-1.5 px-2.5 font-medium text-ink">{it.flavor}</td>
                                          <td className="py-1.5 px-2.5 text-center font-black text-primary">{it.quantity}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Collapsible Customer Visits Section */}
                        {request.selectedCustomers && request.selectedCustomers.length > 0 && (
                          <div className="border border-accent/10 rounded-2xl overflow-hidden bg-bg/20">
                            <button
                              type="button"
                              onClick={() => setExpandedCustomerListId(isExpanded ? null : request.id!)}
                              className="w-full p-3.5 flex items-center justify-between text-xs font-bold text-ink hover:bg-bg/40 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Users size={16} className="text-primary" />
                                <span>العملاء المحددين للزيارة ({request.selectedCustomers.length} عميل)</span>
                                {hasNonPreferred && (
                                  <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                    {nonPreferredCustomers.length} غير مفضل
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-secondary/60 text-[11px]">
                                <span>{isExpanded ? 'إخفاء التفاصيل' : 'عرض قائمة العملاء'}</span>
                                <ChevronDown size={16} className={cn("transition-transform duration-200", isExpanded && "rotate-180")} />
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="p-3.5 border-t border-accent/10 bg-white space-y-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                                  {request.selectedCustomers.map((cust, cIdx) => (
                                    <div 
                                      key={cIdx} 
                                      className={cn(
                                        "p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors",
                                        cust.isPreferredDay 
                                          ? "bg-green-50/40 border-green-200/80" 
                                          : "bg-amber-50/70 border-amber-300"
                                      )}
                                    >
                                      <div>
                                        <p className="font-bold text-ink">{cust.customerName}</p>
                                        {cust.area && <p className="text-[10px] text-secondary/60">{cust.area}</p>}
                                      </div>
                                      <div className="text-left">
                                        {cust.isPreferredDay ? (
                                          <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                            <Check size={10} />
                                            يوم مفضل
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                            <AlertTriangle size={10} />
                                            غير مفضل ({formatPreferredDaysArabic((cust as any).preferredDays || ((cust as any).preferredDay ? [(cust as any).preferredDay] : []))})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                          {request.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => handleUpdateStatus(request.id!, 'approved')}
                                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 active:scale-95"
                              >
                                <Check size={18} />
                                موافقة على التشغيلة
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(request.id!, 'rejected')}
                                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 active:scale-95"
                              >
                                <X size={18} />
                                رفض الطلب
                              </button>
                            </>
                          )}
                          {/* Toggle Representative Edit Permission */}
                          {request.canEdit ? (
                            <button 
                              type="button"
                              onClick={() => handleToggleRepEdit(request.id!, false)}
                              className="px-3.5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 text-xs active:scale-95 border border-accent/10"
                              title="قفل إمكانية التعديل للمندوب"
                            >
                              <Lock size={15} className="text-gray-500" />
                              <span>قفل تعديل المندوب</span>
                            </button>
                          ) : (
                            <button 
                              type="button"
                              onClick={() => handleToggleRepEdit(request.id!, true)}
                              className={cn(
                                "flex-1 py-3 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 text-xs active:scale-95 shadow-xs",
                                request.editRequested
                                  ? "bg-amber-500 hover:bg-amber-600 text-white animate-pulse shadow-md shadow-amber-500/25 ring-2 ring-amber-400"
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300"
                              )}
                              title={request.editRequested ? "المندوب يطلب فتح التعديل - انقر للموافقة" : "الموافقة والسماح للمندوب بتعديل هذا الطلب"}
                            >
                              <Unlock size={15} className={request.editRequested ? "text-white" : "text-emerald-700"} />
                              <span>{request.editRequested ? 'المندوب يطلب تعديل (اضغط للموافقة)' : 'فتح التعديل للمندوب'}</span>
                            </button>
                          )}

                          {/* Manager Direct Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenManagerEdit(request)}
                            className="px-3.5 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 text-xs active:scale-95 border border-blue-200"
                            title="تعديل أصناف وكميات هذا الطلب بواسطة المدير"
                          >
                            <Edit3 size={15} />
                            <span>تعديل الطلب (المدير)</span>
                          </button>

                          {/* Delete Button (Triggers Confirmation Modal) */}
                          <button
                            type="button"
                            onClick={() => setRequestToDelete(request)}
                            className="p-3 bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs font-bold active:scale-95 border border-transparent hover:border-red-200"
                            title="حذف هذا الطلب نهائياً"
                          >
                            <Trash2 size={16} />
                            <span className="hidden sm:inline">حذف</span>
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {viewMode === 'summary' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                    <ArrowUpDown size={18} />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif font-bold text-ink">مجمع طلبات التشغيل المعتمدة</h3>
                    <p className="text-xs text-secondary/60">إجمالي الكميات والأطعم المطلوب تجهيزها لتشغيلة {arabicWeekday} ({selectedDate})</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-white p-1 rounded-xl border border-accent/10 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setSummaryViewMode('cards')}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                        summaryViewMode === 'cards' ? "bg-primary text-white shadow-xs" : "text-secondary/60 hover:text-ink"
                      )}
                    >
                      <Package size={13} />
                      <span>جداول المنتجات</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSummaryViewMode('table')}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                        summaryViewMode === 'table' ? "bg-primary text-white shadow-xs" : "text-secondary/60 hover:text-ink"
                      )}
                    >
                      <ArrowUpDown size={13} />
                      <span>الجدول الشامل</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="p-2 text-secondary/60 hover:text-primary hover:bg-bg rounded-xl transition-colors"
                    title="طباعة التقرير المجمع"
                  >
                    <Printer size={20} />
                  </button>
                </div>
              </div>

              {/* Aggregated Products & Flavors */}
              {summaryViewMode === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedSummary.length === 0 ? (
                    <div className="col-span-full bg-white p-12 rounded-[2rem] border border-dashed border-accent/20 text-center text-secondary/40 font-bold italic">
                      لا توجد طلبات معتمدة لهذا التاريخ حتى الآن
                    </div>
                  ) : (
                    groupedSummary.map(([productName, items], idx) => {
                      const rowTotal = items.reduce((acc, item) => acc + item.total, 0);
                      return (
                        <div key={idx} className="bg-white rounded-2xl p-4 border border-accent/10 shadow-xs flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-accent/10">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                  <Package size={16} />
                                </div>
                                <span className="font-serif font-bold text-ink text-sm">{productName}</span>
                              </div>
                              <span className="bg-primary/10 text-primary text-xs font-black px-2.5 py-1 rounded-xl">
                                {rowTotal} قطعة
                              </span>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-accent/10 bg-bg/20">
                              <table className="w-full text-right border-collapse text-xs">
                                <thead>
                                  <tr className="bg-bg/60 border-b border-accent/10 text-[10px] font-black text-secondary/60 uppercase">
                                    <th className="py-2 px-3">الطعم / النكهة</th>
                                    <th className="py-2 px-3 text-center">إجمالي المطلوب</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-accent/5">
                                  {items.map((it, fIdx) => (
                                    <tr key={fIdx} className="hover:bg-bg/30">
                                      <td className="py-2 px-3 font-medium text-ink">{it.flavor}</td>
                                      <td className="py-2 px-3 text-center">
                                        <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-lg font-black">
                                          {it.total}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-[2rem] shadow-sm border border-accent/10 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-bg border-b border-accent/10">
                          <th className="px-4 py-4 text-xs font-black text-secondary/40 uppercase tracking-widest sticky right-0 bg-bg z-10">المنتج</th>
                          {allFlavors.map(flavor => (
                            <th key={flavor} className="px-4 py-4 text-xs font-black text-secondary/40 uppercase tracking-widest text-center">{flavor}</th>
                          ))}
                          <th className="px-4 py-4 text-xs font-black text-secondary/40 uppercase tracking-widest text-center">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-accent/5">
                        {groupedSummary.length === 0 ? (
                          <tr>
                            <td colSpan={allFlavors.length + 2} className="px-6 py-12 text-center text-secondary/40 font-bold italic">
                              لا توجد طلبات معتمدة لهذا التاريخ حتى الآن
                            </td>
                          </tr>
                        ) : (
                          groupedSummary.map(([productName, items], idx) => {
                            const rowTotal = items.reduce((acc, item) => acc + item.total, 0);
                            return (
                              <tr key={idx} className="hover:bg-bg/50 transition-colors group">
                                <td className="px-4 py-4 font-serif font-bold text-ink sticky right-0 bg-white group-hover:bg-bg/50 z-10 border-l border-accent/5">{productName}</td>
                                {allFlavors.map(flavor => {
                                  const flavorItem = items.find(i => i.flavor === flavor);
                                  return (
                                    <td key={flavor} className="px-4 py-4 text-center">
                                      {flavorItem ? (
                                        <span className="px-3 py-1 bg-primary/5 text-primary rounded-lg font-black">{flavorItem.total}</span>
                                      ) : (
                                        <span className="text-secondary/10">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-4 text-center">
                                  <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-lg font-black">{rowTotal}</span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Aggregated Representatives Plan Table */}
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-accent/10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                    <Users size={18} />
                  </div>
                  <h4 className="font-serif font-bold text-ink text-lg">كشف خطط المناديب والزيارات لتشغيلة {arabicWeekday}</h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-bg/50 border-b border-accent/10">
                        <th className="p-3 text-[10px] font-black text-secondary/60 uppercase">المندوب</th>
                        <th className="p-3 text-[10px] font-black text-secondary/60 uppercase text-center">حالة الطلب</th>
                        <th className="p-3 text-[10px] font-black text-secondary/60 uppercase text-center">إجمالي القطع</th>
                        <th className="p-3 text-[10px] font-black text-secondary/60 uppercase text-center">عدد العملاء المجدولين</th>
                        <th className="p-3 text-[10px] font-black text-secondary/60 uppercase text-center">حالة الزيارات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-accent/5">
                      {requests.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-secondary/40 font-bold">لا توجد طلبات مسجلة</td>
                        </tr>
                      ) : (
                        requests.map(req => {
                          const nonPrefCount = req.selectedCustomers?.filter(c => !c.isPreferredDay).length || 0;
                          const reqTotal = (req.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);
                          return (
                            <tr key={req.id} className="hover:bg-bg/30 transition-colors">
                              <td className="p-3 font-bold text-ink">{req.representativeName}</td>
                              <td className="p-3 text-center">
                                <span className={cn(
                                  "px-2.5 py-0.5 rounded-full text-[10px] font-bold",
                                  req.status === 'approved' ? "bg-green-100 text-green-700" :
                                  req.status === 'pending' ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                                )}>
                                  {req.status === 'approved' ? 'معتمد' : req.status === 'pending' ? 'قيد الانتظار' : 'مرفوض'}
                                </span>
                              </td>
                              <td className="p-3 text-center font-black text-primary">{reqTotal} قطعة</td>
                              <td className="p-3 text-center font-bold text-ink">{req.selectedCustomers?.length || 0} عميل</td>
                              <td className="p-3 text-center">
                                {nonPrefCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                                    <AlertTriangle size={12} />
                                    {nonPrefCount} عميل غير مفضل
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">
                                    <Check size={12} />
                                    منتظم بالكامل
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'storekeeper' && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                  <Package size={18} />
                </div>
                <h3 className="text-xl font-serif font-bold text-ink">كشف تسليم المخزن</h3>
              </div>

              <div className="space-y-6">
                {requests.filter(r => r.status === 'approved').length === 0 ? (
                  <div className="bg-white p-12 rounded-[2rem] border border-dashed border-accent/20 text-center text-secondary/40 font-bold italic">
                    لا توجد طلبات معتمدة للتسليم
                  </div>
                ) : (
                  requests.filter(r => r.status === 'approved').map(request => (
                    <div key={request.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-accent/10 space-y-4">
                      <div className="flex justify-between items-center border-b border-accent/5 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-black">
                            {request.representativeName.charAt(0)}
                          </div>
                          <h4 className="font-bold text-ink text-lg">{request.representativeName}</h4>
                        </div>
                        <button 
                          onClick={() => window.print()}
                          className="p-2 text-secondary/40 hover:text-primary transition-colors"
                        >
                          <Printer size={20} />
                        </button>
                      </div>
                      {/* Product Flavors Breakdown for Storekeeper - Small Tables */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(
                          (request.items || []).reduce((acc, item) => {
                            if (!acc[item.productName]) acc[item.productName] = [];
                            acc[item.productName].push(item);
                            return acc;
                          }, {} as { [key: string]: LoadingRequestItem[] })
                        ).map(([productName, items], idx) => {
                          const rowTotal = (items as LoadingRequestItem[]).reduce((sum, it) => sum + (it.quantity || 0), 0);
                          return (
                            <div key={idx} className="bg-bg/40 rounded-2xl p-3 border border-accent/10 flex flex-col justify-between shadow-2xs">
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-accent/10">
                                <div className="flex items-center gap-1.5">
                                  <Package size={14} className="text-primary shrink-0" />
                                  <span className="font-bold text-ink text-xs">{productName}</span>
                                </div>
                                <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-md">
                                  {rowTotal} قطعة
                                </span>
                              </div>
                              <div className="overflow-hidden rounded-xl border border-accent/10 bg-white">
                                <table className="w-full text-right text-xs">
                                  <thead>
                                    <tr className="bg-bg/60 text-[10px] font-bold text-secondary/60 border-b border-accent/5">
                                      <th className="py-1.5 px-2.5">الطعم</th>
                                      <th className="py-1.5 px-2.5 text-center">الكمية المسلمة</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-accent/5">
                                    {(items as LoadingRequestItem[]).map((it, fIdx) => (
                                      <tr key={fIdx} className="hover:bg-bg/20">
                                        <td className="py-1.5 px-2.5 font-medium text-ink">{it.flavor}</td>
                                        <td className="py-1.5 px-2.5 text-center font-black text-primary">{it.quantity}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Flavors Management */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
              <Package size={18} />
            </div>
            <h3 className="text-xl font-serif font-bold text-ink">إدارة الأطعم</h3>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-accent/10 space-y-6">
            <p className="text-xs text-secondary/60 font-medium leading-relaxed">
              يمكنك هنا إضافة أو حذف الأطعم المتاحة لكل منتج ليتمكن المناديب من اختيارها في طلبات التشغيل.
            </p>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {products.map(product => (
                <div key={product.id} className="p-4 bg-bg rounded-2xl border border-accent/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink text-sm">{product.name}</span>
                    <button 
                      onClick={() => setEditingFlavors(editingFlavors === product.id ? null : product.id)}
                      className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-all"
                    >
                      {editingFlavors === product.id ? <X size={16} /> : <Plus size={16} />}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {product.flavors && product.flavors.length > 0 ? (
                      product.flavors.map(flavor => (
                        <div key={flavor} className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-accent/10 text-[10px] font-bold text-secondary/60 group">
                          {flavor}
                          <button 
                            onClick={() => handleRemoveFlavor(product.id, flavor)}
                            className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <span className="text-[10px] text-secondary/30 italic">لا توجد أطعم مضافة</span>
                    )}
                  </div>

                  {editingFlavors === product.id && (
                    <div className="flex gap-2 pt-2">
                      <input 
                        type="text"
                        value={newFlavor}
                        onChange={(e) => setNewFlavor(e.target.value)}
                        placeholder="اسم الطعم الجديد..."
                        className="flex-1 bg-white px-3 py-1.5 rounded-lg border border-accent/10 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddFlavor(product.id)}
                      />
                      <button 
                        onClick={() => handleAddFlavor(product.id)}
                        className="bg-primary text-white p-1.5 rounded-lg hover:bg-secondary transition-all"
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {requestToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-100 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-ink">تأكيد حذف طلب التشغيلة</h3>
                <p className="text-xs text-secondary/60">هذا الإجراء سيحذف الطلب نهائياً من قاعدة البيانات</p>
              </div>
            </div>

            <div className="bg-red-50/70 border border-red-200 rounded-2xl p-4 text-xs text-red-950 space-y-2">
              <p className="font-bold">هل أنت متأكد من رغبتك في حذف طلب التشغيلة التالي؟</p>
              <div className="space-y-1 text-secondary">
                <p><span className="font-bold text-ink">المندوب:</span> {requestToDelete.representativeName}</p>
                <p><span className="font-bold text-ink">التاريخ:</span> {requestToDelete.date} ({arabicWeekday})</p>
                <p><span className="font-bold text-ink">إجمالي القطع:</span> {(requestToDelete.items || []).reduce((s, i) => s + (i.quantity || 0), 0)} قطعة</p>
              </div>
              <p className="text-[11px] text-red-700 font-semibold pt-1">
                ⚠️ تنبيه: سيتم حذف هذا السجل نهائياً ولن يعود عند تحديث الصفحة أو فتح التطبيق.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRequestToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-secondary hover:text-ink rounded-xl font-bold text-sm transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 active:scale-95"
              >
                {isDeleting ? (
                  <span>جارٍ الحذف...</span>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>تأكيد الحذف نهائياً</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Direct Edit Modal */}
      {managerEditingRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-primary/10 space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-accent/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Edit3 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-bold text-ink">تعديل طلب التشغيلة (المدير)</h3>
                  <p className="text-xs text-secondary/60">
                    المندوب: {managerEditingRequest.representativeName} | التاريخ: {managerEditingRequest.date} ({arabicWeekday})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManagerEditingRequest(null)}
                className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Items List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-ink">الأصناف والكميات المطلوبة ({managerEditingItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0)} قطعة):</h4>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {managerEditingItems.length === 0 ? (
                  <p className="text-xs text-secondary/60 text-center py-6 bg-gray-50 rounded-2xl">لا توجد أصناف في هذا الطلب حالياً</p>
                ) : (
                  managerEditingItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100/80 rounded-2xl border border-accent/10 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-ink truncate">{item.productName}</p>
                        <span className="text-[11px] px-2 py-0.5 bg-white text-secondary rounded-lg border border-accent/10 font-bold">
                          {item.flavor || 'بدون طعم'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleManagerUpdateQty(idx, (item.quantity || 0) - 1)}
                          className="w-8 h-8 rounded-lg bg-white border border-accent/20 flex items-center justify-center font-bold text-ink hover:bg-gray-100 active:scale-95"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => handleManagerUpdateQty(idx, parseInt(e.target.value) || 0)}
                          className="w-16 text-center font-bold bg-white border border-accent/20 rounded-lg py-1 text-sm text-ink focus:outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => handleManagerUpdateQty(idx, (item.quantity || 0) + 1)}
                          className="w-8 h-8 rounded-lg bg-white border border-accent/20 flex items-center justify-center font-bold text-ink hover:bg-gray-100 active:scale-95"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleManagerRemoveItem(idx)}
                          className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors"
                          title="حذف الصنف"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add New Product Section */}
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-3">
              <h5 className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Plus size={14} />
                إضافة صنف أو نكهة جديدة للطلب:
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={managerAddProductId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setManagerAddProductId(pid);
                    const prod = products.find(p => p.id === pid);
                    const flvs = prod?.flavors && prod.flavors.length > 0 ? prod.flavors : ['بدون طعم'];
                    setManagerAddFlavor(flvs[0]);
                  }}
                  className="bg-white border border-accent/20 rounded-xl px-3 py-2 text-xs font-bold text-ink focus:outline-none focus:border-primary"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <select
                  value={managerAddFlavor}
                  onChange={(e) => setManagerAddFlavor(e.target.value)}
                  className="bg-white border border-accent/20 rounded-xl px-3 py-2 text-xs font-bold text-ink focus:outline-none focus:border-primary"
                >
                  {(() => {
                    const prod = products.find(p => p.id === managerAddProductId);
                    const flvs = prod?.flavors && prod.flavors.length > 0 ? prod.flavors : ['بدون طعم'];
                    return flvs.map((f, i) => (
                      <option key={i} value={f}>{f}</option>
                    ));
                  })()}
                </select>

                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={managerAddQuantity}
                    onChange={(e) => setManagerAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 bg-white border border-accent/20 rounded-xl px-2 py-2 text-center text-xs font-bold text-ink focus:outline-none focus:border-primary"
                    placeholder="الكمية"
                  />
                  <button
                    type="button"
                    onClick={handleManagerAddItem}
                    className="flex-1 bg-primary text-white text-xs font-bold rounded-xl px-3 py-2 hover:bg-primary/90 transition-all flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Plus size={14} />
                    إضافة
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-accent/10">
              <button
                type="button"
                onClick={() => setManagerEditingRequest(null)}
                disabled={savingManagerEdit}
                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-secondary hover:text-ink rounded-xl font-bold text-sm transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveManagerEdit}
                disabled={savingManagerEdit}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
              >
                {savingManagerEdit ? (
                  <span>جارٍ الحفظ...</span>
                ) : (
                  <>
                    <Save size={16} />
                    <span>حفظ التعديلات</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingRequestTab({ products, customers = [], profile, showToast }: { products: Product[], customers?: Customer[], profile: UserProfile | null, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')); // Tomorrow by default
  const [requestItems, setRequestItems] = useState<{ [productId: string]: { [flavor: string]: number } }>({});
  const [productSearch, setProductSearch] = useState('');
  const [productFilterTab, setProductFilterTab] = useState<'all' | 'selected'>('all');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilterTab, setCustomerFilterTab] = useState<'all' | 'preferred' | 'others' | 'selected'>('all');
  const [activeSection, setActiveSection] = useState<'products' | 'customers'>('products');
  const [saving, setSaving] = useState(false);
  const [existingRequest, setExistingRequest] = useState<LoadingRequest | null>(null);
  const isRepEditingLocked = Boolean(
    existingRequest && 
    existingRequest.status !== 'pending' && 
    !existingRequest.canEdit
  );

  // Helper: get specific flavors for a product
  const getProductFlavors = useCallback((product: Product): string[] => {
    if (product.flavors && product.flavors.length > 0) {
      return product.flavors;
    }
    return ['بدون طعم'];
  }, []);

  // Filtered products based on search and selected filter tab
  const displayedProducts = useMemo(() => {
    return products.filter(p => {
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase();
        if (!p.name.toLowerCase().includes(q)) return false;
      }
      if (productFilterTab === 'selected') {
        const total = Object.values(requestItems[p.id] || {}).reduce<number>((a, b) => a + (Number(b) || 0), 0);
        return total > 0;
      }
      return true;
    });
  }, [products, productSearch, productFilterTab, requestItems]);

  const selectedProductsCount = useMemo(() => {
    return products.filter(p => {
      const items = requestItems[p.id];
      if (!items) return false;
      return Object.values(items).some(q => (Number(q) || 0) > 0);
    }).length;
  }, [products, requestItems]);

  // Calculate weekday from selected date
  const selectedWeekday = useMemo(() => {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const parts = selectedDate.split('-');
    const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return daysOfWeek[dateObj.getDay()];
  }, [selectedDate]);

  const arabicWeekday = useMemo(() => {
    return WEEKDAYS.find(w => w.value === selectedWeekday)?.label || selectedWeekday;
  }, [selectedWeekday]);

  // Helper: extract preferred days
  const getCustomerPreferredDays = useCallback((c: Customer): string[] => {
    return parseCustomerPreferredDays(c);
  }, []);

  const isCustomerPreferredToday = useCallback((c: Customer, day: string): boolean => {
    return isCustomerPreferredOnDay(c, day);
  }, []);

  // Filter customers assigned to this representative (or all if manager/supervisor)
  const repCustomers = useMemo(() => {
    return customers.filter(c => {
      if (profile?.role === 'representative') {
        return c.representativeId === profile.uid || (c as any).representativeid === profile.uid || !c.representativeId;
      }
      return true;
    });
  }, [customers, profile]);

  // Preferred customers for selected weekday
  const preferredCustomers = useMemo(() => {
    return repCustomers.filter(c => isCustomerPreferredOnDay(c, selectedWeekday));
  }, [repCustomers, selectedWeekday, isCustomerPreferredOnDay]);

  // Other customers (whose preferred day is not today)
  const otherCustomers = useMemo(() => {
    return repCustomers.filter(c => !isCustomerPreferredOnDay(c, selectedWeekday));
  }, [repCustomers, selectedWeekday, isCustomerPreferredOnDay]);

  useEffect(() => {
    if (!profile) return;
    const unsub = dataService.subscribeToLoadingRequestsByRepAndDate(profile.uid, selectedDate, (data) => {
      if (data.length > 0) {
        const req = data[0] as LoadingRequest;
        setExistingRequest(req);
        const items: { [productId: string]: { [flavor: string]: number } } = {};
        let cleanItemsList: any[] = [];
        if (Array.isArray(req.items)) {
          cleanItemsList = req.items;
        } else if (typeof req.items === 'string') {
          try { cleanItemsList = JSON.parse(req.items); } catch (_) {}
        }
        cleanItemsList.forEach(item => {
          if (item && item.productId) {
            if (!items[item.productId]) items[item.productId] = {};
            items[item.productId][item.flavor] = item.quantity;
          }
        });
        setRequestItems(items);

        let cleanCustomersList: any[] = [];
        if (Array.isArray(req.selectedCustomers)) {
          cleanCustomersList = req.selectedCustomers;
        } else if (typeof (req as any).selectedCustomers === 'string') {
          try { cleanCustomersList = JSON.parse((req as any).selectedCustomers); } catch (_) {}
        } else if (Array.isArray((req as any).selected_customers)) {
          cleanCustomersList = (req as any).selected_customers;
        } else if (typeof (req as any).selected_customers === 'string') {
          try { cleanCustomersList = JSON.parse((req as any).selected_customers); } catch (_) {}
        }

        if (cleanCustomersList.length > 0) {
          setSelectedCustomerIds(cleanCustomersList.map((c: any) => c.id || c));
        } else {
          const defaultPreferredIds = repCustomers
            .filter(c => isCustomerPreferredOnDay(c, selectedWeekday))
            .map(c => c.id);
          setSelectedCustomerIds(defaultPreferredIds);
        }
      } else {
        setExistingRequest(null);
        setRequestItems({});
        // Pre-select preferred customers for tomorrow automatically on clean form
        const defaultPreferredIds = repCustomers
          .filter(c => isCustomerPreferredOnDay(c, selectedWeekday))
          .map(c => c.id);
        setSelectedCustomerIds(defaultPreferredIds);
      }
    });
    return () => unsub();
  }, [profile, selectedDate, repCustomers, selectedWeekday, isCustomerPreferredOnDay]);

  const handleUpdateQuantity = (productId: string, flavor: string, quantity: number) => {
    if (isRepEditingLocked) {
      showToast('التعديل مغلق افتراضياً. يرجى الضغط على زر "طلب فتح التعديل" بانتظار موافقة المدير', 'error');
      return;
    }
    setRequestItems(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [flavor]: quantity
      }
    }));
  };

  const allFlavors = useMemo(() => {
    const flavors = new Set<string>();
    products.forEach(p => {
      if (p.flavors && p.flavors.length > 0) {
        p.flavors.forEach(f => flavors.add(f));
      } else {
        flavors.add('بدون طعم');
      }
    });
    return Array.from(flavors).sort();
  }, [products]);

  // Non-preferred selected customers
  const nonPreferredSelected = useMemo(() => {
    return selectedCustomerIds
      .map(id => repCustomers.find(c => c.id === id))
      .filter((c): c is Customer => !!c && !isCustomerPreferredOnDay(c, selectedWeekday));
  }, [selectedCustomerIds, repCustomers, selectedWeekday, isCustomerPreferredOnDay]);

  // Total quantity
  const totalQuantity = useMemo(() => {
    let sum = 0;
    Object.values(requestItems).forEach(flavors => {
      Object.values(flavors).forEach(qty => {
        sum += (qty || 0);
      });
    });
    return sum;
  }, [requestItems]);

  // Customer selection toggles
  const toggleCustomer = (id: string) => {
    if (isRepEditingLocked) {
      showToast('التعديل مغلق افتراضياً. يرجى الضغط على زر "طلب فتح التعديل" بانتظار موافقة المدير', 'error');
      return;
    }
    setSelectedCustomerIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllPreferred = () => {
    if (isRepEditingLocked) return;
    const prefIds = preferredCustomers.map(c => c.id);
    setSelectedCustomerIds(prefIds);
    showToast(`تم تعيين عملاء يوم ${arabicWeekday} المفضلين (${prefIds.length}) كزيارات محددة`);
  };

  const handleSelectAllCustomers = () => {
    if (isRepEditingLocked) return;
    setSelectedCustomerIds(repCustomers.map(c => c.id));
    showToast(`تم تحديد جميع عملاء خط السير (${repCustomers.length})`);
  };

  const handleClearAllCustomers = () => {
    if (isRepEditingLocked) return;
    setSelectedCustomerIds([]);
    showToast('تم إلغاء تحديد جميع العملاء');
  };

  // Filtered lists for display
  const filteredTodayPreferred = useMemo(() => {
    if (!customerSearch.trim()) return preferredCustomers;
    const q = customerSearch.toLowerCase();
    return preferredCustomers.filter(c => {
      const matchName = (c.shopName || '').toLowerCase().includes(q);
      const matchOwner = (c.ownerName || '').toLowerCase().includes(q);
      const matchArea = (c.area || '').toLowerCase().includes(q);
      const matchPhone = (c.phone || '').includes(q);
      return matchName || matchOwner || matchArea || matchPhone;
    });
  }, [preferredCustomers, customerSearch]);

  const filteredOtherCustomers = useMemo(() => {
    if (!customerSearch.trim()) return otherCustomers;
    const q = customerSearch.toLowerCase();
    return otherCustomers.filter(c => {
      const matchName = (c.shopName || '').toLowerCase().includes(q);
      const matchOwner = (c.ownerName || '').toLowerCase().includes(q);
      const matchArea = (c.area || '').toLowerCase().includes(q);
      const matchPhone = (c.phone || '').includes(q);
      return matchName || matchOwner || matchArea || matchPhone;
    });
  }, [otherCustomers, customerSearch]);

  const selectedTodayCount = useMemo(() => {
    return preferredCustomers.filter(c => selectedCustomerIds.includes(c.id)).length;
  }, [preferredCustomers, selectedCustomerIds]);

  const selectedOthersCount = useMemo(() => {
    return otherCustomers.filter(c => selectedCustomerIds.includes(c.id)).length;
  }, [otherCustomers, selectedCustomerIds]);

  const handleSave = async () => {
    if (!profile) return;
    if (isRepEditingLocked) {
      showToast('التعديل مغلق افتراضياً بعد إرسال الطلب. يرجى الضغط على "طلب فتح التعديل" بانتظار موافقة المدير', 'error');
      return;
    }
    const items: LoadingRequestItem[] = [];
    Object.entries(requestItems).forEach(([productId, flavors]) => {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      Object.entries(flavors).forEach(([flavor, quantity]) => {
        if (quantity > 0) {
          items.push({
            productId,
            productName: product.name,
            flavor,
            quantity
          });
        }
      });
    });

    if (items.length === 0 && selectedCustomerIds.length === 0) {
      showToast('يرجى تسجيل كميات المنتجات أو تحديد العملاء للتشغيلة', 'error');
      return;
    }

    setSaving(true);
    try {
      // Build selected customer records
      const selectedCustomersList: SelectedVisitCustomer[] = selectedCustomerIds.map(id => {
        const c = repCustomers.find(x => x.id === id);
        const pDays = c ? getCustomerPreferredDays(c) : [];
        const isPreferred = c ? isCustomerPreferredOnDay(c, selectedWeekday) : false;
        return {
          id,
          shopName: c?.shopName || 'عميل غير معروف',
          ownerName: c?.ownerName || '',
          area: c?.area || '',
          phone: c?.phone || '',
          isPreferredDay: isPreferred,
          preferredDays: pDays
        };
      });

      const hasNonPreferred = nonPreferredSelected.length > 0;

      const requestData: any = {
        representativeId: profile.uid,
        representativeName: profile.name,
        date: selectedDate,
        items,
        selectedCustomers: selectedCustomersList,
        nonPreferredWarning: hasNonPreferred,
        status: existingRequest?.status || 'pending',
        canEdit: false,
        editRequested: false,
        timestamp: new Date().toISOString()
      };

      let saveRes: any;
      if (existingRequest?.id) {
        saveRes = await dataService.updateLoadingRequest(existingRequest.id, {
          ...requestData,
          canEdit: false,
          editRequested: false
        });
      } else {
        saveRes = await dataService.addLoadingRequest(requestData);
      }

      // Send manager notification
      if (hasNonPreferred) {
        const sampleNames = nonPreferredSelected.slice(0, 4).map(c => c.shopName).join('، ') + (nonPreferredSelected.length > 4 ? ` و ${nonPreferredSelected.length - 4} آخرين` : '');
        await dataService.createNotification(
          '⚠️ تنبيه تشغيلة: زيارة عملاء في غير يومهم',
          `سجل المندوب ${profile.name} تشغيلة لتاريخ ${selectedDate} (${arabicWeekday}) تضم (${selectedCustomersList.length}) عميل و (${totalQuantity}) قطعة. تنبيه: تم اختيار (${nonPreferredSelected.length}) عميل في غير يومهم المفضل: [${sampleNames}].`,
          'warning',
          profile.uid,
          profile.name,
          'admin_loading_requests'
        );
      } else {
        await dataService.createNotification(
          existingRequest ? 'تم تعديل طلب التشغيلة' : 'طلب تشغيلة جديد',
          `${existingRequest ? 'عدّل' : 'سجل'} المندوب ${profile.name} تشغيلة لتاريخ ${selectedDate} (${arabicWeekday}) تضم (${selectedCustomersList.length}) عميل و (${totalQuantity}) قطعة.`,
          'system',
          profile.uid,
          profile.name,
          'admin_loading_requests'
        );
      }

      if (saveRes?._syncResult && !saveRes._syncResult.success) {
        console.warn('Sync notice for loading request:', saveRes._syncResult);
        showToast(`تم الحفظ محلياً ولكن تعذر الترحيل إلى السيرفر: ${saveRes._syncResult.error || 'يرجى التحقق من اتصالك'}`, 'error');
      } else {
        showToast(existingRequest ? 'تم حفظ التعديلات وترحيلها بنجاح' : 'تم حفظ طلب التشغيلة وترحيلها بنجاح', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء حفظ الطلب', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestEdit = async () => {
    if (!existingRequest?.id || !profile) return;
    try {
      await dataService.updateLoadingRequest(existingRequest.id, {
        editRequested: true
      });
      await dataService.createNotification(
        'طلب فتح تعديل تشغيلة معتمدة',
        `طلب المندوب ${profile.name} فتح تعديل تشغيلة معتمدة لتاريخ ${selectedDate} (${arabicWeekday})`,
        'system',
        profile.uid,
        profile.name,
        'admin_loading_requests'
      );
      showToast('تم إرسال طلب فتح التعديل للإدارة بنجاح', 'success');
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء إرسال طلب التعديل', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-40 md:pb-12">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-[2rem] shadow-xl border-2 border-primary/5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-inner">
            <ClipboardList size={24} />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-ink flex items-center gap-2">
              التشغيلة اليومية
              <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-sans font-bold">
                يوم {arabicWeekday}
              </span>
            </h2>
            <p className="text-xs text-secondary/60">تسجيل بضاعة التشغيلة وتحديد العملاء المجدولين للزيارة</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-bg p-1 rounded-xl border border-accent/10">
            <button
              type="button"
              onClick={() => setSelectedDate(format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'))}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                selectedDate === format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')
                  ? "bg-primary text-white shadow-sm"
                  : "text-secondary hover:text-ink"
              )}
            >
              تشغيلة الغد (الافتراضي)
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                selectedDate === format(new Date(), 'yyyy-MM-dd')
                  ? "bg-primary text-white shadow-sm"
                  : "text-secondary hover:text-ink"
              )}
            >
              تشغيلة اليوم
            </button>
          </div>

          <div className="flex items-center gap-2 bg-bg px-3 py-1.5 rounded-xl border border-accent/10">
            <Calendar size={16} className="text-primary" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-xs font-bold text-ink cursor-pointer"
            />
          </div>

          {isRepEditingLocked ? (
            existingRequest?.editRequested ? (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold shadow-xs">
                <Clock size={14} className="animate-spin text-amber-600" />
                <span>بانتظار موافقة المدير</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRequestEdit}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <Edit3 size={14} />
                <span>طلب فتح التعديل</span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-secondary text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Save size={15} />
              <span>{existingRequest ? 'حفظ التعديلات' : 'حفظ'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Existing Request Status Banner */}
      {existingRequest && (
        <div className={cn(
          "p-4 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm",
          existingRequest.canEdit 
            ? "bg-emerald-50 border-emerald-300 text-emerald-950" 
            : existingRequest.editRequested
              ? "bg-amber-50 border-amber-300 text-amber-950"
              : existingRequest.status === 'pending'
                ? "bg-blue-50 border-blue-200 text-blue-950"
                : existingRequest.status === 'approved'
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                  : "bg-red-50 border-red-200 text-red-950"
        )}>
          <div className="flex items-center gap-3">
            {existingRequest.canEdit ? (
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Unlock size={20} />
              </div>
            ) : existingRequest.editRequested ? (
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Clock size={20} className="animate-spin" />
              </div>
            ) : existingRequest.status === 'approved' ? (
              <div className="w-10 h-10 rounded-xl bg-gray-200 text-gray-700 flex items-center justify-center shrink-0 shadow-xs">
                <Lock size={20} />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Clock size={20} />
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-bold text-sm">
                حالة الطلب: {
                  existingRequest.status === 'pending' ? 'مسجل (قيد الانتظار لاعتماد المدير)' :
                  existingRequest.status === 'approved' ? 'معتمد من المدير' : 'تم الرفض'
                }
              </span>
              {existingRequest.canEdit ? (
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                  <Check size={14} />
                  وافق المدير على فتح التعديل! يمكنك الآن تعديل الأعداد والعملاء والضغط على "حفظ التعديلات".
                </span>
              ) : existingRequest.editRequested ? (
                <span className="text-xs font-bold text-amber-700 flex items-center gap-1 mt-0.5">
                  <Clock size={13} className="animate-spin text-amber-600" />
                  تم إرسال طلب التعديل للإدارة، بانتظار موافقة المدير لفتح التعديل...
                </span>
              ) : existingRequest.status === 'approved' ? (
                <span className="text-xs font-bold text-secondary/70 flex items-center gap-1 mt-0.5">
                  <Lock size={13} className="text-gray-500" />
                  تم اعتماد التشغيلة من المدير والتعديل مقفول. إذا كنت بحاجة لتعديل الأعداد، اضغط على زر "طلب فتح التعديل".
                </span>
              ) : (
                <span className="text-xs font-bold text-blue-700 flex items-center gap-1 mt-0.5">
                  <Check size={13} />
                  الطلب قيد الانتظار - يمكنك تعديل الأعداد وحفظها قبل اعتماد المدير.
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {isRepEditingLocked ? (
              existingRequest.editRequested ? (
                <span className="px-3.5 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <Clock size={14} className="animate-spin text-amber-700" />
                  <span>بانتظار موافقة المدير</span>
                </span>
              ) : (
                <button 
                  type="button"
                  onClick={handleRequestEdit}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  <Edit3 size={14} />
                  <span>طلب فتح التعديل من المدير</span>
                </button>
              )
            ) : existingRequest.status === 'approved' && existingRequest.canEdit ? (
              <span className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <Unlock size={14} />
                <span>التعديل مفتوح لك الآن</span>
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* Section Switcher Tabs */}
      <div className="flex gap-3 border-b border-accent/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveSection('products')}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all",
            activeSection === 'products'
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "bg-white text-secondary hover:text-ink border border-accent/10"
          )}
        >
          <Package size={18} />
          <span>أعداد وأطعمة المنتجات</span>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-xs font-black",
            activeSection === 'products' ? "bg-white/20 text-white" : "bg-bg text-secondary"
          )}>
            {totalQuantity} قطعة
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('customers')}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all",
            activeSection === 'customers'
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "bg-white text-secondary hover:text-ink border border-accent/10"
          )}
        >
          <Users size={18} />
          <span>عملاء زيارة يوم {arabicWeekday}</span>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-xs font-black",
            activeSection === 'customers' ? "bg-white/20 text-white" : "bg-bg text-secondary"
          )}>
            {selectedCustomerIds.length} عميل
          </span>
          {nonPreferredSelected.length > 0 && (
            <span className="bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded-full text-[10px] font-black animate-pulse">
              ⚠️ {nonPreferredSelected.length}
            </span>
          )}
        </button>
      </div>

      {/* SECTION 1: Products & Flavors - Small Table for Each Product */}
      {activeSection === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
            <div>
              <h3 className="font-bold text-ink text-sm flex items-center gap-2">
                <Package size={18} className="text-primary" />
                <span>جداول المنتجات والأطعم للتشغيلة:</span>
              </h3>
              <p className="text-xs text-secondary/60">كل منتج في جدول مستقل خاص بأطعمه لتحديد الكميات بسهولة ودقة</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-xs font-black">
                إجمالي التشغيلة: <span className="text-sm font-black">{totalQuantity}</span> قطعة
              </div>
            </div>
          </div>

          {/* Search & Filter Bar for Products */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-accent/10 shadow-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary/40" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="ابحث عن منتج بالاسم..."
                className="w-full bg-bg pr-9 pl-4 py-2 rounded-xl text-xs font-bold text-ink focus:outline-none focus:ring-1 focus:ring-primary border border-accent/5"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-bg p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setProductFilterTab('all')}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                  productFilterTab === 'all' ? "bg-white text-primary shadow-xs" : "text-secondary/60 hover:text-ink"
                )}
              >
                جميع المنتجات ({products.length})
              </button>
              <button
                type="button"
                onClick={() => setProductFilterTab('selected')}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                  productFilterTab === 'selected' ? "bg-white text-primary shadow-xs" : "text-secondary/60 hover:text-ink"
                )}
              >
                المحددة فقط ({selectedProductsCount})
              </button>
            </div>
          </div>

          {/* Grid of Small Tables (One per Product) */}
          {displayedProducts.length === 0 ? (
            <div className="bg-white p-12 rounded-[2rem] border border-dashed border-accent/20 text-center space-y-2">
              <Package size={36} className="mx-auto text-secondary/30" />
              <p className="text-sm font-bold text-secondary/60">لا توجد منتجات مطابقة للبحث</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedProducts.map(product => {
                const productFlavors = getProductFlavors(product);
                const rowTotal = Object.values(requestItems[product.id] || {}).reduce<number>((a, b) => a + (Number(b) || 0), 0);
                const hasFilledItems = rowTotal > 0;

                return (
                  <div 
                    key={product.id}
                    className={cn(
                      "bg-white rounded-2xl border transition-all p-4 flex flex-col justify-between shadow-xs",
                      hasFilledItems ? "border-primary/40 ring-1 ring-primary/10" : "border-accent/10 hover:border-accent/30"
                    )}
                  >
                    <div>
                      {/* Product Card Header */}
                      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-accent/10">
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors",
                            hasFilledItems ? "bg-primary text-white shadow-sm" : "bg-bg text-secondary"
                          )}>
                            <Package size={17} />
                          </div>
                          <div>
                            <h4 className="font-bold text-ink text-sm leading-tight">{product.name}</h4>
                            <p className="text-[10px] text-secondary/60 font-medium">
                              {productFlavors.length} {productFlavors.length === 1 ? 'طعم متاح' : 'أطعم متاحة'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2.5 py-1 rounded-xl text-xs font-black transition-colors",
                            hasFilledItems ? "bg-primary/10 text-primary border border-primary/20" : "bg-bg text-secondary/40"
                          )}>
                            {rowTotal} قطعة
                          </span>
                        </div>
                      </div>

                      {/* Small Table for this Product's Flavors */}
                      <div className="overflow-hidden rounded-xl border border-accent/10 bg-bg/20">
                        <table className="w-full text-right border-collapse text-xs">
                          <thead>
                            <tr className="bg-bg/60 border-b border-accent/10 text-[10px] font-black text-secondary/60 uppercase">
                              <th className="py-2 px-3">الطعم / النكهة</th>
                              <th className="py-2 px-3 text-center">الكمية بالقطعة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-accent/5">
                            {productFlavors.map(flavor => {
                              const qty = requestItems[product.id]?.[flavor] || 0;
                              return (
                                <tr 
                                  key={flavor}
                                  className={cn(
                                    "transition-colors",
                                    qty > 0 ? "bg-primary/5 font-bold" : "hover:bg-bg/40"
                                  )}
                                >
                                  <td className="py-2 px-3 font-medium text-ink">
                                    <div className="flex items-center gap-2">
                                      <span className={cn(
                                        "w-2 h-2 rounded-full shrink-0 transition-colors",
                                        qty > 0 ? "bg-primary" : "bg-secondary/20"
                                      )} />
                                      <span className={cn(qty > 0 ? "text-primary font-bold" : "text-ink")}>
                                        {flavor}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-1.5 px-3 text-center">
                                    <div className={cn(
                                      "inline-flex items-center justify-center gap-1 p-1 rounded-xl border border-accent/10 shadow-2xs transition-opacity",
                                      isRepEditingLocked ? "bg-gray-100 opacity-60" : "bg-white"
                                    )}>
                                      <button 
                                        type="button"
                                        onClick={() => handleUpdateQuantity(product.id, flavor, Math.max(0, qty - 1))}
                                        disabled={isRepEditingLocked}
                                        className="w-7 h-7 flex items-center justify-center bg-bg rounded-lg text-secondary hover:text-primary font-black active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
                                        title="إنقاص قطعة"
                                      >
                                        -
                                      </button>
                                      <input 
                                        type="number"
                                        min="0"
                                        value={qty || ''}
                                        onChange={(e) => handleUpdateQuantity(product.id, flavor, Math.max(0, parseInt(e.target.value) || 0))}
                                        disabled={isRepEditingLocked}
                                        className="w-12 text-center bg-transparent font-black text-ink focus:ring-1 focus:ring-primary rounded-md outline-none disabled:opacity-50 disabled:cursor-not-allowed p-1 text-xs"
                                        placeholder="0"
                                      />
                                      <button 
                                        type="button"
                                        onClick={() => handleUpdateQuantity(product.id, flavor, qty + 1)}
                                        disabled={isRepEditingLocked}
                                        className="w-7 h-7 flex items-center justify-center bg-bg rounded-lg text-secondary hover:text-primary font-black active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
                                        title="زيادة قطعة"
                                      >
                                        +
                                      </button>
                                    </div>
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
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: Customer Visit Selection */}
      {activeSection === 'customers' && (
        <div className="space-y-5">
          {/* Non-preferred Warning Banner */}
          {nonPreferredSelected.length > 0 && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-[1.8rem] text-amber-900 space-y-2 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                <AlertCircle size={20} className="text-amber-600 shrink-0" />
                <span>تنبيه: قمت باختيار ({nonPreferredSelected.length}) عميل في غير يوم زيارتهم المفضل ({arabicWeekday})!</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                سيظهر هذا التنبيه في الإشعار المرسل للمدير عند حفظ التشغيلة بالأسماء المحددة أدناه:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {nonPreferredSelected.map(c => {
                  const pDays = getCustomerPreferredDays(c);
                  const pLabels = pDays.map(d => WEEKDAYS.find(w => w.value === d)?.label || d).join('، ');
                  return (
                    <span key={c.id} className="bg-amber-200/80 border border-amber-400/60 text-amber-950 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs">
                      <span>{c.shopName}</span>
                      <span className="text-[10px] text-amber-900 bg-white/60 px-1.5 py-0.5 rounded-md">
                        {pLabels ? `(الأيام: ${pLabels})` : '(غير محدد)'}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Action Buttons & Search */}
          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-accent/10 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllPreferred}
                  disabled={isRepEditingLocked}
                  className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Check size={16} />
                  <span>تحديد عملاء {arabicWeekday} فقط ({preferredCustomers.length}) (الافتراضي)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllCustomers}
                  disabled={isRepEditingLocked}
                  className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Users size={16} />
                  <span>تحديد جميع العملاء ({repCustomers.length})</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAllCustomers}
                  disabled={isRepEditingLocked}
                  className="px-4 py-2 bg-bg hover:bg-accent/10 text-secondary rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  إلغاء تحديد الكل
                </button>
              </div>

              <div className="flex items-center gap-1 bg-bg p-1 rounded-xl border border-accent/10 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCustomerFilterTab('all')}
                  className={cn("px-3 py-1.5 rounded-lg transition-all", customerFilterTab === 'all' ? "bg-white text-primary shadow-xs" : "text-secondary")}
                >
                  عرض الكل ({repCustomers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerFilterTab('preferred')}
                  className={cn("px-3 py-1.5 rounded-lg transition-all", customerFilterTab === 'preferred' ? "bg-white text-emerald-800 shadow-xs" : "text-secondary")}
                >
                  عملاء {arabicWeekday} ({preferredCustomers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerFilterTab('others')}
                  className={cn("px-3 py-1.5 rounded-lg transition-all", customerFilterTab === 'others' ? "bg-white text-amber-800 shadow-xs" : "text-secondary")}
                >
                  باقي العملاء ({otherCustomers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerFilterTab('selected')}
                  className={cn("px-3 py-1.5 rounded-lg transition-all", customerFilterTab === 'selected' ? "bg-white text-primary shadow-xs" : "text-secondary")}
                >
                  المحددون ({selectedCustomerIds.length})
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
              <input 
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="بحث باسم المحل أو العميل أو المنطقة أو الهاتف عبر كل القوائم..."
                className="w-full bg-bg pr-11 pl-4 py-3 rounded-2xl border border-accent/10 text-xs font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Section 1: Today's Preferred Customers (Checked by default) */}
          {(customerFilterTab === 'all' || customerFilterTab === 'preferred' || (customerFilterTab === 'selected' && filteredTodayPreferred.some(c => selectedCustomerIds.includes(c.id)))) && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-ink text-sm flex items-center gap-2">
                      <span>عملاء يوم {arabicWeekday} المفضلون</span>
                      <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                        {preferredCustomers.length} عميل
                      </span>
                    </h4>
                    <p className="text-[11px] text-emerald-900/70 font-medium">
                      محددون افتراضياً كزيارات أساسية لليوم (انقر على أي عميل لإلغاء تحديده)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-950 bg-white/90 px-3 py-1 rounded-xl border border-emerald-200 shadow-xs">
                    تم تحديد: <strong className="text-emerald-700 font-black">{selectedTodayCount}</strong> من {preferredCustomers.length}
                  </span>
                </div>
              </div>

              {filteredTodayPreferred.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-dashed border-accent/20 text-center text-xs text-secondary/60">
                  {preferredCustomers.length === 0 
                    ? `لا يوجد عملاء مسجلين بيوم زيارة مفضل (${arabicWeekday}) لهذا الخط` 
                    : 'لا يوجد عملاء يطابقون كلمة البحث في قائمة عملاء اليوم'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(customerFilterTab === 'selected'
                    ? filteredTodayPreferred.filter(c => selectedCustomerIds.includes(c.id))
                    : filteredTodayPreferred
                  ).map(customer => {
                    const isSelected = selectedCustomerIds.includes(customer.id);
                    const pDays = getCustomerPreferredDays(customer);
                    const pLabels = formatPreferredDaysArabic(pDays);

                    return (
                      <div
                        key={customer.id}
                        onClick={() => toggleCustomer(customer.id)}
                        className={cn(
                          "p-3.5 sm:p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 text-right select-none",
                          isRepEditingLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer active:scale-[0.99]",
                          isSelected 
                            ? "bg-emerald-50/50 border-emerald-500 shadow-sm ring-1 ring-emerald-500/20"
                            : "bg-white border-dashed border-accent/25 opacity-70 hover:opacity-100 hover:border-emerald-300"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("w-2 h-2 rounded-full shrink-0", isSelected ? "bg-emerald-500" : "bg-gray-300")} />
                              <h4 className={cn("font-bold text-sm truncate", isSelected ? "text-ink" : "text-secondary")}>
                                {customer.shopName}
                              </h4>
                            </div>
                            <div className="text-xs text-secondary/70 truncate flex items-center gap-1.5 pr-4">
                              <MapPin size={12} className="shrink-0 text-primary/60" />
                              <span>{customer.area || 'بدون منطقة'}</span>
                              {customer.ownerName && <span>• {customer.ownerName}</span>}
                            </div>
                          </div>

                          <div className={cn(
                            "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border transition-all text-xs font-bold",
                            isSelected 
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" 
                              : "border-accent/20 bg-bg text-secondary/30"
                          )}>
                            {isSelected ? <Check size={16} /> : <span className="text-xs">+</span>}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-accent/5 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                          {isSelected ? (
                            <span className="font-bold px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <Check size={12} />
                              محدد للزيارة • اليوم المفضل ({arabicWeekday})
                            </span>
                          ) : (
                            <span className="font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 flex items-center gap-1">
                              <X size={12} />
                              ملغي من الزيارة (انقر لإعادة التحديد)
                            </span>
                          )}

                          {customer.phone && (
                            <span className="text-[10px] text-secondary/50 font-mono dir-ltr">
                              {customer.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Section 2: Other Customers in Route (Underneath today's customers) */}
          {(customerFilterTab === 'all' || customerFilterTab === 'others' || (customerFilterTab === 'selected' && filteredOtherCustomers.some(c => selectedCustomerIds.includes(c.id)))) && (
            <div className="space-y-3 pt-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-bg/80 p-3.5 rounded-2xl border border-accent/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-secondary text-white flex items-center justify-center font-black text-xs shadow-xs">
                    <Users size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-ink text-sm flex items-center gap-2">
                      <span>باقي عملاء خط السير</span>
                      <span className="bg-secondary/20 text-secondary text-[10px] font-black px-2 py-0.5 rounded-md">
                        {otherCustomers.length} عميل
                      </span>
                    </h4>
                    <p className="text-[11px] text-secondary/70 font-medium">
                      عملاء بأيام زيارة أخرى — انقر على أي عميل لتعليمه كزيارة إضافية اليوم
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedOthersCount > 0 ? (
                    <span className="text-xs font-bold text-amber-900 bg-amber-100 px-3 py-1 rounded-xl border border-amber-300 shadow-xs">
                      زيارات إضافية محددة: <strong className="text-amber-950 font-black">{selectedOthersCount}</strong> عميل
                    </span>
                  ) : (
                    <span className="text-xs text-secondary/60 bg-white px-2.5 py-1 rounded-xl border border-accent/10">
                      غير محددين افتراضياً
                    </span>
                  )}
                </div>
              </div>

              {filteredOtherCustomers.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-dashed border-accent/20 text-center text-xs text-secondary/60">
                  {otherCustomers.length === 0 
                    ? 'لا يوجد عملاء آخرين مسندين لهذا المندوب' 
                    : 'لا يوجد عملاء يطابقون كلمة البحث في باقي العملاء'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(customerFilterTab === 'selected'
                    ? filteredOtherCustomers.filter(c => selectedCustomerIds.includes(c.id))
                    : filteredOtherCustomers
                  ).map(customer => {
                    const isSelected = selectedCustomerIds.includes(customer.id);
                    const pDays = getCustomerPreferredDays(customer);
                    const pLabels = formatPreferredDaysArabic(pDays);

                    return (
                      <div
                        key={customer.id}
                        onClick={() => toggleCustomer(customer.id)}
                        className={cn(
                          "p-3.5 sm:p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 text-right select-none",
                          isRepEditingLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer active:scale-[0.99]",
                          isSelected 
                            ? "bg-amber-50/70 border-amber-400 shadow-sm ring-1 ring-amber-400/20"
                            : "bg-white border-accent/10 hover:border-accent/25"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("w-2 h-2 rounded-full shrink-0", isSelected ? "bg-amber-500" : "bg-gray-300")} />
                              <h4 className={cn("font-bold text-sm truncate", isSelected ? "text-ink" : "text-ink/80")}>
                                {customer.shopName}
                              </h4>
                            </div>
                            <div className="text-xs text-secondary/70 truncate flex items-center gap-1.5 pr-4">
                              <MapPin size={12} className="shrink-0 text-primary/60" />
                              <span>{customer.area || 'بدون منطقة'}</span>
                              {customer.ownerName && <span>• {customer.ownerName}</span>}
                            </div>
                          </div>

                          <div className={cn(
                            "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border transition-all text-xs font-bold",
                            isSelected 
                              ? "bg-amber-600 text-white border-amber-600 shadow-xs" 
                              : "border-accent/20 bg-bg text-secondary/30 hover:border-primary/40"
                          )}>
                            {isSelected ? <Check size={16} /> : <span className="text-xs">+</span>}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-accent/5 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                          {isSelected ? (
                            <span className="font-bold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <AlertCircle size={12} className="text-amber-600" />
                              زيارة إضافية {pLabels ? `(المفضل: ${pLabels})` : ''}
                            </span>
                          ) : (
                            <span className="font-medium px-2 py-0.5 rounded-lg bg-bg text-secondary/70 border border-accent/5 flex items-center gap-1">
                              {pLabels ? `اليوم المفضل: ${pLabels}` : 'لم يحدد يوم مفضل'}
                            </span>
                          )}

                          {customer.phone && (
                            <span className="text-[10px] text-secondary/50 font-mono dir-ltr">
                              {customer.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fixed Bottom Save Action Bar on Mobile, Sticky in-flow on Desktop */}
      <div className="fixed bottom-[4.25rem] left-3 right-3 md:relative md:bottom-0 md:left-0 md:right-0 z-40 bg-white/95 backdrop-blur-md p-2 sm:p-2.5 rounded-2xl border border-accent/15 shadow-2xl">
        {isRepEditingLocked ? (
          existingRequest?.editRequested ? (
            <div className="w-full py-3.5 md:py-4 px-4 rounded-xl md:rounded-2xl font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center gap-2.5 text-sm sm:text-base">
              <Clock size={20} className="animate-spin text-amber-700 shrink-0" />
              <span>تم إرسال طلب التعديل للإدارة - بانتظار موافقة المدير لفتح التعديل</span>
            </div>
          ) : (
            <button 
              type="button"
              onClick={handleRequestEdit}
              className="w-full py-3.5 md:py-4 px-4 rounded-xl md:rounded-2xl font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2.5 text-sm sm:text-base cursor-pointer active:scale-98"
            >
              <Edit3 size={20} className="shrink-0" />
              <span>طلب فتح التعديل من المدير (تم اعتماد التشغيلة)</span>
            </button>
          )
        ) : (
          <button 
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "w-full py-3.5 md:py-4 px-4 rounded-xl md:rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-2.5 disabled:opacity-50 text-white cursor-pointer active:scale-98",
              existingRequest 
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                : nonPreferredSelected.length > 0 
                  ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                  : "bg-primary hover:bg-secondary shadow-primary/20"
            )}
          >
            <Save size={20} className="shrink-0" />
            <span className="text-sm sm:text-base md:text-lg font-bold">
              {saving 
                ? 'جاري حفظ التشغيلة...' 
                : existingRequest
                  ? `حفظ التعديلات (${totalQuantity} قطعة • ${selectedCustomerIds.length} عميل)`
                  : `حفظ طلب التشغيلة (${totalQuantity} قطعة • ${selectedCustomerIds.length} عميل)`}
            </span>
            {nonPreferredSelected.length > 0 && !saving && (
              <span className="bg-white/20 text-white text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-sans font-black shrink-0">
                ⚠️ {nonPreferredSelected.length} غير مفضل
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function CustomersTab({ customers, profile, showToast, searchQuery, setSearchQuery, masterRoutes = [] }: { customers: Customer[], profile: UserProfile | null, showToast: (m: string, t?: 'success' | 'error') => void, searchQuery?: string, setSearchQuery?: (q: string) => void, masterRoutes?: MasterRoute[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [representatives, setRepresentatives] = useState<UserProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const finalSearchQuery = searchQuery !== undefined ? searchQuery : localSearchQuery;
  const setFinalSearchQuery = setSearchQuery !== undefined ? setSearchQuery : setLocalSearchQuery;

  const [selectedRepIdFilter, setSelectedRepIdFilter] = useState('');
  const [selectedRouteIdFilter, setSelectedRouteIdFilter] = useState('');
  const isRep = profile?.role === 'representative' || profile?.role === 'backup_representative';

  const filteredCustomersList = useMemo(() => {
    return [...customers].filter(c => {
      const matchesSearch = 
        !finalSearchQuery ||
        (c.shopName || '').toLowerCase().includes(finalSearchQuery.toLowerCase()) ||
        (c.ownerName || '').toLowerCase().includes(finalSearchQuery.toLowerCase()) ||
        (c.area || '').toLowerCase().includes(finalSearchQuery.toLowerCase()) ||
        (c.phone || '').includes(finalSearchQuery);
        
      const matchesRep = !selectedRepIdFilter || c.representativeId === selectedRepIdFilter || (c as any).representativeid === selectedRepIdFilter;
      const matchesRoute = !selectedRouteIdFilter || c.routeId === selectedRouteIdFilter || (c as any).routeid === selectedRouteIdFilter || c.routeName === selectedRouteIdFilter;
      
      let matchesUserRep = true;
      if (isRep && profile) {
        const userRouteId = profile.routeId || (profile as any).routeid;
        const userRouteName = profile.routeName || (profile as any).routename;
        const custRouteId = c.routeId || (c as any).routeid;
        const custRouteName = c.routeName || (c as any).routename;

        const isDirectCustomer = Boolean(
          (c.representativeId && profile.uid && String(c.representativeId) === String(profile.uid)) ||
          (c.representativeId && (profile as any).id && String(c.representativeId) === String((profile as any).id)) ||
          (c.representativeName && profile.name && c.representativeName.trim() === profile.name.trim())
        );

        const matchesRouteOfRep = Boolean(
          (userRouteId && custRouteId && String(userRouteId) === String(custRouteId)) ||
          (userRouteName && custRouteName && String(userRouteName).trim() === String(custRouteName).trim())
        );

        const repHasRoute = Boolean(userRouteId || userRouteName);

        if (isDirectCustomer) {
          matchesUserRep = true;
        } else if (repHasRoute) {
          matchesUserRep = matchesRouteOfRep;
        } else {
          matchesUserRep = true;
        }
      }

      return matchesSearch && matchesRep && matchesRoute && matchesUserRep;
    });
  }, [customers, finalSearchQuery, selectedRepIdFilter, selectedRouteIdFilter, isRep, profile]);

  const [formData, setFormData] = useState<Omit<Customer, 'id'>>({
    shopName: '',
    ownerName: '',
    area: '',
    phone: '',
    openingBalance: 0,
    location: undefined,
    representativeId: '',
    representativeName: '',
    status: 'active',
    preferredDays: [],
    routeId: '',
    routeName: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => {
    const unsub = dataService.getUsers((data) => {
      const reps = (data as UserProfile[])
        .filter(u => u.role === 'representative' || u.role === 'backup_representative');
      setRepresentatives(reps);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isAdding && !editingId && (profile?.role === 'representative' || profile?.role === 'backup_representative')) {
      setFormData(prev => ({
        ...prev,
        representativeId: profile.uid,
        representativeName: profile.name,
        routeId: profile.routeId || (profile as any)?.routeid || prev.routeId || '',
        routeName: profile.routeName || (profile as any)?.routename || prev.routeName || ''
      }));
    }
  }, [isAdding, editingId, profile]);

  const getLocation = () => {
    if (!navigator.geolocation) {
      showToast('متصفحك لا يدعم تحديد الموقع', 'error');
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGettingLocation(false);
        setFormData(prev => ({
          ...prev,
          location: { lat: pos.coords.latitude, lng: pos.coords.longitude }
        }));
        showToast('تم تحديد اللوكيشن بنجاح ✓');
      },
      (err) => {
        setGettingLocation(false);
        let msg = 'فشل في تحديد اللوكيشن. تأكد من تفعيل الـ GPS والسماح للمتصفح بالوصول للموقع.';
        if (err.code === 1) {
          msg = 'تم رفض إذن الوصول للموقع، يرجى تفعيله في المتصفح.';
        }
        showToast(msg, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSave = async () => {
    setAttemptedSubmit(true);
    const errors: Record<string, string> = {};

    const trimmedShopName = (formData.shopName || '').trim();
    const trimmedOwnerName = (formData.ownerName || '').trim();
    const trimmedPhone = (formData.phone || '').trim();
    const trimmedArea = (formData.area || '').trim();

    if (!trimmedShopName) {
      errors.shopName = 'اسم المحل مطلوب';
    }
    if (!trimmedOwnerName) {
      errors.ownerName = 'اسم المالك مطلوب';
    }
    if (!trimmedArea) {
      errors.area = 'المنطقة أو الحي مطلوبة';
    }
    if (!trimmedPhone) {
      errors.phone = 'رقم الهاتف مطلوب';
    } else {
      const cleanPhone = trimmedPhone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        errors.phone = 'يرجى إدخال رقم هاتف صحيح مكون من 11 رقم';
      }
    }

    const currentRepId = formData.representativeId || (isRep && profile ? profile.uid : '');
    if (!currentRepId) {
      errors.representativeId = 'يرجى تحديد المندوب المسؤول عن هذا العميل';
    }

    // Required: Visit Days (أيام الزيارة)
    if (!formData.preferredDays || formData.preferredDays.length === 0) {
      errors.preferredDays = 'يجب اختيار يوم واحد على الأقل من أيام الزيارة';
    }

    setFormErrors(errors);

    const missingFields: string[] = [];
    if (errors.shopName) missingFields.push('اسم المحل');
    if (errors.ownerName) missingFields.push('اسم المالك');
    if (errors.phone) missingFields.push('رقم الهاتف');
    if (errors.area) missingFields.push('المنطقة');
    if (errors.representativeId) missingFields.push('المندوب المسؤول');
    if (errors.preferredDays) missingFields.push('أيام الزيارة');

    if (missingFields.length > 0) {
      showToast(`ادخل البيانات كاملة: يرجى استكمال (${missingFields.join('، ')})`, 'error');
      return;
    }

    // Role check for editing: Only manager can edit
    if (editingId && profile?.role !== 'manager') {
      showToast('عذراً، تعديل بيانات العملاء متاح للمدير فقط', 'error');
      return;
    }

    setSaving(true);
    console.log('Saving customer:', trimmedShopName);
    try {
      if (editingId) {
        if (profile?.role !== 'manager') {
          showToast('عذراً، تعديل بيانات العملاء متاح للمدير فقط', 'error');
          return;
        }
        await dataService.updateCustomer(editingId, {
          ...formData,
          shopName: trimmedShopName,
          ownerName: trimmedOwnerName,
          phone: trimmedPhone,
          area: trimmedArea
        });
        showToast('تم تحديث بيانات العميل بنجاح');
      } else {
        // Adding new customer with strictly validated complete data
        let finalFormData = { 
          ...formData,
          shopName: trimmedShopName,
          ownerName: trimmedOwnerName,
          phone: trimmedPhone,
          area: trimmedArea,
          representativeId: currentRepId,
          representativeName: formData.representativeName || (isRep && profile ? profile.name : '')
        };
        if (isRep && profile) {
          finalFormData.representativeId = profile.uid;
          finalFormData.representativeName = profile.name;
          finalFormData.routeId = profile.routeId || (profile as any).routeid || formData.routeId || '';
          finalFormData.routeName = profile.routeName || (profile as any).routename || formData.routeName || '';
        }

        await dataService.addCustomer(finalFormData);
        
        // Create notification for manager
        if (profile) {
          try {
            await dataService.createNotification(
              'عميل جديد',
              `قام المندوب ${profile.name} بإضافة عميل جديد: ${trimmedShopName}`,
              'customer',
              profile.uid,
              profile.name,
              'customers'
            );
          } catch(e) {
            console.error('Notification failed but customer saved', e);
          }
        }

        showToast('تم إضافة العميل بنجاح');
      }
      setFormData({ 
        shopName: '', 
        ownerName: '', 
        area: '', 
        phone: '', 
        openingBalance: 0, 
        location: undefined,
        representativeId: '',
        representativeName: '',
        status: 'active',
        preferredDays: [],
        routeId: '',
        routeName: ''
      });
      setFormErrors({});
      setAttemptedSubmit(false);
      setIsAdding(false);
      setEditingId(null);
    } catch (err: any) {
      console.error('Error saving customer:', err);
      showToast(`حدث خطأ أثناء حفظ بيانات العميل: ${err.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExportToExcel = () => {
    if (profile?.role !== 'manager') return;
    try {
      const data = customers.map(c => ({
        'اسم المحل': c.shopName,
        'اسم المالك': c.ownerName,
        'المنطقة': c.area,
        'الهاتف': c.phone,
        'الرصيد': c.openingBalance,
        'المندوب المسؤول': c.representativeName,
        'الحالة': c.status === 'active' ? 'نشط' : 'موقوف',
        'الموقع (Lat)': c.location?.lat || '',
        'الموقع (Lng)': c.location?.lng || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
      XLSX.writeFile(workbook, "customers_list.xlsx");
      showToast('تم تصدير بيانات العملاء بنجاح');
    } catch (error) {
      console.error('Export error:', error);
      showToast('خطأ في تصدير البيانات', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-ink">العملاء</h2>
        <div className="flex gap-2">
          {profile?.role === 'manager' && (
            <button 
              onClick={handleExportToExcel}
              className="flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 active:scale-95"
            >
              <Download size={20} />
              <span className="hidden md:inline">تصدير إكسيل</span>
            </button>
          )}
          <button 
            onClick={() => {
              setEditingId(null);
              setFormErrors({});
              setAttemptedSubmit(false);
              setFormData({ 
                shopName: '', 
                ownerName: '', 
                area: '', 
                phone: '', 
                openingBalance: 0, 
                location: undefined,
                representativeId: profile?.uid || '',
                representativeName: profile?.name || '',
                status: 'active',
                preferredDays: [],
                routeId: profile?.routeId || (profile as any)?.routeid || '',
                routeName: profile?.routeName || (profile as any)?.routename || ''
              });
              setIsAdding(true);
            }}
            className="flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-primary text-white rounded-2xl font-bold hover:bg-secondary transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            <Plus size={20} />
            <span className="text-sm md:text-base">إضافة عميل</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-2"
          >
            <div className="bg-white p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-xl border-2 border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Header inside Form */}
              <div className="col-span-1 md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-blue-100 gap-2">
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-ink flex items-center gap-2">
                    {editingId ? (
                      <>
                        <Edit3 size={20} className="text-primary" />
                        <span>تعديل بيانات العميل: {formData.shopName || ''}</span>
                      </>
                    ) : (
                      <>
                        <Plus size={20} className="text-primary" />
                        <span>إضافة عميل جديد</span>
                      </>
                    )}
                  </h3>
                  <p className="text-xs text-secondary/70 mt-1">
                    {editingId ? 'تعديل بيانات العميل (خاص بالإدارة)' : 'يرجى إدخال البيانات كاملة: اسم المحل، المالك، الهاتف، المنطقة، وأيام الزيارة'}
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => { setIsAdding(false); setEditingId(null); setFormErrors({}); setAttemptedSubmit(false); }}
                  className="self-end sm:self-auto p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {attemptedSubmit && Object.keys(formErrors).length > 0 && (
                <div className="col-span-1 md:col-span-2 bg-red-50 border-2 border-red-200 text-red-700 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs md:text-sm font-bold shadow-xs">
                  <AlertCircle size={20} className="text-red-600 shrink-0" />
                  <span>ادخل البيانات كاملة: يرجى استكمال كافة الحقول المحددة باللون الأحمر لإتمام حفظ العميل.</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest flex items-center gap-1">
                      <span>اسم المحل</span>
                      <span className="text-red-500 font-bold">*</span>
                    </label>
                  </div>
                  <input 
                    type="text" 
                    value={formData.shopName || ''} 
                    onChange={e => {
                      setFormData({...formData, shopName: e.target.value});
                      if (formErrors.shopName) setFormErrors(prev => ({ ...prev, shopName: '' }));
                    }} 
                    disabled={profile?.role !== 'manager' && !!editingId}
                    className={cn(
                      "input-field",
                      attemptedSubmit && formErrors.shopName && "border-red-500 ring-2 ring-red-100 bg-red-50/20",
                      profile?.role !== 'manager' && !!editingId && "bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200"
                    )} 
                    placeholder="اسم النشاط التجاري (مطلوب)" 
                  />
                  {attemptedSubmit && formErrors.shopName && (
                    <p className="text-[11px] text-red-600 font-bold mt-1 px-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {formErrors.shopName}
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest flex items-center gap-1">
                      <span>اسم المالك</span>
                      <span className="text-red-500 font-bold">*</span>
                    </label>
                  </div>
                  <input 
                    type="text" 
                    value={formData.ownerName || ''} 
                    onChange={e => {
                      setFormData({...formData, ownerName: e.target.value});
                      if (formErrors.ownerName) setFormErrors(prev => ({ ...prev, ownerName: '' }));
                    }} 
                    disabled={profile?.role !== 'manager' && !!editingId}
                    className={cn(
                      "input-field",
                      attemptedSubmit && formErrors.ownerName && "border-red-500 ring-2 ring-red-100 bg-red-50/20",
                      profile?.role !== 'manager' && !!editingId && "bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200"
                    )} 
                    placeholder="الاسم الكامل (مطلوب)" 
                  />
                  {attemptedSubmit && formErrors.ownerName && (
                    <p className="text-[11px] text-red-600 font-bold mt-1 px-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {formErrors.ownerName}
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest flex items-center gap-1">
                      <span>المنطقة</span>
                      <span className="text-red-500 font-bold">*</span>
                    </label>
                  </div>
                  <input 
                    type="text" 
                    value={formData.area || ''} 
                    onChange={e => {
                      setFormData({...formData, area: e.target.value});
                      if (formErrors.area) setFormErrors(prev => ({ ...prev, area: '' }));
                    }} 
                    disabled={profile?.role !== 'manager' && !!editingId}
                    className={cn(
                      "input-field",
                      attemptedSubmit && formErrors.area && "border-red-500 ring-2 ring-red-100 bg-red-50/20",
                      profile?.role !== 'manager' && !!editingId && "bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200"
                    )} 
                    placeholder="الحي أو المدينة (مطلوب)" 
                  />
                  {attemptedSubmit && formErrors.area && (
                    <p className="text-[11px] text-red-600 font-bold mt-1 px-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {formErrors.area}
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">حالة العميل</label>
                  </div>
                  <select 
                    value={formData.status || 'active'} 
                    onChange={e => setFormData({...formData, status: e.target.value as 'active' | 'suspended'})} 
                    disabled={profile?.role !== 'manager' && !!editingId}
                    className={cn("input-field appearance-none", profile?.role !== 'manager' && !!editingId && "bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200")}
                  >
                    <option value="active">نشط (يتم التعامل معه)</option>
                    <option value="suspended">موقوف مؤقتاً (لا تظهر للمندوب)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">المندوب المسؤول</label>
                  {profile?.role === 'representative' || profile?.role === 'backup_representative' ? (
                    <div className="input-field bg-gray-50 text-secondary/60 flex items-center cursor-not-allowed">
                      {formData.representativeName || profile.name}
                    </div>
                  ) : (
                    <select 
                      value={formData.representativeId || ''} 
                      onChange={e => {
                        const rep = representatives.find(r => r.uid === e.target.value);
                        const repRoute = masterRoutes.find(r => r.id === rep?.routeId || r.name === rep?.routeName);
                        setFormData({
                          ...formData, 
                          representativeId: e.target.value,
                          representativeName: rep?.name || '',
                          routeId: formData.routeId || rep?.routeId || repRoute?.id || '',
                          routeName: formData.routeName || rep?.routeName || repRoute?.name || ''
                        });
                        if (formErrors.representativeId) setFormErrors(prev => ({ ...prev, representativeId: '' }));
                      }} 
                      className={cn("input-field appearance-none", attemptedSubmit && formErrors.representativeId && "border-red-500 ring-2 ring-red-100")}
                    >
                      <option value="">اختر المندوب...</option>
                      {representatives.map(rep => (
                        <option key={rep.uid} value={rep.uid}>{rep.name}</option>
                      ))}
                    </select>
                  )}
                  {attemptedSubmit && formErrors.representativeId && (
                    <p className="text-[11px] text-red-600 font-bold mt-1 px-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {formErrors.representativeId}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">خط السير</label>
                  {isRep ? (
                    <div className="input-field bg-gray-50 text-secondary flex items-center justify-between font-bold cursor-not-allowed border border-gray-200">
                      <span>{profile?.routeName || (formData.routeName ? formData.routeName : 'خط السير الخاص بك')}</span>
                      <span className="text-[10px] text-primary font-extrabold bg-primary/10 px-2.5 py-1 rounded-lg">إجباري خط سير المندوب</span>
                    </div>
                  ) : (
                    <select
                      value={formData.routeId || ''}
                      onChange={e => {
                        const selectedRoute = masterRoutes.find(r => r.id === e.target.value);
                        setFormData({
                          ...formData,
                          routeId: e.target.value,
                          routeName: selectedRoute?.name || ''
                        });
                      }}
                      className="input-field appearance-none"
                    >
                      <option value="">اختر خط السير...</option>
                      {masterRoutes.map(route => (
                        <option key={route.id} value={route.id}>{route.name} {route.code ? `(${route.code})` : ''}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest flex items-center gap-1">
                      <span>الهاتف</span>
                      <span className="text-red-500 font-bold">*</span>
                    </label>
                  </div>
                  <input 
                    type="tel" 
                    value={formData.phone || ''} 
                    onChange={e => {
                      setFormData({...formData, phone: e.target.value});
                      if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: '' }));
                    }} 
                    disabled={profile?.role !== 'manager' && !!editingId}
                    className={cn(
                      "input-field",
                      attemptedSubmit && formErrors.phone && "border-red-500 ring-2 ring-red-100 bg-red-50/20",
                      profile?.role !== 'manager' && !!editingId && "bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200"
                    )} 
                    placeholder="01xxxxxxxxx (مطلوب 11 رقم)" 
                  />
                  {attemptedSubmit && formErrors.phone && (
                    <p className="text-[11px] text-red-600 font-bold mt-1 px-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {formErrors.phone}
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">الرصيد</label>
                  </div>
                  <input 
                    type="number" 
                    value={formData.openingBalance || ''} 
                    onChange={e => setFormData({...formData, openingBalance: parseFloat(e.target.value) || 0})} 
                    disabled={profile?.role !== 'manager' && !!editingId}
                    className={cn("input-field", profile?.role !== 'manager' && !!editingId && "bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200")} 
                    placeholder="0.00" 
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest font-serif flex items-center gap-1">
                      <span>الأيام المفضلة للزيارة</span>
                      <span className="text-red-500 font-bold">*</span>
                    </label>
                    <span className="text-[10px] text-primary font-bold">حدد يوم واحد على الأقل</span>
                  </div>
                  <div className={cn(
                    "grid grid-cols-4 gap-1.5 bg-blue-50/50 p-2.5 rounded-xl border transition-all",
                    attemptedSubmit && formErrors.preferredDays 
                      ? "border-red-500 ring-2 ring-red-100 bg-red-50/20" 
                      : "border-blue-100"
                  )}>
                    {WEEKDAYS.map(day => {
                      const isSelected = (formData.preferredDays || []).includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          disabled={profile?.role !== 'manager' && !!editingId}
                          onClick={() => {
                            if (profile?.role !== 'manager' && editingId) return;
                            const current = formData.preferredDays || [];
                            const updated = current.includes(day.value)
                              ? current.filter(d => d !== day.value)
                              : [...current, day.value];
                            setFormData({ ...formData, preferredDays: updated });
                            if (formErrors.preferredDays) setFormErrors(prev => ({ ...prev, preferredDays: '' }));
                          }}
                          className={cn(
                            "py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all text-center border",
                            isSelected 
                              ? "bg-primary text-white border-primary shadow-sm" 
                              : "bg-white text-secondary/70 border-gray-200 hover:border-primary/20",
                            profile?.role !== 'manager' && !!editingId && "cursor-not-allowed opacity-80"
                          )}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                  {attemptedSubmit && formErrors.preferredDays && (
                    <p className="text-[11px] text-red-600 font-bold mt-1 px-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {formErrors.preferredDays}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1 px-1">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest font-serif">
                      الموقع الجغرافي (اللوكيشن)
                    </label>
                  </div>
                  {formData.location ? (
                    <div className="flex items-center justify-between bg-emerald-50 border-2 border-emerald-300 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-emerald-600 shrink-0" />
                        <span>تم تحديد اللوكيشن بنجاح ✓</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-700 bg-white/90 px-2 py-0.5 rounded-lg border border-emerald-200">
                        {Number(formData.location.lat).toFixed(4)}, {Number(formData.location.lng).toFixed(4)}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 border bg-amber-50 border-amber-200 text-amber-700">
                      <MapPin size={16} className="text-amber-500 shrink-0" />
                      <span>لم يتم تحديد الموقع بعد</span>
                    </div>
                  )}

                  {/* GPS Button */}
                  <div className="pt-1">
                    <button 
                      type="button"
                      onClick={getLocation} 
                      disabled={saving || gettingLocation} 
                      className={cn(
                        "w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 border transition-all text-xs md:text-sm shadow-xs",
                        formData.location 
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-300"
                          : "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                      )}
                    >
                      {gettingLocation ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-current"></div>
                      ) : (
                        <MapPin size={18} className={formData.location ? "text-emerald-600" : "text-blue-600"} />
                      )}
                      <span>
                        {gettingLocation 
                          ? 'جاري تحديد اللوكيشن عبر الـ GPS...' 
                          : formData.location 
                          ? 'تحديث اللوكيشن الحالي (GPS)' 
                          : 'تحديد اللوكيشن الحالي (GPS)'}
                      </span>
                    </button>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={handleSave} disabled={saving || gettingLocation} className="flex-[3] btn-primary disabled:opacity-50 flex items-center justify-center gap-2 text-xs md:text-sm py-3.5">
                      {saving && <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>}
                      {editingId ? 'حفظ التعديلات' : 'حفظ العميل (إتمام الإضافة)'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setIsAdding(false); setEditingId(null); setFormErrors({}); setAttemptedSubmit(false); }} 
                      disabled={saving} 
                      className="px-4 py-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl font-bold active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search and Filter Inputs */}
      <div className={`grid gap-4 px-2 mb-2 grid-cols-1 ${isRep ? 'md:grid-cols-1' : 'md:grid-cols-3'}`}>
        <div className="relative">
          <input
            type="text"
            value={finalSearchQuery}
            onChange={(e) => setFinalSearchQuery(e.target.value)}
            placeholder="ابحث باسم المحل، المالك، المنطقة أو الهاتف..."
            className="w-full bg-white border-2 border-primary/10 rounded-2xl px-4 py-3 pr-11 focus:outline-none focus:border-primary/30 transition-all text-ink font-bold text-sm shadow-sm"
          />
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40" />
          {finalSearchQuery && (
            <button
              onClick={() => setFinalSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {!isRep && (
          <div>
            <select
              value={selectedRepIdFilter}
              onChange={(e) => setSelectedRepIdFilter(e.target.value)}
              className="w-full bg-white border-2 border-primary/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-primary/30 transition-all text-ink font-bold text-sm shadow-sm appearance-none cursor-pointer"
            >
              <option value="">كل المناديب 👥</option>
              {representatives.map(rep => (
                <option key={rep.uid} value={rep.uid}>{rep.name}</option>
              ))}
            </select>
          </div>
        )}
        {!isRep && (
          <div>
            <select
              value={selectedRouteIdFilter}
              onChange={(e) => setSelectedRouteIdFilter(e.target.value)}
              className="w-full bg-white border-2 border-primary/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-primary/30 transition-all text-ink font-bold text-sm shadow-sm appearance-none cursor-pointer"
            >
              <option value="">كل خطوط السير 🛣️</option>
              {masterRoutes.map(route => (
                <option key={route.id} value={route.id}>{route.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 px-2">
        {[...filteredCustomersList].sort((a, b) => (parseFloat(b.openingBalance as any) || 0) - (parseFloat(a.openingBalance as any) || 0)).map(c => (
          <div key={c.id} className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border-2 border-blue-50 hover:border-blue-200 hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-xl font-serif font-bold text-ink">{c.shopName || (c as any).name}</h3>
                <p className="text-sm text-secondary/60">{c.ownerName || (c as any).ownername}</p>
                {c.status === 'suspended' && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full">موقوف مؤقتاً</span>
                )}
              </div>
              <div className="p-3 bg-bg rounded-2xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <Users size={20} />
              </div>
            </div>

            {(c.routeName || (c as any).routename) && (
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50/80 px-2.5 py-1 rounded-xl mb-3 border border-blue-100">
                <Navigation size={12} className="text-blue-600" />
                <span>خط السير: {c.routeName || (c as any).routename}</span>
              </div>
            )}

            <div className="space-y-3 text-sm mb-6">
              <div className="flex items-center gap-3 text-secondary/70">
                <MapIcon size={16} className="text-primary/40" />
                <span>{c.area}</span>
              </div>
              <div className="flex items-center gap-3 text-secondary/70">
                <UserIcon size={16} className="text-primary/40" />
                <span>المندوب: {c.representativeName}</span>
              </div>
              <div className="flex items-center gap-3 text-secondary/70">
                <Phone size={16} className="text-primary/40" />
                <span>{c.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-secondary/70">
                <ArrowUpDown size={16} className="text-primary/40" />
                <span>الرصيد: <span className="font-bold text-primary">{c.openingBalance.toLocaleString()} ج.م</span></span>
              </div>
              <div className="flex items-center gap-3 text-secondary/70">
                <Calendar size={16} className="text-primary/40" />
                <span>أيام الزيارة: <span className="font-bold text-secondary">
                  {c.preferredDays && c.preferredDays.length > 0 
                    ? c.preferredDays.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(' - ') 
                    : 'غير محدد'}
                </span></span>
              </div>
            </div>
            <div className="flex gap-2 pt-4 border-t border-bg">
              {profile?.role === 'manager' && (
                <button 
                  onClick={() => {
                    setEditingId(c.id);
                    setFormErrors({});
                    setAttemptedSubmit(false);
                    // Ensure we map raw Supabase fields to the form fields correctly
                    setFormData({
                      ...c,
                      shopName: c.shopName || (c as any).shopname || (c as any).name || '',
                      ownerName: c.ownerName || (c as any).ownername || '',
                      area: c.area || (c as any).area || '',
                      phone: c.phone || (c as any).phone || '',
                      location: c.location || (c as any).location || undefined,
                      representativeId: c.representativeId || (c as any).representativeid || '',
                      representativeName: c.representativeName || (c as any).representativename || '',
                      routeId: c.routeId || (c as any).routeid || '',
                      routeName: c.routeName || (c as any).routename || '',
                      openingBalance: c.openingBalance !== undefined ? c.openingBalance : ((c as any).openingbalance || 0),
                      preferredDays: c.preferredDays || (c as any).preferreddays || [],
                      status: c.status || 'active'
                    });
                    setIsAdding(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex-1 py-2.5 bg-bg text-secondary rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Edit3 size={15} />
                  <span>تعديل البيانات</span>
                </button>
              )}
              {c.location && (
                <a 
                  href={`https://www.google.com/maps?q=${c.location.lat},${c.location.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "bg-bg text-primary rounded-xl hover:bg-primary hover:text-white transition-all active:scale-95 flex items-center justify-center gap-1.5 font-bold text-xs",
                    profile?.role === 'manager' ? "p-2.5" : "flex-1 py-2.5"
                  )}
                  title="عرض الموقع على الخريطة"
                >
                  <MapPin size={18} />
                  {profile?.role !== 'manager' && <span>الموقع على الخريطة</span>}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type NotificationPartition = 'all' | 'invoices' | 'customers' | 'settlement' | 'loans' | 'loading' | 'system';

interface PartitionConfig {
  id: NotificationPartition;
  label: string;
  icon: any;
  activeColor: string;
  badgeBg: string;
}

const NOTIFICATION_PARTITIONS: PartitionConfig[] = [
  { id: 'all', label: 'الكل', icon: Bell, activeColor: 'bg-slate-900 text-white shadow-slate-900/20', badgeBg: 'bg-slate-200 text-slate-800' },
  { id: 'invoices', label: 'الفواتير والمبيعات', icon: FileText, activeColor: 'bg-emerald-600 text-white shadow-emerald-600/20', badgeBg: 'bg-emerald-100 text-emerald-800' },
  { id: 'customers', label: 'العملاء والزيارات', icon: Users, activeColor: 'bg-blue-600 text-white shadow-blue-600/20', badgeBg: 'bg-blue-100 text-blue-800' },
  { id: 'settlement', label: 'تقفيل اليوميات', icon: Calculator, activeColor: 'bg-amber-600 text-white shadow-amber-600/20', badgeBg: 'bg-amber-100 text-amber-800' },
  { id: 'loans', label: 'السلف والرواتب', icon: CreditCard, activeColor: 'bg-rose-600 text-white shadow-rose-600/20', badgeBg: 'bg-rose-100 text-rose-800' },
  { id: 'loading', label: 'التشغيلة والتحميل', icon: Truck, activeColor: 'bg-indigo-600 text-white shadow-indigo-600/20', badgeBg: 'bg-indigo-100 text-indigo-800' },
  { id: 'system', label: 'النظام والحضور', icon: Clock, activeColor: 'bg-purple-600 text-white shadow-purple-600/20', badgeBg: 'bg-purple-100 text-purple-800' },
];

function getNotificationCategory(notif: Notification): NotificationPartition {
  const title = (notif.title || '').toLowerCase();
  const msg = (notif.message || '').toLowerCase();
  const target = notif.targetTab || '';

  // 1. Loading Requests / التشغيلة والتحميل
  if (
    title.includes('تشغيل') || 
    msg.includes('تشغيل') || 
    target === 'loading_request' || 
    target === 'admin_loading_requests'
  ) {
    return 'loading';
  }

  // 2. Loans & Salaries / السلف والرواتب
  if (
    notif.type === 'loan' || 
    title.includes('سلف') || 
    title.includes('راتب') || 
    msg.includes('سلفة') || 
    msg.includes('راتب') || 
    target === 'admin_loans'
  ) {
    return 'loans';
  }

  // 3. Daily Settlement / تقفيل اليوميات
  if (
    notif.type === 'settlement' || 
    title.includes('تقفيل') || 
    title.includes('عجز') || 
    msg.includes('تقفيل يوميتك') || 
    msg.includes('إغلاق يومية') || 
    target === 'settlement'
  ) {
    return 'settlement';
  }

  // 4. Invoices & Sales / الفواتير والمبيعات (جديدة، تعديل، إنجاز)
  if (
    notif.type === 'invoice' || 
    title.includes('فاتورة') || 
    title.includes('تعديل فاتورة') || 
    title.includes('مبيعات') || 
    title.includes('إنجاز') || 
    target === 'history' || 
    target === 'invoice'
  ) {
    return 'invoices';
  }

  // 5. Customers & Visits / العملاء والزيارات (إضافة عميل جديد، زيارة يوم غير مفضل)
  if (
    notif.type === 'customer' || 
    title.includes('عميل') || 
    title.includes('زيارة') || 
    target === 'customers'
  ) {
    return 'customers';
  }

  // 6. Attendance & System / النظام والحضور
  return 'system';
}

function getNotificationSubBadge(notif: Notification): { label: string; bg: string; text: string } {
  const title = (notif.title || '').toLowerCase();

  if (title.includes('تعديل فاتورة')) {
    return { label: 'تعديل فاتورة ✏️', bg: 'bg-amber-100', text: 'text-amber-800' };
  }
  if (title.includes('فاتورة جديدة')) {
    return { label: 'فاتورة جديدة 📑', bg: 'bg-emerald-100', text: 'text-emerald-800' };
  }
  if (title.includes('عميل جديد')) {
    return { label: 'عميل جديد 🆕', bg: 'bg-blue-100', text: 'text-blue-800' };
  }
  if (title.includes('غير مفضل') || title.includes('غير يومهم')) {
    return { label: 'تنبيه خط سير ⚠️', bg: 'bg-orange-100', text: 'text-orange-800' };
  }
  if (title.includes('تقفيل')) {
    return { label: 'تقفيل يومية ⚖️', bg: 'bg-amber-100', text: 'text-amber-800' };
  }
  if (title.includes('سلفة')) {
    return { label: 'سلفة 💳', bg: 'bg-rose-100', text: 'text-rose-800' };
  }
  if (title.includes('راتب')) {
    return { label: 'صرف راتب 💰', bg: 'bg-emerald-100', text: 'text-emerald-800' };
  }
  if (title.includes('تشغيل')) {
    return { label: 'تشغيلة 🚚', bg: 'bg-indigo-100', text: 'text-indigo-800' };
  }
  if (title.includes('حضور')) {
    return { label: 'تسجيل حضور ⏰', bg: 'bg-purple-100', text: 'text-purple-800' };
  }
  if (title.includes('إنجاز')) {
    return { label: 'إنجاز مبيعات 🏆', bg: 'bg-yellow-100', text: 'text-yellow-800' };
  }

  return { label: 'تنبيه نظام 🔔', bg: 'bg-slate-100', text: 'text-slate-800' };
}

function NotificationsTab({ 
  notifications, 
  showToast, 
  setActiveTab, 
  setIsSidebarOpen,
  customers = [],
  invoices = [],
  setCustomerSearchQuery,
  setInvoiceSearchQuery
}: { 
  notifications: Notification[], 
  showToast: (m: string, t?: 'success' | 'error') => void,
  setActiveTab: (tab: any) => void,
  setIsSidebarOpen: (open: boolean) => void,
  customers?: Customer[],
  invoices?: Invoice[],
  setCustomerSearchQuery?: (q: string) => void,
  setInvoiceSearchQuery?: (q: string) => void
}) {
  const [activePartition, setActivePartition] = useState<NotificationPartition>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Partition counts
  const partitionCounts = useMemo(() => {
    const counts: Record<NotificationPartition, { total: number; unread: number }> = {
      all: { total: notifications.length, unread: notifications.filter(n => !n.isRead).length },
      invoices: { total: 0, unread: 0 },
      customers: { total: 0, unread: 0 },
      settlement: { total: 0, unread: 0 },
      loans: { total: 0, unread: 0 },
      loading: { total: 0, unread: 0 },
      system: { total: 0, unread: 0 }
    };

    notifications.forEach(n => {
      const cat = getNotificationCategory(n);
      if (counts[cat]) {
        counts[cat].total++;
        if (!n.isRead) counts[cat].unread++;
      }
    });

    return counts;
  }, [notifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      const cat = getNotificationCategory(n);
      if (activePartition !== 'all' && cat !== activePartition) {
        return false;
      }
      if (unreadOnly && n.isRead) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = (n.title || '').toLowerCase().includes(q);
        const inMsg = (n.message || '').toLowerCase().includes(q);
        const inSender = (n.senderName || '').toLowerCase().includes(q);
        const inDate = (n.date || '').includes(q);
        if (!inTitle && !inMsg && !inSender && !inDate) return false;
      }
      return true;
    });
  }, [notifications, activePartition, unreadOnly, searchQuery]);

  const markAsRead = async (id: string) => {
    try {
      await dataService.updateNotification(id, { isRead: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      showToast('خطأ في تحديث الإشعار', 'error');
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (notif.id && !notif.isRead) {
      await markAsRead(notif.id);
    }
    
    let target = notif.targetTab;
    if (!target) {
      // Fallback for old notifications
      if (notif.type === 'invoice' || notif.type === 'settlement') target = 'history';
      else if (notif.type === 'customer') target = 'customers';
      else if (notif.type === 'loan') target = 'admin_loans';
    }

    // Attempt to extract customer name mentioned in the message
    const matchingCust = customers.find(c => (notif.message || '').includes(c.shopName));

    if (target === 'loading_request' || target === 'admin_loading_requests') {
      showToast('قسم التشغيلة والطلبات معطل مؤقتاً حالياً', 'error');
      return;
    }

    if (target) {
      if (target === 'customers' && matchingCust && setCustomerSearchQuery) {
        setCustomerSearchQuery(matchingCust.shopName);
      } else if (target === 'history' && matchingCust && setInvoiceSearchQuery) {
        setInvoiceSearchQuery(matchingCust.shopName);
      }

      setActiveTab(target);
      setIsSidebarOpen(false);
      
      const tabNames: Record<string, string> = {
        'history': 'سجل المبيعات',
        'customers': 'قائمة العملاء',
        'admin_loans': 'إدارة السلف',
        'settlement': 'تقفيلة اليوم',
        'invoice': 'فاتورة جديدة'
      };
      
      showToast(`جاري الانتقال إلى ${tabNames[target] || 'القسم المطلوب'}...`);
    } else {
      showToast('إشعار تنبيهي فقط');
    }
  };

  const markAllAsRead = async () => {
    try {
      const targets = activePartition === 'all' 
        ? notifications.filter(n => !n.isRead)
        : filteredNotifications.filter(n => !n.isRead);

      if (targets.length === 0) {
        showToast('جميع الإشعارات المحددة مقروءة بالفعل');
        return;
      }

      await dataService.markAllNotificationsAsRead(targets);
      showToast('تم تحديد الإشعارات كمقروءة بنجاح ✓');
    } catch (error) {
      console.error('Error marking all as read:', error);
      showToast('خطأ في تحديث الإشعارات', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <Bell size={24} className="animate-wiggle" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl md:text-2xl font-black text-ink">مركز الإشعارات</h2>
              {partitionCounts.all.unread > 0 ? (
                <span className="px-3 py-1 bg-rose-500 text-white text-xs font-black rounded-full shadow-sm animate-pulse">
                  {partitionCounts.all.unread} غير مقروء
                </span>
              ) : (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                  الكل مقروء ✓
                </span>
              )}
            </div>
            <p className="text-xs text-secondary/60 font-medium mt-0.5">
              متابعة حركة الفواتير، التعديلات، العملاء، اليوميات، والسلف في مكان واحد
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <button
            onClick={markAllAsRead}
            disabled={filteredNotifications.every(n => n.isRead)}
            className="flex-1 md:flex-none px-4 py-2.5 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 text-blue-700 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 border border-blue-200/60"
          >
            <CheckCheck size={16} />
            <span>{activePartition === 'all' ? 'تحديد الكل كمقروء' : 'تحديد هذا القسم كمقروء'}</span>
          </button>
        </div>
      </div>

      {/* Partitions Horizontal Tabs Bar */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 px-1 custom-scrollbar scroll-smooth">
          {NOTIFICATION_PARTITIONS.map(p => {
            const Icon = p.icon;
            const count = partitionCounts[p.id];
            const isActive = activePartition === p.id;

            return (
              <button
                key={p.id}
                onClick={() => setActivePartition(p.id)}
                className={cn(
                  "px-4 py-3 rounded-xl font-black text-xs flex items-center gap-2.5 whitespace-nowrap transition-all duration-200 shrink-0",
                  isActive
                    ? `${p.activeColor} shadow-md scale-[1.02]`
                    : "text-slate-600 hover:text-ink hover:bg-slate-100"
                )}
              >
                <Icon size={17} className={isActive ? "text-white" : "text-slate-500"} />
                <span>{p.label}</span>

                {/* Total badge */}
                <span className={cn(
                  "px-2 py-0.5 rounded-lg text-[10px] font-bold",
                  isActive ? "bg-white/20 text-white" : "bg-slate-200/70 text-slate-700"
                )}>
                  {count.total}
                </span>

                {/* Unread badge if any */}
                {count.unread > 0 && (
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-black animate-pulse",
                    isActive ? "bg-white text-rose-600 shadow-sm" : "bg-rose-500 text-white shadow-sm"
                  )}>
                    {count.unread} جديد
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="ابحث في نص الإشعار، اسم المندوب، أو العميل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs font-bold text-ink shadow-sm"
          />
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={cn(
              "px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border",
              unreadOnly
                ? "bg-rose-50 border-rose-200 text-rose-700 shadow-sm font-black"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <Filter size={14} />
            <span>غير المقروء فقط</span>
            {partitionCounts[activePartition].unread > 0 && (
              <span className="px-1.5 py-0.2 rounded-md bg-rose-200 text-rose-800 text-[10px] font-black">
                {partitionCounts[activePartition].unread}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200 p-8 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Bell size={28} />
            </div>
            <h4 className="text-base font-black text-slate-700 mb-1">
              {unreadOnly ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات في هذا القسم'}
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery 
                ? 'لا توجد نتائج مطابقة لبحثك، جرب البحث بكلمات أخرى.' 
                : 'ستظهر هنا الإشعارات والتنبيهات فور وصولها من المناديب أو النظام.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const subBadge = getNotificationSubBadge(notif);
            const category = getNotificationCategory(notif);

            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={cn(
                  "p-5 rounded-2xl border transition-all cursor-pointer relative group",
                  notif.isRead 
                    ? "bg-white border-slate-100 hover:border-slate-200 hover:shadow-md opacity-85" 
                    : "bg-blue-50/70 border-blue-200/80 shadow-sm ring-1 ring-blue-300/40 hover:bg-blue-50"
                )}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 space-y-2">
                    {/* Header info */}
                    <div className="flex flex-wrap items-center gap-2">
                      {!notif.isRead && (
                        <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                      )}
                      
                      {/* Sub-badge */}
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-lg text-[10px] font-black tracking-wide",
                        subBadge.bg,
                        subBadge.text
                      )}>
                        {subBadge.label}
                      </span>

                      <h3 className={cn(
                        "text-sm font-black",
                        notif.isRead ? "text-slate-800" : "text-ink"
                      )}>
                        {notif.title}
                      </h3>
                    </div>

                    {/* Message */}
                    <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-medium">
                      {notif.message}
                    </p>

                    {/* Footer tags */}
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                      <span className="flex items-center gap-1.5 font-bold text-slate-600">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        {notif.senderName}
                      </span>
                      <span className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {notif.date || 'اليوم'}
                      </span>
                      {notif.targetTab && (
                        <span className="text-[10px] text-primary font-bold group-hover:underline flex items-center gap-1">
                          <span>اضغط للانتقال للقسم</span>
                          <span>←</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Icon badge */}
                  <div className={cn(
                    "p-3 rounded-2xl shrink-0 transition-transform group-hover:scale-110",
                    category === 'invoices' ? "bg-emerald-100 text-emerald-600" :
                    category === 'customers' ? "bg-blue-100 text-blue-600" :
                    category === 'settlement' ? "bg-amber-100 text-amber-600" :
                    category === 'loans' ? "bg-rose-100 text-rose-600" :
                    category === 'loading' ? "bg-indigo-100 text-indigo-600" :
                    "bg-purple-100 text-purple-600"
                  )}>
                    {category === 'invoices' && <FileText className="w-5 h-5" />}
                    {category === 'customers' && <Users className="w-5 h-5" />}
                    {category === 'settlement' && <Calculator className="w-5 h-5" />}
                    {category === 'loans' && <CreditCard className="w-5 h-5" />}
                    {category === 'loading' && <Truck className="w-5 h-5" />}
                    {category === 'system' && <Clock className="w-5 h-5" />}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function HistoryTab({ invoices, customers, profile, showToast, allUsers, products, settings, invoiceSearchQuery, setInvoiceSearchQuery }: { invoices: Invoice[], customers: Customer[], profile: UserProfile | null, showToast: (m: string, t?: 'success' | 'error') => void, allUsers: UserProfile[], products: Product[], settings: Settings | null, invoiceSearchQuery?: string, setInvoiceSearchQuery?: (q: string) => void }) {
  const [isSharing, setIsSharing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customerFilter, setCustomerFilter] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedRepId, setSelectedRepId] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const invoiceModalRef = useRef<HTMLDivElement>(null);
  const [isThermalMode, setIsThermalMode] = useState(true);
  const [historySection, setHistorySection] = useState<'cards' | 'table'>('cards');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBtPrinting, setIsBtPrinting] = useState(false);
  const [btPrintStatus, setBtPrintStatus] = useState('');
  const [isBtGuideOpen, setIsBtGuideOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFetchingRange, setIsFetchingRange] = useState(false);

  // When date range changes or user selects an older date, actively query Supabase for invoices in that range
  useEffect(() => {
    if (startDate || endDate) {
      const isRep = profile?.role === 'representative' || profile?.role === 'backup_representative';
      const repId = isRep ? profile?.uid : (selectedRepId || undefined);
      setIsFetchingRange(true);
      dataService.fetchInvoicesByDateRange(startDate, endDate, repId)
        .catch(() => {})
        .finally(() => setIsFetchingRange(false));
    }
  }, [startDate, endDate, selectedRepId, profile]);

  useEffect(() => {
    if (invoiceSearchQuery) {
      // Set date range to 30 days ago to ensure we find it
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      setStartDate(format(thirtyDaysAgo, 'yyyy-MM-dd'));
      setEndDate(format(new Date(), 'yyyy-MM-dd'));

      const foundCust = customers.find(c => 
        (c.shopName || '').toLowerCase().includes(invoiceSearchQuery.toLowerCase()) || 
        c.id === invoiceSearchQuery
      );
      if (foundCust) {
        setCustomerFilter(foundCust.id);
        setCustomerSearch(foundCust.shopName);
      } else {
        const foundInv = invoices.find(inv => (inv.id || '').toLowerCase().includes(invoiceSearchQuery.toLowerCase()));
        if (foundInv) {
          setCustomerFilter(foundInv.customerId);
          setCustomerSearch(foundInv.customerName);
          setSelectedInvoice(foundInv);
        } else {
          // On-demand fetch by invoice ID if it's an old invoice not in memory
          dataService.fetchInvoiceById(invoiceSearchQuery).then((fetched) => {
            if (fetched) {
              setSelectedInvoice(fetched as Invoice);
            }
          }).catch(() => {});
        }
      }
      // Clear after handling so it doesn't loop
      if (setInvoiceSearchQuery) {
        setInvoiceSearchQuery('');
      }
    }
  }, [invoiceSearchQuery, customers, invoices, setInvoiceSearchQuery]);

  const isManager = profile?.role === 'manager';
  const isAccountant = profile?.role === 'accountant';
  const isRep = profile?.role === 'representative' || profile?.role === 'backup_representative';
  const canFilterRep = isManager || isAccountant;
  const representatives = allUsers.filter(u => u.role === 'representative' || u.role === 'backup_representative');
  const canDeleteInvoice = profile?.role === 'manager' || profile?.role === 'accountant' || profile?.role === 'supervisor' || profile?.role === 'developer' || profile?.email === 'amin@ok.com' || profile?.email === 'admin@ok.com';
  const canEditInvoice = profile?.role === 'manager' || profile?.role === 'developer';

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
      
      showToast('تم حذف الفاتورة وتحديث رصيد العميل بنجاح', 'success');
      setSelectedInvoice(null);
      setIsDeleteConfirmOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast(`فشل في حذف الفاتورة: ${err.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    (c.shopName || '').toLowerCase().includes((customerSearch || '').toLowerCase()) ||
    (c.ownerName || '').toLowerCase().includes((customerSearch || '').toLowerCase())
  );

  const handlePrint = async () => {
    if (!invoiceModalRef.current) return;
    const element = invoiceModalRef.current;
    
    try {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      
      const dataUrl = await toPng(element, {
        quality: 0.98,
        pixelRatio: 2.0, // Higher ratio for crystal clear text on receipts
        backgroundColor: '#ffffff',
        cacheBust: true,
        width: width,
        height: height,
        style: {
          transform: 'none',
          transformOrigin: 'top left',
          margin: '0',
          padding: '0',
        }
      });
      
      const img = new Image();
      img.src = dataUrl;
      await new Promise(resolve => img.onload = resolve);
      
      // Calculate dimensions to fit in A4 width but dynamic height
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = (img.height * pdfWidth) / img.width;
      
      const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      pdf.save(`invoice_${selectedInvoice?.id || 'history'}.pdf`);
      showToast('تم تحميل الفاتورة بنجاح');
    } catch (err) {
      console.error(err);
      showToast('خطأ في الطباعة وتحميل ملف الـ PDF', 'error');
    }
  };

  const handleDirectPrint = () => {
    if (!invoiceModalRef.current) return;
    
    // Clone the printable invoice element to avoid modifying the screen UI
    const originalEl = invoiceModalRef.current;
    const clone = originalEl.cloneNode(true) as HTMLDivElement;
    clone.id = 'temp-print-element';
    
    // Create and inject custom print styles for the main document
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
        /* Hide absolutely everything in the document body except our temp element */
        body > *:not(#temp-print-element) {
          display: none !important;
          height: 0 !important;
          overflow: hidden !important;
        }
        
        #temp-print-element {
          display: block !important;
          width: ${isThermalMode ? '80mm' : '100%'} !important;
          max-width: ${isThermalMode ? '80mm' : '100%'} !important;
          min-width: ${isThermalMode ? '80mm' : 'auto'} !important;
          margin: 0 !important;
          padding: ${isThermalMode ? '2mm 3mm' : '4mm 2mm'} !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: ${isThermalMode ? 'monospace' : 'sans-serif'} !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          
          /* Force pure solid black colors */
          --color-slate-100: #000000 !important;
          --color-slate-200: #000000 !important;
          --color-slate-300: #000000 !important;
          --color-slate-400: #000000 !important;
          --color-slate-500: #000000 !important;
          --color-slate-600: #000000 !important;
          --color-slate-700: #000000 !important;
          --color-slate-800: #000000 !important;
          --color-slate-900: #000000 !important;
          --color-blue-100: #000000 !important;
          --color-blue-200: #000000 !important;
          --color-blue-500: #000000 !important;
          --color-blue-600: #000000 !important;
          --color-red-600: #000000 !important;
          --color-green-600: #000000 !important;
          --color-purple-600: #000000 !important;
          --color-ink: #000000 !important;
          --color-secondary: #000000 !important;
          --color-primary: #000000 !important;
        }
        
        @page {
          margin: 0 !important;
          size: ${isThermalMode ? '80mm auto' : 'auto'} !important;
        }
        
        #temp-print-element #printable-invoice,
        #temp-print-element #printable-invoice * {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        /* Pure high contrast black and thick stroke font tuning for thermal heat printing */
        #temp-print-element *,
        #temp-print-element p,
        #temp-print-element span,
        #temp-print-element div,
        #temp-print-element td,
        #temp-print-element th,
        #temp-print-element h2,
        #temp-print-element h3,
        #temp-print-element h4 {
          visibility: visible !important;
          color: #000000 !important;
          background-color: transparent !important;
          border-color: #000000 !important;
          font-weight: 950 !important; /* Extremely bold for thermal burn visibility */
          -webkit-text-stroke: 0.6px #000000 !important; /* Thicker text outline for clear heat burn */
          text-shadow: none !important;
          box-shadow: none !important;
        }
        
        /* Make sure borders print with maximum solid black style */
        #temp-print-element .border-dashed,
        #temp-print-element .border-dotted,
        #temp-print-element .border-slate-300,
        #temp-print-element .border-slate-200,
        #temp-print-element .border-b-3,
        #temp-print-element .border-t-3 {
          border-color: #000000 !important;
          border-style: solid !important;
          border-width: 4px !important;
        }
        
        table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        
        ${isThermalMode ? `
          /* Scale up all text for 80mm thermal receipt paper to make it extremely clear and readable */
          #temp-print-element, 
          #temp-print-element * {
            font-size: 26px !important; 
            line-height: 1.6 !important;
          }
          #temp-print-element h2 {
            font-size: 46px !important; /* Very large company header */
            margin-bottom: 14px !important;
            letter-spacing: 1px !important;
          }
          #temp-print-element h3, 
          #temp-print-element .text-lg {
            font-size: 34px !important;
          }
          #temp-print-element .text-base {
            font-size: 32px !important;
          }
          #temp-print-element .text-sm {
            font-size: 28px !important;
          }
          #temp-print-element .text-xs,
          #temp-print-element td,
          #temp-print-element th {
            font-size: 26px !important;
            padding: 12px 2px !important; /* Spacious padding to prevent overlap and optimize ink burns */
          }
          /* Explicitly scale small utility text to remain highly readable */
          #temp-print-element .text-\\[8px\\],
          #temp-print-element .text-\\[9px\\] {
            font-size: 24px !important;
          }
        ` : `
          th, td {
            padding: 8px 4px !important;
            font-size: 14px !important;
          }
        `}
      }
    `;
    
    // Append clone and styles directly to document body & head
    document.body.appendChild(clone);
    document.head.appendChild(style);
    
    // Helper to safely cleanup elements
    const cleanup = () => {
      const el = document.getElementById('temp-print-element');
      const st = document.getElementById('temp-print-styles');
      if (el) el.remove();
      if (st) st.remove();
    };
    
    // Listen to afterprint event to clean up automatically
    window.addEventListener('afterprint', cleanup, { once: true });
    
    // Trigger native browser printing dialog
    setTimeout(() => {
      window.print();
      // Safe fallback cleanup if the user cancels or browser doesn't trigger afterprint
      setTimeout(cleanup, 5000);
    }, 150);
  };

  const handleBluetoothPrint = async () => {
    try {
      let isIframe = false;
      try {
        isIframe = window.self !== window.top;
      } catch (e) {
        // Accessing window.top from a cross-origin iframe throws a SecurityError.
        // If it throws, we are definitely inside a cross-origin iframe!
        isIframe = true;
      }

      if (isIframe) {
        setIsBtGuideOpen(true);
        showToast('⚠️ يرجى فتح التطبيق في صفحة خارجية مستقلة لاستخدام البلوتوث المباشر!', 'error');
        return;
      }

      const nav = navigator as any;
      if (!nav.bluetooth) {
        setIsBtGuideOpen(true);
        showToast('⚠️ المتصفح أو الجهاز الحالي لا يدعم الاتصال المباشر بالبلوتوث', 'error');
        return;
      }

      setIsBtPrinting(true);
      setBtPrintStatus('جاري التحضير للطباعة المباشرة عبر البلوتوث...');
      
      await printElementViaBluetooth('printable-invoice', (status) => {
        setBtPrintStatus(status);
      });
      
      showToast('تمت الطباعة بنجاح عبر البلوتوث المباشر! 🎉', 'success');
      setTimeout(() => {
        setBtPrintStatus('');
        setIsBtPrinting(false);
      }, 3000);
    } catch (err: any) {
      console.error("Bluetooth print error:", err);
      showToast(err.message || 'فشل الاتصال بالطابعة أو الطباعة', 'error');
      setBtPrintStatus('');
      setIsBtPrinting(false);
    }
  };

  const handleRawBTPrint = async () => {
    try {
      setIsBtPrinting(true);
      setBtPrintStatus('جاري تحضير الفاتورة وإرسالها لتطبيق RawBT...');
      
      await printElementViaRawBT('printable-invoice', (status) => {
        setBtPrintStatus(status);
      });
      
      showToast('تم إرسال الفاتورة بنجاح لتطبيق RawBT! 🎉', 'success');
      setTimeout(() => {
        setBtPrintStatus('');
        setIsBtPrinting(false);
      }, 3000);
    } catch (err: any) {
      console.error("RawBT print error:", err);
      showToast(err.message || 'فشل إرسال الفاتورة لتطبيق RawBT', 'error');
      setBtPrintStatus('');
      setIsBtPrinting(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!invoiceModalRef.current) return;
    const element = invoiceModalRef.current;
    
    try {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      
      const dataUrl = await toPng(element, {
        quality: 0.98,
        pixelRatio: 2.0,
        backgroundColor: '#ffffff',
        cacheBust: true,
        width: width,
        height: height,
        style: {
          transform: 'none',
          transformOrigin: 'top left',
          margin: '0',
          padding: '0',
        }
      });
      const link = document.createElement('a');
      link.download = `invoice_${selectedInvoice?.id || 'history'}.png`;
      link.href = dataUrl;
      link.click();
      showToast('تم حفظ الصورة بنجاح');
    } catch (err) {
      console.error(err);
      showToast('خطأ في حفظ الصورة', 'error');
    }
  };

  const handleWhatsAppShare = async () => {
    if (!invoiceModalRef.current || isSharing) return;
    setIsSharing(true);
    try {
      const element = invoiceModalRef.current;
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      
      const blob = await toBlob(element, {
        quality: 0.98,
        pixelRatio: 2.0,
        backgroundColor: '#ffffff',
        cacheBust: true,
        width: width,
        height: height,
        style: {
          transform: 'none',
          transformOrigin: 'top left',
          margin: '0',
          padding: '0',
        }
      });
      
      if (!blob) {
        setIsSharing(false);
        return;
      }
      const file = new File([blob], `invoice_${selectedInvoice?.id || 'history'}.png`, { type: 'image/png' });
        
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'فاتورة',
            text: 'فاتورة شركة OK'
          });
        } catch (err) {
          if ((err as Error).name !== 'AbortError') {
            console.error(err);
            showToast('خطأ في المشاركة', 'error');
          }
        }
      } else {
        // Fallback: Open WhatsApp with text if image sharing not supported
        const text = `فاتورة العميل: ${selectedInvoice?.customerName}\nالتاريخ: ${selectedInvoice?.date}\nالمبلغ: ${selectedInvoice?.totalPaidToday} ج.م`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        showToast('المشاركة المباشرة للصور غير مدعومة. تم فتح واتساب مع تفاصيل الفاتورة.');
      }
    } catch (err) {
      console.error(err);
      showToast('خطأ في إعداد الفاتورة', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const handleExportToExcel = () => {
    if (!isManager) return;
    setIsExporting(true);
    try {
      const data = filteredInvoices.map(inv => {
        const row: any = {
          'التاريخ': inv.date,
          'الوقت': inv.time,
          'المندوب': inv.representativeName,
          'اسم المحل': inv.customerName,
        };

        // Add product columns
        products.forEach(p => {
          const item = inv.items.find(i => i.productId === p.id);
          row[`${p.name} - مباع`] = item?.sold || 0;
          row[`${p.name} - مرتجع`] = item?.returnDamaged || 0;
          row[`${p.name} - هدايا`] = item?.gifts || 0;
        });

        row['الإجمالي الفرعي'] = inv.subtotal;
        row['نوع الخصم'] = inv.discountType === 'fixed' ? 'مبلغ' : 'نسبة';
        row['قيمة الخصم'] = inv.discountValue;
        row['الآجل'] = inv.credit;
        row['التحصيل'] = inv.collection;
        row['إجمالي المدفوع اليوم'] = inv.totalPaidToday;

        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");
      
      // Generate filename with date range
      const fileName = `invoices_${startDate}_to_${endDate}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showToast('تم تصدير البيانات بنجاح');
    } catch (error) {
      console.error('Export error:', error);
      showToast('خطأ في تصدير البيانات', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const rawDate = inv.date || (inv as any).timestamp || '';
    const invDate = normalizeDateStringToISO(rawDate);
    const startIso = startDate ? normalizeDateStringToISO(startDate) : '';
    const endIso = endDate ? normalizeDateStringToISO(endDate) : '';

    const matchesDate = !invDate || ((!startIso || invDate >= startIso) && (!endIso || invDate <= endIso));
    const matchesCustomer = customerFilter === '' || inv.customerId === customerFilter || (inv as any).customerid === customerFilter;
    const matchesRep = !selectedRepId || selectedRepId === 'all' || inv.representativeId === selectedRepId || (inv as any).representativeid === selectedRepId;

    const isRep = profile?.role === 'representative' || profile?.role === 'backup_representative';
    const userRouteId = profile?.routeId || (profile as any)?.routeid;
    const userRouteName = profile?.routeName || (profile as any)?.routename;

    let matchesRole = true;
    if (isRep && profile) {
      const invRepId = inv.representativeId || (inv as any).representativeid;
      const invRouteId = (inv as any).routeId || (inv as any).routeid;
      const invRouteName = (inv as any).routeName || (inv as any).routename;

      const isDirectRep = Boolean(
        (invRepId && profile.uid && String(invRepId) === String(profile.uid)) ||
        (invRepId && (profile as any).id && String(invRepId) === String((profile as any).id)) ||
        (inv.representativeName && profile.name && inv.representativeName.trim() === profile.name.trim())
      );
      const matchesInvRoute = Boolean(
        (userRouteId && invRouteId && String(userRouteId) === String(invRouteId)) ||
        (userRouteName && invRouteName && String(userRouteName).trim() === String(invRouteName).trim())
      );

      const custObj = customers.find(c => c.id === inv.customerId || c.id === (inv as any).customerid);
      const custRouteId = custObj?.routeId || (custObj as any)?.routeid;
      const custRouteName = custObj?.routeName || (custObj as any)?.routename;
      const matchesCustRoute = Boolean(
        (userRouteId && custRouteId && String(userRouteId) === String(custRouteId)) ||
        (userRouteName && custRouteName && String(userRouteName).trim() === String(custRouteName).trim())
      );

      const repHasRoute = Boolean(userRouteId || userRouteName);

      if (isDirectRep) {
        matchesRole = true;
      } else if (repHasRoute) {
        matchesRole = matchesInvRoute || matchesCustRoute;
      } else {
        matchesRole = true;
      }
    } else {
      matchesRole = true;
    }

    const query = invoiceSearchQuery?.toLowerCase() || '';
    const matchesSearch = !query || 
      (inv.customerName || '').toLowerCase().includes(query) ||
      (inv.id || '').toLowerCase().includes(query) ||
      (inv.representativeName || '').toLowerCase().includes(query);

    return matchesDate && matchesCustomer && matchesRole && matchesRep && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-ink">سجل المبيعات</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">استعراض وإدارة جميع الفواتير وتحليل المبيعات</p>
        </div>

        {/* Two Section Switcher Tabs */}
        <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 flex items-center gap-1.5 shadow-sm">
          <button
            onClick={() => setHistorySection('cards')}
            className={clsx(
              "px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all",
              historySection === 'cards'
                ? "bg-white text-primary shadow-sm shadow-black/5 scale-[1.02]"
                : "text-slate-600 hover:text-ink hover:bg-white/50"
            )}
          >
            <LayoutGrid size={15} />
            <span>القسم الأول: سجل الفواتير (الافتراضي)</span>
          </button>
          
          <button
            onClick={() => setHistorySection('table')}
            className={clsx(
              "px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all",
              historySection === 'table'
                ? "bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]"
                : "text-slate-600 hover:text-ink hover:bg-white/50"
            )}
          >
            <Table size={15} />
            <span>القسم الثاني: جدول الفواتير الموسع 📊</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: ORIGINAL CARDS & LIST VIEW */}
      {historySection === 'cards' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 items-end justify-between px-2 bg-blue-50/40 p-4 rounded-3xl border border-blue-100">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-1">من</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white px-4 py-2.5 rounded-xl border-2 border-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-ink"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-1">إلى</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white px-4 py-2.5 rounded-xl border-2 border-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-ink"
                />
              </div>
              {isFetchingRange && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-100/80 text-blue-700 rounded-xl text-xs font-bold animate-pulse">
                  <RefreshCcw size={13} className="animate-spin" />
                  <span>جاري استدعاء فواتير التاريخ...</span>
                </div>
              )}
              <div className="flex flex-col gap-1 relative">
                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-1">العميل</label>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="ابحث عن عميل..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      if (e.target.value === '') setCustomerFilter('');
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="bg-white px-4 py-2.5 rounded-xl border-2 border-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-ink min-w-[200px] w-full"
                  />
                  {showCustomerDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border-2 border-blue-50 max-h-60 overflow-y-auto z-50 custom-scrollbar">
                      <button 
                        onClick={() => {
                          setCustomerFilter('');
                          setCustomerSearch('');
                          setShowCustomerDropdown(false);
                        }}
                        className="w-full text-right px-4 py-3 text-sm font-bold text-secondary hover:bg-blue-50 transition-colors border-b border-blue-50"
                      >
                        كل العملاء
                      </button>
                      {filteredCustomers.map(c => (
                        <button 
                          key={c.id}
                          onClick={() => {
                            setCustomerFilter(c.id);
                            setCustomerSearch(c.shopName);
                            setShowCustomerDropdown(false);
                          }}
                          className="w-full text-right px-4 py-3 text-sm font-bold text-ink hover:bg-blue-50 transition-colors border-b border-blue-50 last:border-0"
                        >
                          <div className="font-bold">{c.shopName}</div>
                          <div className="text-[10px] text-secondary/50">{c.ownerName} - {c.area}</div>
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <div className="px-4 py-3 text-sm text-secondary/50 text-center">لا يوجد نتائج</div>
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
              {canFilterRep && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-1">المندوب</label>
                  <select 
                    value={selectedRepId || ''}
                    onChange={(e) => setSelectedRepId(e.target.value)}
                    className="bg-white px-4 py-2.5 rounded-xl border-2 border-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-ink min-w-[140px]"
                  >
                    <option value="">كل المناديب</option>
                    {representatives.map(rep => (
                      <option key={rep.uid} value={rep.uid}>{rep.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {isManager && (
              <button
                onClick={handleExportToExcel}
                disabled={isExporting || filteredInvoices.length === 0}
                className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-green-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-green-600/20 active:scale-95"
              >
                {isExporting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                ) : (
                  <Download size={18} />
                )}
                <span>تصدير إكسيل</span>
              </button>
            )}
          </div>

          <div className="px-2">
            <div className="bg-white rounded-[2.5rem] shadow-md border-2 border-blue-100 overflow-hidden">
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto custom-scrollbar">
                <table className="w-full text-right border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-blue-50 border-b-2 border-blue-100">
                      <th className="p-6 font-bold text-blue-500 uppercase text-[10px] tracking-widest">الوقت</th>
                      <th className="p-6 font-bold text-blue-500 uppercase text-[10px] tracking-widest text-right">العميل</th>
                      <th className="p-6 font-bold text-blue-500 uppercase text-[10px] tracking-widest text-right">المندوب</th>
                      <th className="p-6 font-bold text-blue-500 uppercase text-[10px] tracking-widest text-right">المحصل اليوم</th>
                      <th className="p-6 font-bold text-blue-500 uppercase text-[10px] tracking-widest text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map(inv => (
                      <tr key={inv.id} className="border-b border-blue-50 hover:bg-blue-50/50 transition-colors">
                        <td className="p-6 text-sm font-medium text-ink/70">{inv.time}</td>
                        <td className="p-6">
                          <p className="font-bold text-sm text-ink">{inv.customerName}</p>
                        </td>
                        <td className="p-6 text-xs text-blue-400 font-bold">{inv.representativeName}</td>
                        <td className="p-6 text-right font-black text-sm text-primary">{(inv.totalPaidToday || 0).toLocaleString()} ج.م</td>
                        <td className="p-6">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => setSelectedInvoice(inv)}
                              className="p-2.5 text-blue-500 hover:bg-blue-500 hover:text-white rounded-xl transition-all active:scale-95 border-2 border-blue-100 bg-white"
                              title="عرض الفاتورة"
                            >
                              <FileText size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredInvoices.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-20 text-center text-blue-300 italic font-serif">لا توجد فواتير مطابقة لهذه المعايير.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-blue-50">
                {filteredInvoices.map(inv => (
                  <div key={inv.id} className="p-5 flex items-center justify-between hover:bg-blue-50/30 transition-colors">
                    <div className="space-y-2">
                      <div className="font-bold text-ink">{inv.customerName}</div>
                      <div className="flex items-center gap-2 text-[10px] text-blue-400 font-medium">
                        <Clock size={12} className="text-blue-300" />
                        <span>{inv.time}</span>
                        <span className="opacity-30">|</span>
                        <span>{inv.representativeName}</span>
                      </div>
                      <div className="text-sm font-black text-primary pt-1">{(inv.totalPaidToday || 0).toLocaleString()} ج.م</div>
                    </div>
                    <button 
                      onClick={() => setSelectedInvoice(inv)}
                      className="p-3.5 text-primary bg-blue-50 rounded-2xl active:scale-95 border-2 border-blue-100 shadow-sm"
                    >
                      <FileText size={22} />
                    </button>
                  </div>
                ))}
                {filteredInvoices.length === 0 && (
                  <div className="p-12 text-center text-blue-300 italic text-sm font-serif">لا توجد فواتير اليوم</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: COMPREHENSIVE INVOICES TABLE VIEW */}
      {historySection === 'table' && (
        <InvoicesTableSection
          invoices={filteredInvoices}
          allInvoices={invoices}
          customers={customers}
          products={products}
          allUsers={allUsers}
          profile={profile}
          onSelectInvoice={(inv) => setSelectedInvoice(inv)}
          onEditInvoice={(inv) => {
            setSelectedInvoice(inv);
            setIsEditModalOpen(true);
          }}
          onDeleteInvoice={(inv) => {
            setSelectedInvoice(inv);
            setIsDeleteConfirmOpen(true);
          }}
          canEditInvoice={canEditInvoice}
          canDeleteInvoice={canDeleteInvoice}
          showToast={showToast}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          customerFilter={customerFilter}
          onCustomerFilterChange={(cId) => {
            setCustomerFilter(cId);
            const found = customers.find(c => c.id === cId);
            setCustomerSearch(found ? found.shopName : '');
          }}
          selectedRepId={selectedRepId}
          onSelectedRepIdChange={setSelectedRepId}
          canFilterRep={canFilterRep}
          representatives={representatives}
        />
      )}

      {/* Invoice Detail Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <div id="invoice-modal-container" className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedInvoice(null)}
              className="absolute inset-0 bg-ink/60 backdrop-blur-md"
            />
            <motion.div 
              id="invoice-modal-card"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-[3rem] shadow-2xl p-4 md:p-8 border-2 border-blue-100"
            >
              <button 
                onClick={() => setSelectedInvoice(null)} 
                className="absolute top-6 left-6 p-3 hover:bg-blue-50 rounded-2xl transition-all active:scale-95 print:hidden border-2 border-blue-50 z-10"
              >
                <X size={24} className="text-blue-300 hover:text-primary" />
              </button>

                <div className="flex items-center justify-between mb-6 border-b border-blue-50 pb-4 print:hidden">
                  <span className="font-bold text-sm text-secondary">طريقة العرض للطابعة:</span>
                  <div className="flex bg-slate-100 rounded-xl p-1 text-xs">
                    <button
                      onClick={() => setIsThermalMode(false)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${!isThermalMode ? 'bg-primary text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      افتراضي
                    </button>
                    <button
                      onClick={() => setIsThermalMode(true)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${isThermalMode ? 'bg-primary text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      طابعة حرارية (80مم) ♻️
                    </button>
                  </div>
                </div>

              <div id="printable-invoice" ref={invoiceModalRef} className={isThermalMode ? "p-4 bg-white w-full max-w-[576px] mx-auto text-black font-mono text-sm border-3 border-black leading-relaxed" : "p-4 md:p-6 bg-white max-w-[500px] mx-auto"}>
                <div className={isThermalMode ? "text-center mb-4 border-b-3 border-black pb-3" : "text-center mb-8 border-b-2 border-blue-100 pb-6"}>
                  <h2 className={isThermalMode ? "text-2xl font-serif font-black text-black" : "text-3xl font-serif font-black text-primary"}>شركة OK</h2>
                  <p className={isThermalMode ? "text-xs text-black font-black mt-1" : "text-[10px] text-secondary font-black tracking-[0.3em] uppercase mt-1"}>نظام الإدارة المتكامل</p>
                  {settings?.companyPhone && (
                    <p className={isThermalMode ? "text-xs text-black font-black mt-1" : "text-xs text-slate-500 font-bold mt-1"}>
                      تليفون الشركة: {settings.companyPhone}
                    </p>
                  )}
                </div>

                <div className={isThermalMode ? "flex justify-between items-center mb-4 text-xs border-b-3 border-black pb-3" : "flex justify-between items-center mb-10"}>
                  {isThermalMode ? (
                    <>
                      <span className="font-black text-black">فاتورة مبيعات</span>
                      <span className="font-black">ID: {selectedInvoice.id.slice(-8).toUpperCase()}</span>
                    </>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                        <FileText size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-serif font-black text-ink">فاتورة مبيعات</h3>
                        <p className="text-blue-400 font-mono text-[10px] mt-1 tracking-widest uppercase">ID: {selectedInvoice.id.slice(-8).toUpperCase()}</p>
                      </div>
                    </div>
                  )}
                </div>

                {isThermalMode ? (
                  <div className="space-y-1.5 text-xs mb-4 border-b-3 border-black pb-3">
                    <div className="flex justify-between">
                      <span className="text-black font-black">العميل:</span>
                      <span className="font-black text-black">{selectedInvoice.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-black font-black">المندوب:</span>
                      <span className="font-black text-black">{selectedInvoice.representativeName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-black font-black">التاريخ:</span>
                      <span className="font-black text-black">{selectedInvoice.date} | {selectedInvoice.time}</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 mb-10">
                    <div className="space-y-3 bg-blue-50 p-5 rounded-[1.5rem] border-2 border-blue-100">
                      <div>
                        <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">العميل</p>
                        <p className="text-lg font-black text-ink leading-tight">{selectedInvoice.customerName}</p>
                        {(() => {
                          const invCust = customers.find(c => c.id === selectedInvoice.customerId);
                          return invCust?.phone ? (
                            <div className="flex items-center gap-2 mt-2 print:hidden">
                              <a 
                                href={`tel:${invCust.phone}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded-xl text-[10px] font-black hover:bg-green-700 transition-all active:scale-95"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Phone size={10} />
                                اتصال: {invCust.phone}
                              </a>
                            </div>
                          ) : null;
                        })()}
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
                )}

                <div className={isThermalMode ? "mb-4 border-b-3 border-black pb-3" : "mb-10"}>
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className={isThermalMode ? "border-b-3 border-black" : "border-b-2 border-blue-100"}>
                        <th className={isThermalMode ? "py-2 font-black text-xs text-black uppercase" : "py-3 font-black text-[9px] text-blue-500 uppercase tracking-widest"}>المنتج</th>
                        <th className={isThermalMode ? "py-2 text-center font-black text-xs text-black uppercase" : "py-3 text-center font-black text-[9px] text-blue-500 uppercase tracking-widest"}>السعر</th>
                        <th className={isThermalMode ? "py-2 text-center font-black text-xs text-black uppercase" : "py-3 text-center font-black text-[9px] text-blue-500 uppercase tracking-widest"}>عدد</th>
                        {selectedInvoice.items.some(i => i.returnDamaged > 0) && (
                          <th className={isThermalMode ? "py-2 text-center font-black text-xs text-black uppercase" : "py-3 text-center font-black text-[9px] text-red-500 uppercase tracking-widest"}>تالف</th>
                        )}
                        {selectedInvoice.items.some(i => i.gifts > 0) && (
                          <th className={isThermalMode ? "py-2 text-center font-black text-xs text-black uppercase" : "py-3 text-center font-black text-[9px] text-green-500 uppercase tracking-widest"}>هدايا</th>
                        )}
                        <th className={isThermalMode ? "py-2 text-left font-black text-xs text-black uppercase" : "py-3 text-left font-black text-[9px] text-blue-500 uppercase tracking-widest"}>الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className={isThermalMode ? "" : "divide-y divide-blue-50"}>
                      {selectedInvoice.items
                        .filter(item => item.sold > 0 || item.returnDamaged > 0 || item.gifts > 0)
                        .map((item, i) => (
                        <tr key={i} className={isThermalMode ? "border-b border-solid border-black/20" : "hover:bg-blue-50/30 transition-colors"}>
                          <td className={isThermalMode ? "py-2 text-xs font-black text-black whitespace-nowrap" : "py-3 text-xs font-black text-ink whitespace-nowrap"}>{item.productName}</td>
                          <td className={isThermalMode ? "py-2 text-center text-xs font-black text-black" : "py-3 text-center text-xs font-bold text-ink/60"}>{item.price}</td>
                          <td className={isThermalMode ? "py-2 text-center text-xs font-black text-black" : "py-3 text-center text-xs font-black text-ink"}>{item.sold}</td>
                          {selectedInvoice.items.some(it => it.returnDamaged > 0) && (
                            <td className={isThermalMode ? "py-2 text-center text-xs font-black text-black" : "py-3 text-center text-xs font-black text-red-600"}>{item.returnDamaged}</td>
                          )}
                          {selectedInvoice.items.some(it => it.gifts > 0) && (
                            <td className={isThermalMode ? "py-2 text-center text-xs font-black text-black" : "py-3 text-center text-xs font-black text-green-600"}>{item.gifts}</td>
                          )}
                          <td className={isThermalMode ? "py-2 text-left text-xs font-black text-black" : "py-3 text-left font-black text-xs text-ink"}>{(item.total || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    {!isThermalMode && (
                      <tfoot>
                        <tr className="border-t-2 border-blue-100 bg-blue-50/30">
                          <td className="py-3 text-xs font-black text-ink">الإجمالي</td>
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
                    )}
                  </table>
                </div>

                <div className="flex justify-end">
                  <div className={isThermalMode ? "w-full space-y-1.5 text-black text-xs font-black" : "w-full space-y-3 bg-blue-50 p-6 rounded-[2rem] border-2 border-blue-100"}>
                    <div className="flex justify-between">
                      <span className={isThermalMode ? "text-black font-black" : "text-blue-500 font-bold"}>المجموع الفرعي</span>
                      <span className="font-black">{(selectedInvoice.subtotal || 0).toLocaleString()} ج.م</span>
                    </div>
                    {selectedInvoice.items.some(i => i.returnDamaged > 0) && (
                      <div className="flex justify-between">
                        <span className={isThermalMode ? "text-black font-black" : "text-blue-500 font-bold"}>قيمة المرتجع</span>
                        <span className="font-black text-black border-b border-black">-{(selectedInvoice.items.reduce((acc, item) => acc + ((item.returnDamaged || 0) * (item.price || 0)), 0)).toLocaleString()} ج.م</span>
                      </div>
                    )}
                    {selectedInvoice.items.some(i => i.gifts > 0) && (
                      <div className="flex justify-between">
                        <span className={isThermalMode ? "text-black font-black" : "text-blue-500 font-bold"}>قيمة الهدايا</span>
                        <span className="font-black text-black">+{(selectedInvoice.items.reduce((acc, item) => acc + ((item.gifts || 0) * (item.price || 0)), 0)).toLocaleString()} ج.م</span>
                      </div>
                    )}
                    {selectedInvoice.discountValue > 0 && (
                      <div className="flex justify-between">
                        <span className={isThermalMode ? "text-black font-black" : "text-blue-500 font-bold"}>الخصم</span>
                        <span className="font-black text-black">-{selectedInvoice.discountValue} {selectedInvoice.discountType === 'percentage' ? '%' : 'ج.م'}</span>
                      </div>
                    )}
                    {selectedInvoice.credit > 0 && (
                      <div className="flex justify-between">
                        <span className={isThermalMode ? "text-black font-black" : "text-blue-500 font-bold"}>آجل (مديونية)</span>
                        <span className="font-black text-black">-{selectedInvoice.credit || 0} ج.م</span>
                      </div>
                    )}
                    {selectedInvoice.collection > 0 && (
                      <div className="flex justify-between">
                        <span className={isThermalMode ? "text-black font-black" : "text-blue-500 font-bold"}>تحصيل (سداد قديم)</span>
                        <span className="font-black text-black">+{(selectedInvoice.collection || 0).toLocaleString()} ج.م</span>
                      </div>
                    )}
                    {selectedInvoice.walletAmount && selectedInvoice.walletAmount > 0 && (
                      <div className={isThermalMode ? "flex justify-between border-t-2 border-black pt-1.5" : "flex justify-between text-xs p-2 bg-purple-50 rounded-lg border border-purple-100"}>
                        <span className={isThermalMode ? "text-black font-black" : "text-purple-600 font-bold"}>تحويل محفظة</span>
                        <span className="font-black text-black">{(selectedInvoice.walletAmount || 0).toLocaleString()} ج.م</span>
                      </div>
                    )}
                    {(() => {
                      const balanceAfter = selectedInvoice.customerBalanceAfter !== undefined 
                        ? selectedInvoice.customerBalanceAfter 
                        : (() => {
                            const c = customers.find(cust => cust.id === selectedInvoice.customerId);
                            return c ? c.openingBalance : 0;
                          })();
                      
                      return isThermalMode ? (
                        <div className="pt-2 mt-2 border-t-3 border-black space-y-2 text-black">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-black">الرصيد النهائي للعميل</span>
                            <span className="text-base font-black underline decoration-2 underline-offset-4">{(balanceAfter || 0).toLocaleString()} ج.م</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-black">المحصل اليوم</span>
                            <span className="text-base font-black underline decoration-2 underline-offset-4">{(selectedInvoice.totalPaidToday || 0).toLocaleString()} ج.م</span>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-4 mt-4 border-t-2 border-blue-100 space-y-3">
                          <div className="flex justify-between items-center p-3.5 bg-blue-50/70 rounded-2xl border-2 border-blue-100/50">
                            <span className="font-black text-blue-900 text-sm">الرصيد النهائي للعميل</span>
                            <span className="text-lg font-black text-blue-600">{(balanceAfter || 0).toLocaleString()} ج.م</span>
                          </div>
                          <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="font-black text-slate-700 text-sm">المحصل اليوم</span>
                            <span className="text-lg font-black text-slate-900">{(selectedInvoice.totalPaidToday || 0).toLocaleString()} ج.م</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {btPrintStatus && (
                <div className="mx-auto mt-4 max-w-[500px] p-4 bg-blue-50 border-2 border-blue-200 text-blue-900 rounded-[1.5rem] text-xs font-bold flex items-center justify-center gap-3 animate-pulse print:hidden">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping"></div>
                  <span>{btPrintStatus}</span>
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-4 print:hidden">
                <button 
                  onClick={handleRawBTPrint} 
                  disabled={isBtPrinting}
                  className="flex-grow md:flex-1 min-w-[220px] py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-emerald-600/20 transition-all hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed text-base"
                >
                  <Printer size={22} className={isBtPrinting ? "animate-spin" : ""} />
                  <span>طباعة فورية</span>
                </button>

                <button 
                  onClick={handleDirectPrint} 
                  className="flex-1 min-w-[150px] py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-slate-900/10 transition-all text-base"
                >
                  <Printer size={22} />
                  <span>طباعة عادية 🖨️</span>
                </button>
                
                <button 
                  onClick={handleWhatsAppShare} 
                  disabled={isSharing}
                  className="flex-1 min-w-[130px] py-5 bg-green-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-green-600/20 transition-all hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-base"
                >
                  {isSharing ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div> : <MessageCircle size={22} />}
                  واتساب
                </button>
                
                {canEditInvoice && (
                  <button 
                    onClick={() => setIsEditModalOpen(true)} 
                    className="flex-grow md:flex-1 min-w-[130px] py-5 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-blue-600/20 transition-all hover:bg-blue-700 text-base"
                  >
                    <Edit3 size={22} />
                    تعديل الفاتورة
                  </button>
                )}

                {canDeleteInvoice && (
                  <button 
                    onClick={() => setIsDeleteConfirmOpen(true)} 
                    className="flex-1 min-w-[130px] py-5 bg-red-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-red-600/20 transition-all hover:bg-red-700 text-base"
                  >
                    <Trash2 size={22} />
                    حذف الفاتورة
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="حذف فاتورة"
        message={`هل أنت متأكد من حذف هذه الفاتورة نهائياً؟ لا يمكن التراجع عن هذه العملية وسيتم تحديث رصيد العميل بالخصم أو الإضافة بناءً على ذلك.`}
        onConfirm={handleDeleteInvoice}
        onCancel={() => setIsDeleteConfirmOpen(false)}
        isDestructive={true}
        confirmText={isDeleting ? "جاري الحذف..." : "حذف الفاتورة نهائياً"}
        loading={isDeleting}
      />

      <AnimatePresence>
        {isBtGuideOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-[550px] w-full border border-slate-100 shadow-2xl relative max-h-[90vh] overflow-y-auto text-right"
              dir="rtl"
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4">
                  <RefreshCcw size={28} className="animate-pulse" />
                </div>
                <h3 className="text-xl font-black text-slate-900 font-serif">دليل تشغيل الطباعة بالبلوتوث المباشر (بدون وسيط) ⚡</h3>
                <p className="text-xs text-slate-500 mt-1">اطبع فواتيرك فوراً من هاتفك دون الحاجة لأي برامج وسيطة مثل RawBT</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs space-y-1.5 font-bold">
                  <p className="flex items-center gap-1.5 text-sm font-black text-amber-950">
                    ⚠️ تنبيه أمني هام للمتصفحات:
                  </p>
                  <ul className="list-disc pr-4 space-y-1 text-xs font-semibold leading-relaxed">
                    <li><strong>تجنب استخدام المعاينة:</strong> يجب فتح التطبيق في صفحة خارجية مستقلة كاملة (وليس داخل نافذة المعاينة المصغرة بـ AI Studio). المتصفحات تحظر الاتصال بالبلوتوث لأسباب أمنية داخل إطارات المعاينة (iframe).</li>
                    <li><strong>نوع الهاتف:</strong> الطباعة المباشرة بالبلوتوث من المتصفح مدعومة في هواتف <strong>أندرويد</strong> والكمبيوتر. (هواتف آيفون iOS تحظر البلوتوث المباشر للمتصفحات من آبل).</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-black text-sm text-slate-800">🛠️ خطوات التشغيل والربط في ثوانٍ:</h4>
                  
                  <div className="flex gap-3 items-start p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5">1</div>
                    <div className="space-y-1">
                      <p className="text-xs font-black text-slate-900">افتح الرابط المباشر للتطبيق</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">انسخ رابط تطبيقك وافتحه في متصفح <strong>Google Chrome</strong> على هاتف الأندرويد:</p>
                      
                      <div className="flex items-center gap-2 mt-2 bg-white border border-slate-200 p-2 rounded-xl">
                        <span className="text-[10px] font-mono text-slate-600 truncate flex-1 select-all">
                          {window.location.origin}
                        </span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.origin);
                            showToast("تم نسخ رابط التشغيل بنجاح! 📋", "success");
                          }}
                          className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-bold hover:bg-slate-800 active:scale-95 shrink-0"
                        >
                          نسخ الرابط 📋
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5">2</div>
                    <div className="space-y-1">
                      <p className="text-xs font-black text-slate-900">شغّل البلوتوث والموقع الجغرافي (GPS)</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">تطلب هواتف أندرويد تفعيل الموقع لتتمكن متصفحات الويب من البحث عن أجهزة البلوتوث القريبة واقترانها.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5">3</div>
                    <div className="space-y-1">
                      <p className="text-xs font-black text-slate-900">اضغط "طباعة بلوتوث (مباشر)" واختر طابعتك</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">ستظهر قائمة منبثقة من جوجل كروم، اختر منها اسم طابعتك الحرارية واضغط (اقتران / Pair) لتبدأ الطباعة فوراً وبدون أي برامج وسيطة!</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setIsBtGuideOpen(false)}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm text-center active:scale-95 transition-all hover:bg-slate-800 shadow-xl shadow-slate-900/10"
                >
                  حسناً، فهمت الطريقة 👍
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <EditInvoiceModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        invoice={selectedInvoice}
        customers={customers}
        products={products}
        allUsers={allUsers}
        showToast={showToast}
        onSuccess={() => {
          setSelectedInvoice(null);
        }}
      />
    </div>
  );
}

function AttendanceTab({ allUsers, attendance, showToast, profile }: { 
  allUsers: UserProfile[], 
  attendance: Attendance[], 
  showToast: (m: string, t?: 'success' | 'error') => void,
  profile: UserProfile | null
}) {
  const [loading, setLoading] = useState(false);
  const today = format(new Date(), 'yyyy-MM-dd');
  const representatives = allUsers.filter(u => u.role === 'representative' && u.status !== 'inactive');

  const handleToggleAttendance = async (rep: UserProfile) => {
    setLoading(true);
    try {
      const existing = attendance.find(a => a.employeeId === rep.uid && a.date === today);
      if (existing) {
        if (existing.id) {
          await dataService.deleteAttendance(existing.id);
          showToast(`تم إلغاء حضور ${rep.name}`);
        }
      } else {
        await dataService.addAttendance({
          employeeId: rep.uid,
          employeeName: rep.name,
          date: today,
          timestamp: new Date().toISOString(),
          type: 'present'
        });
        
        // Create notification for representative
        if (profile) {
          await dataService.createNotification(
            'تأكيد الحضور',
            `تم تسجيل حضورك اليوم (${today}) بواسطة ${profile.name}`,
            'system',
            profile.uid,
            profile.name,
            'profile',
            rep.uid
          );
        }
        
        showToast(`تم تسجيل حضور ${rep.name}`);
      }
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تحديث الحضور', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-ink">تسجيل حضور المناديب</h2>
        <div className="bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100 flex items-center gap-2">
          <Calendar size={18} className="text-blue-400" />
          <span className="font-bold text-ink">{today}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {representatives.map(rep => {
          const isPresent = attendance.some(a => a.employeeId === rep.uid && a.date === today);
          return (
            <div key={rep.uid} className={cn(
              "p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between",
              isPresent ? "bg-green-50 border-green-100" : "bg-white border-accent/10"
            )}>
              <div>
                <div className="font-bold text-ink">{rep.name}</div>
                <div className="text-[10px] text-secondary/50 uppercase tracking-widest">{rep.role}</div>
              </div>
              <button 
                onClick={() => handleToggleAttendance(rep)}
                disabled={loading}
                className={cn(
                  "px-6 py-2 rounded-xl font-bold text-sm transition-all active:scale-95",
                  isPresent ? "bg-green-600 text-white shadow-lg shadow-green-600/20" : "bg-blue-50 text-blue-600 border border-blue-100"
                )}
              >
                {isPresent ? 'حاضر' : 'تسجيل حضور'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminTab({ mode, profile, showToast, settings, loans, attendance, settlements, invoices, customers, products, onUpdateProfile, masterRoutes = [] }: { 
  mode: 'users' | 'target' | 'loans' | 'salaries' | 'loading_requests' | 'wallet_confirmation',
  profile: UserProfile | null, 
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void,
  settings: Settings | null,
  loans: Loan[],
  attendance: Attendance[],
  settlements: DailySettlement[],
  invoices: Invoice[],
  customers: Customer[],
  products: Product[],
  onUpdateProfile?: (updated: UserProfile) => void,
  masterRoutes?: MasterRoute[]
}) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedUpgradeSql, setCopiedUpgradeSql] = useState(false);
  
  // New employee form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmp, setNewEmp] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'representative' as Role, 
    baseSalary: 0, 
    salaryType: 'monthly' as 'daily' | 'monthly',
    targetBonus: 0,
    routeId: '',
    routeName: ''
  });
  const [creating, setCreating] = useState(false);

  // Edit employee
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Delete confirmation
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Loans
  const [selectedUserForLoan, setSelectedUserForLoan] = useState<UserProfile | null>(null);
  const [loanAmount, setLoanAmount] = useState<number>(0);
  const [loanNote, setLoanNote] = useState('');
  const [isAddingLoan, setIsAddingLoan] = useState(false);

  // Target Setting
  const [dailyTarget, setDailyTarget] = useState(settings?.dailyTarget || 1000);
  const [companyPhone, setCompanyPhone] = useState(settings?.companyPhone || '01000000000');
  const [savingTarget, setSavingTarget] = useState(false);

  // View Profile
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);

  // Transfer Data
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSource, setTransferSource] = useState<UserProfile | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferType, setTransferType] = useState<'all' | 'day'>('all');
  const [transferDate, setTransferDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Salaries
  const [salaryMonth, setSalaryMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [processingSalary, setProcessingSalary] = useState<string | null>(null);

  const handleExportUsers = () => {
    try {
      const data = users.map(u => ({
        'الاسم': u.name,
        'البريد الإلكتروني': u.role === 'developer' && profile?.role === 'manager' ? 'مخفي' : u.email,
        'الدور الوظيفي': roleLabels[u.role],
        'الراتب الأساسي': u.baseSalary || 0,
        'نوع الراتب': u.salaryType === 'daily' ? 'يومي' : 'شهري',
        'عمولة التارجت': u.targetBonus || 0
      }));
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
      XLSX.writeFile(workbook, "employees_list.xlsx");
      showToast('تم تصدير قائمة الموظفين بنجاح');
    } catch (error) {
      showToast('خطأ في تصدير البيانات', 'error');
    }
  };

  const handleExportLoans = () => {
    try {
      const data = loans.map(l => ({
        'الموظف': l.employeeName,
        'المبلغ': l.amount,
        'التاريخ': l.date,
        'ملاحظات': l.note || '',
        'الحالة': l.status === 'approved' ? 'مقبول' : l.status === 'rejected' ? 'مرفوض' : l.status === 'paid' ? 'تم الصرف' : 'قيد الانتظار'
      }));
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Loans");
      XLSX.writeFile(workbook, "loans_list.xlsx");
      showToast('تم تصدير سجل السلف بنجاح');
    } catch (error) {
      showToast('خطأ في تصدير البيانات', 'error');
    }
  };

  const handleExportSalaries = () => {
    try {
      const data = users.filter(u => u.role !== 'manager').map(u => {
        const s = calculateSalary(u);
        return {
          'الموظف': u.name,
          'الدور': roleLabels[u.role],
          'أيام الحضور': s.daysInMonth,
          'الراتب الثابت المستحق': s.fixedEarned,
          'عمولة التارجت': s.targetEarned,
          'نسبة التحقيق': s.targetProgress.toFixed(1) + '%',
          'إجمالي المستحق': s.earned,
          'إجمالي السلف': s.totalLoans,
          'صافي الراتب': s.net
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Salaries");
      XLSX.writeFile(workbook, `salaries_${salaryMonth}.xlsx`);
      showToast('تم تصدير تقرير المرتبات بنجاح');
    } catch (error) {
      showToast('خطأ في تصدير البيانات', 'error');
    }
  };

  const calculateSalary = (user: UserProfile) => {
    const monthStr = salaryMonth;
    const daysInMonth = attendance.filter(a => 
      a.employeeId === user.uid && 
      a.date.startsWith(monthStr) && 
      a.type === 'present'
    ).length;

    const base = user.baseSalary || 0;
    const workingDaysCount = getWorkingDaysInMonth(monthStr);
    const fixedEarned = user.salaryType === 'daily' ? daysInMonth * base : (workingDaysCount > 0 ? (daysInMonth / workingDaysCount) * base : 0);
    
    // Target calculation
    const userInvoices = invoices.filter(inv => inv.representativeId === user.uid && inv.date.startsWith(monthStr));
    
    const totalSoldUnits = userInvoices.reduce((acc, inv) => acc + inv.items.reduce((sum, item) => sum + item.sold, 0), 0);
    const totalReturnedUnits = userInvoices.reduce((acc, inv) => acc + inv.items.reduce((sum, item) => sum + (item.returnDamaged || 0), 0), 0);
    const netSoldUnits = totalSoldUnits - totalReturnedUnits;
    
    const dailyTarget = settings?.dailyTarget || 1000;
    const monthlyTarget = dailyTarget * workingDaysCount;
    const targetProgress = monthlyTarget > 0 ? (netSoldUnits / monthlyTarget) : 0;
    
    const targetEarned = (user.targetBonus || 0) * targetProgress;
    const earned = fixedEarned + targetEarned;
    
    const userLoans = loans.filter(l => 
      l.employeeId === user.uid && 
      l.status === 'approved'
    );
    const totalLoans = userLoans.reduce((acc, l) => acc + l.amount, 0);
    
    return {
      daysInMonth,
      fixedEarned,
      targetEarned,
      earned,
      totalLoans,
      net: earned - totalLoans,
      pendingLoans: userLoans,
      targetProgress: targetProgress * 100,
      workingDaysCount
    };
  };

  const handlePaySalary = async (user: UserProfile) => {
    const salary = calculateSalary(user);
    if (salary.net < 0) {
      showToast('الراتب المستحق بالسالب بسبب السلف!', 'error');
      return;
    }

    setProcessingSalary(user.uid);
    try {
      // Mark all approved loans as paid
      const loanIds = salary.pendingLoans.map(l => l.id!).filter(id => !!id);
      if (loanIds.length > 0) {
        await dataService.paySalary(loanIds);
      }
      
      // Create a notification
      await dataService.createNotification(
        'تم صرف الراتب',
        `تم صرف راتب شهر ${salaryMonth} بقيمة ${salary.net.toLocaleString()} ج.م (ثابت: ${salary.fixedEarned.toLocaleString()} + تارجت: ${salary.targetEarned.toLocaleString()}) بعد خصم السلف`,
        'system',
        profile?.uid || '',
        profile?.name || 'النظام',
        'profile',
        user.uid
      );

      showToast(`تم صرف راتب ${user.name} بنجاح`);
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء صرف الراتب', 'error');
    } finally {
      setProcessingSalary(null);
    }
  };

  useEffect(() => {
    if (settings) {
      setDailyTarget(settings.dailyTarget);
      setCompanyPhone(settings.companyPhone || '01000000000');
    }
  }, [settings]);

  useEffect(() => {
    const unsub = dataService.getUsers((data) => {
      const filtered = (data as UserProfile[]).filter(u => u.role !== 'developer' || profile?.role === 'developer');
      setUsers(filtered);
      setLoading(false);
    });
    return () => unsub();
  }, [profile]);

  const handleUpdateTarget = async () => {
    setSavingTarget(true);
    try {
      await dataService.updateSettings('global', { 
        dailyTarget,
        companyPhone
      });
      showToast('تم تحديث إعدادات النظام بنجاح!');
    } catch (err: any) {
      console.error(err);
      showToast('خطأ في الحفظ: ' + (err.message || 'مشكلة في الاتصال'), 'error');
    } finally {
      setSavingTarget(false);
    }
  };

  const handleSetFactoryLocation = async () => {
    if (!navigator.geolocation) {
      showToast('المتصفح لا يدعم تحديد الموقع', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        await dataService.updateSettings('global', { 
          factoryLocation: { lat: latitude, lng: longitude } 
        });
        showToast('تم تحديد موقع المصنع بنجاح');
      } catch (error: any) {
        console.error('Error setting factory location:', error);
        showToast('خطأ في قاعدة البيانات: ' + (error.message || 'فشل الحفظ'), 'error');
      }
    }, (err) => {
      console.error('Geolocation error:', err);
      let msg = 'يرجى السماح بالوصول للموقع';
      if (err.code === 1) msg = 'تم رفض الوصول للموقع - يرجى تفعيله من إعدادات المتصفح';
      if (err.code === 2) msg = 'موقع الجهاز غير متاح حالياً';
      if (err.code === 3) msg = 'انتهت مهلة تحديد الموقع';
      showToast(msg, 'error');
    }, { timeout: 10000 });
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmp.password.length < 6) {
      showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
      return;
    }
    if (newEmp.role === 'developer' && profile?.role !== 'developer') {
      showToast('غير مسموح بإضافة مطور', 'error');
      return;
    }
    setCreating(true);
    try {
      console.log('Starting employee creation for:', newEmp.email);
      
      // Generate a valid UUID for database-only login
      // This ensures compatibility with database columns of type UUID
      const randomUid = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : '00000000-0000-4000-a000-' + Math.random().toString(16).slice(2, 14);

      await dataService.createUserProfile(randomUid, {
        uid: randomUid,
        name: newEmp.name,
        email: newEmp.email,
        password: newEmp.password,
        role: newEmp.role,
        baseSalary: newEmp.baseSalary,
        salaryType: newEmp.salaryType,
        targetBonus: newEmp.targetBonus,
        status: 'active',
        routeId: newEmp.routeId || '',
        routeName: newEmp.routeName || ''
      });
      console.log('User profile created in database with UID:', randomUid);
      
      showToast('تم إضافة الموظف بنجاح! يمكنه الدخول الآن ببياناته.');
      setNewEmp({ name: '', email: '', password: '', role: 'representative', baseSalary: 0, salaryType: 'monthly', targetBonus: 0, routeId: '', routeName: '' });
      setShowAddForm(false);
    } catch (err: any) {
      console.error(err);
      if (err.message && (err.message.includes('users_role_check') || err.message.includes('violates check constraint'))) {
        showToast('خطأ في قاعدة البيانات: لم يتم تفعيل الدور الجديد بقاعدة بياناتك بعد. يرجى نسخ وتشغيل كود الترقية (SQL Patch) الموجود أسفل صفحة إدارة الموظفين.', 'error');
      } else {
        showToast('حدث خطأ أثناء إضافة الموظف: ' + err.message, 'error');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    // Check if trying to edit a master account
    const masterEmails = ['okapp974@gmail.com', 'okkapp974@gmail.com', 'admin@ok.com', 'mohsen@ok.com'];
    if (masterEmails.includes(editingUser.email) && !masterEmails.includes(profile?.email || '')) {
      showToast('لا يمكنك تعديل بيانات هذا الحساب الصلاحيات محدودة', 'error');
      return;
    }

    if (editingUser.role === 'developer' && profile?.role !== 'developer') {
      showToast('غير مسموح بترقية موظف لمطور', 'error');
      return;
    }

    try {
      await dataService.updateUser(editingUser.uid, {
        name: editingUser.name,
        role: editingUser.role,
        password: editingUser.password,
        baseSalary: editingUser.baseSalary || 0,
        salaryType: editingUser.salaryType || 'monthly',
        targetBonus: editingUser.targetBonus || 0,
        routeId: editingUser.routeId || '',
        routeName: editingUser.routeName || ''
      });
      showToast('تم تحديث بيانات الموظف بنجاح!');
      if (onUpdateProfile && profile && (editingUser.uid === profile.uid || (editingUser.email && profile.email && editingUser.email.toLowerCase() === profile.email.toLowerCase()))) {
        onUpdateProfile({ ...profile, ...editingUser });
        const savedSession = localStorage.getItem('ok_app_db_user');
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            parsed.sessionPassword = editingUser.password;
            localStorage.setItem('ok_app_db_user', JSON.stringify(parsed));
          } catch (e) {}
        }
      }
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء التحديث', 'error');
    }
  };

  const confirmDelete = (u: UserProfile) => {
    if (u.uid === profile?.uid) {
      showToast('لا يمكنك حذف حسابك الخاص من هنا', 'error');
      return;
    }
    const masterEmails = ['okapp974@gmail.com', 'okkapp974@gmail.com', 'admin@ok.com', 'mohsen@ok.com'];
    if (masterEmails.includes(u.email)) {
      showToast('لا يمكن حذف حساب الإدارة أو المطور', 'error');
      return;
    }
    if (u.role === 'developer' && profile?.role !== 'developer') {
      showToast('لا يمكنك حذف حساب المطور الصلاحيات محدودة', 'error');
      return;
    }
    setUserToDelete(u);
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    const isDeletedCurrentUser = userToDelete.uid === profile?.uid;

    try {
      // Try to delete from Auth if it's a real Auth user
      // If it's a database-only user (randomly generated ID), this might fail or be skipped
      // UUIDs are typically 36 characters long with hyphens
      const isRandomId = userToDelete.uid.includes('-');
      if (!isRandomId) {
        try {
          await authService.deleteUser(userToDelete.email, userToDelete.password);
        } catch (authErr) {
          console.warn('Could not delete from Supabase Auth, might be a DB-only user:', authErr);
        }
      }
      
      // Always delete from database
      try {
        await dataService.deleteUser(userToDelete.uid);
        showToast('تم حذف الموظف بنجاح من النظام.');
      } catch (dbErr: any) {
        console.warn('Database deletion failed, attempting deactivation:', dbErr);
        // Error code 23503 is foreign key violation in Postgres
        if (dbErr.code === '23503' || dbErr.message?.includes('violates foreign key constraint') || dbErr.message?.includes('foreign key')) {
          await dataService.updateUser(userToDelete.uid, { status: 'inactive' });
          showToast('لا يمكن حذف الموظف لوجود سجلات مرتبطة به. تم تعطيل الحساب بدلاً من الحذف.');
        } else {
          throw dbErr;
        }
      }
      
      setIsConfirmOpen(false);
      setUserToDelete(null);

      if (isDeletedCurrentUser) {
        showToast('تم حذف أو تعطيل حسابك الحالي، جاري تسجيل الخروج...', 'error');
        await authService.signOut();
      }
    } catch (err: any) {
      console.error(err);
      showToast('حدث خطأ أثناء الحذف: ' + err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForLoan || loanAmount <= 0) return;
    setIsAddingLoan(true);
    try {
      const newLoan: Loan = {
        employeeId: selectedUserForLoan.uid,
        employeeName: selectedUserForLoan.name,
        amount: loanAmount,
        date: format(new Date(), 'yyyy-MM-dd'),
        timestamp: new Date().toISOString(),
        note: loanNote,
        status: 'pending'
      };
      await dataService.addLoan(newLoan);
      showToast('تم إضافة السلفة بنجاح!');
      setSelectedUserForLoan(null);
      setLoanAmount(0);
      setLoanNote('');
    } catch (err) {
      showToast('حدث خطأ أثناء إضافة السلفة', 'error');
    } finally {
      setIsAddingLoan(false);
    }
  };

  const handleUpdateLoanStatus = async (loanId: string, newStatus: LoanStatus, employeeId: string, amount: number) => {
    console.log('Updating loan status:', loanId, newStatus);
    try {
      await dataService.updateLoan(loanId, { status: newStatus });
      showToast(newStatus === 'approved' ? 'تمت الموافقة على السلفة' : 'تم رفض السلفة');
      
      // Create notification for employee
      if (profile) {
        await dataService.createNotification(
          newStatus === 'approved' ? 'تمت الموافقة على السلفة' : 'تم رفض طلب السلفة',
          `تم ${newStatus === 'approved' ? 'قبول' : 'رفض'} طلب السلفة الخاص بك بقيمة ${amount} ج.م`,
          'loan',
          profile.uid,
          profile.name,
          'profile',
          employeeId
        );
      }
    } catch (err) {
      showToast('حدث خطأ أثناء تحديث حالة السلفة', 'error');
    }
  };

  const handleTransferData = async () => {
    if (!transferSource || !transferTargetId) {
      showToast('يرجى اختيار المندوب الجديد', 'error');
      return;
    }

    const targetUser = users.find(u => u.uid === transferTargetId);
    if (!targetUser) return;

    setIsTransferring(true);
    try {
      if (transferType === 'day') {
        await dataService.transferRepresentativeInvoicesForDay(transferSource.uid, targetUser, transferDate);
        showToast(`تم نقل مبيعات يوم ${transferDate} بنجاح من ${transferSource.name} إلى ${targetUser.name}`);
      } else {
        await dataService.transferRepresentativeData(transferSource.uid, targetUser);
        showToast(`تم نقل السجلات بنجاح من ${transferSource.name} إلى ${targetUser.name}`);
      }
      setIsTransferModalOpen(false);
      setTransferSource(null);
      setTransferTargetId('');
    } catch (err) {
      console.error('Error transferring data:', err);
      showToast('حدث خطأ أثناء نقل البيانات', 'error');
    } finally {
      setIsTransferring(false);
    }
  };

  const roleLabels: Record<Role, string> = {
    manager: 'مدير',
    accountant: 'محاسب',
    supervisor: 'مشرف',
    representative: 'مندوب',
    backup_representative: 'مندوب احتياطي',
    storekeeper: 'مخزن',
    developer: 'مطور'
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {viewingProfile ? (
        <div className="space-y-6">
          <button 
            onClick={() => setViewingProfile(null)}
            className="flex items-center gap-2 text-primary font-bold hover:underline mb-4"
          >
            <ChevronRight size={20} />
            العودة لإدارة الموظفين
          </button>
          <ProfileTab 
            profile={viewingProfile} 
            showToast={showToast} 
            loans={loans} 
            attendance={attendance} 
            settlements={settlements} 
            invoices={invoices} 
            customers={customers} 
            products={products} 
            settings={settings} 
          />
        </div>
      ) : (
        <>
          {mode === 'target' && (
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-accent/10 mb-6">
              <h3 className="text-lg font-serif font-black text-ink mb-4">إعدادات النظام</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                    <Target size={16} />
                    إعدادات الفاتورة والتارجت اليومي
                  </h4>
                  <div className="space-y-4">
                    <div className="w-full">
                      <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">عدد العلب اليومي (صافي)</label>
                      <input 
                        type="number" 
                        value={dailyTarget || ''} 
                        onChange={e => setDailyTarget(parseInt(e.target.value) || 0)} 
                        className="input-field" 
                        placeholder="مثلاً 1000" 
                      />
                    </div>
                    <div className="w-full">
                      <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">رقم تليفون الشركة للفاتورة</label>
                      <input 
                        type="text" 
                        value={companyPhone || ''} 
                        onChange={e => setCompanyPhone(e.target.value)} 
                        className="input-field" 
                        placeholder="مثلاً 01027137000" 
                      />
                    </div>
                    <button 
                      onClick={handleUpdateTarget}
                      disabled={savingTarget}
                      className="btn-primary flex items-center justify-center gap-2 w-full h-[52px]"
                    >
                      {savingTarget ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div> : <Save size={18} />}
                      حفظ الإعدادات
                    </button>
                  </div>
                  <p className="text-[10px] text-secondary/50 mt-2 italic">* يتم حساب التارجت الشهري بضرب هذا الرقم في عدد أيام العمل (باستثناء أيام الجمعة).</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                    <MapPin size={16} />
                    موقع المصنع
                  </h4>
                  <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10">
                    <p className="text-xs text-secondary/60 mb-4">يستخدم موقع المصنع كنقطة انطلاق لخطوط سير المناديب على الخريطة.</p>
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={handleSetFactoryLocation}
                        className="btn-secondary flex items-center justify-center gap-2 w-full"
                      >
                        <MapPin size={18} />
                        تحديد موقع المصنع (الموقع الحالي)
                      </button>
                      {settings?.factoryLocation && (
                        <div className="flex items-center justify-between text-[10px] font-bold text-primary px-2">
                          <span>الموقع الحالي:</span>
                          <span>{settings.factoryLocation.lat.toFixed(4)}, {settings.factoryLocation.lng.toFixed(4)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {mode === 'salaries' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-ink">إدارة المرتبات</h2>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleExportSalaries}
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 active:scale-95"
                  >
                    <Download size={18} />
                    <span className="text-sm">تصدير إكسيل</span>
                  </button>
                  <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-accent/10 shadow-sm">
                    <Calendar size={18} className="text-primary mr-2" />
                    <input 
                      type="month" 
                      value={salaryMonth} 
                      onChange={e => setSalaryMonth(e.target.value)}
                      className="bg-transparent border-none focus:ring-0 font-bold text-sm text-secondary"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 px-2">
                {users.filter(u => u.role !== 'manager').map(u => {
                  const salary = calculateSalary(u);
                  return (
                    <div key={u.uid} className="bg-white p-6 rounded-[2rem] shadow-sm border border-accent/10 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-bg rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors overflow-hidden">
                          {u.photoURL ? (
                            <img 
                              src={u.photoURL} 
                              alt={u.name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <UserIcon size={24} />
                          )}
                        </div>
                        <div>
                          <h3 className="font-serif font-bold text-lg text-ink">{u.name}</h3>
                          <p className="text-[10px] text-secondary/50 uppercase tracking-widest">{roleLabels[u.role]}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 flex-1 lg:px-8 justify-center lg:justify-end">
                        <div className="min-w-[70px] text-center lg:text-right">
                          <p className="text-[9px] font-bold text-secondary/40 uppercase tracking-widest mb-0.5">أيام الحضور</p>
                          <p className="text-sm font-bold text-ink">{salary.daysInMonth} يوم</p>
                        </div>
                        <div className="min-w-[90px] text-center lg:text-right">
                          <p className="text-[9px] font-bold text-secondary/40 uppercase tracking-widest mb-0.5">الراتب الثابت</p>
                          <p className="text-sm font-bold text-ink whitespace-nowrap">{salary.fixedEarned.toLocaleString()} ج.م</p>
                          {u.salaryType === 'monthly' && salary.daysInMonth > 0 && (
                            <p className="text-[8px] text-secondary/30 font-bold leading-none">نسبة: {((salary.daysInMonth / salary.workingDaysCount) * 100).toFixed(0)}%</p>
                          )}
                        </div>
                        <div className="min-w-[90px] text-center lg:text-right">
                          <p className="text-[9px] font-bold text-secondary/40 uppercase tracking-widest mb-0.5">عمولة التارجت</p>
                          <p className="text-sm font-bold text-green-600 whitespace-nowrap">+{salary.targetEarned.toLocaleString()} ج.م</p>
                          <p className="text-[8px] text-secondary/30 font-bold leading-none">تحقيق: {salary.targetProgress.toFixed(1)}%</p>
                        </div>
                        <div className="min-w-[90px] text-center lg:text-right">
                          <p className="text-[9px] font-bold text-secondary/40 uppercase tracking-widest mb-0.5">إجمالي السلف</p>
                          <p className="text-sm font-bold text-red-500 whitespace-nowrap">{salary.totalLoans.toLocaleString()} ج.م</p>
                        </div>
                        <div className="min-w-[110px] bg-primary/5 p-2 rounded-xl border border-primary/10 text-center lg:text-right">
                          <p className="text-[9px] font-bold text-primary/60 uppercase tracking-widest mb-0.5">صافي المستحق</p>
                          <p className="text-base font-black text-primary whitespace-nowrap">{salary.net.toLocaleString()} ج.م</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => handlePaySalary(u)}
                        disabled={processingSalary === u.uid || salary.net <= 0}
                        className={cn(
                          "btn-primary flex items-center justify-center gap-2 md:w-48",
                          salary.net <= 0 && "opacity-50 cursor-not-allowed bg-gray-300 shadow-none"
                        )}
                      >
                        {processingSalary === u.uid ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                        ) : (
                          <>
                            <Wallet size={18} />
                            صرف الراتب
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {mode === 'users' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-ink">إدارة الموظفين</h2>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      setShowAddForm(!showAddForm);
                      setEditingUser(null);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
                  >
                    <Plus size={18} />
                    <span>إضافة موظف جديد</span>
                  </button>
                  <button 
                    onClick={handleExportUsers}
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 active:scale-95"
                  >
                    <Download size={18} />
                    <span>تصدير إكسيل</span>
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {showAddForm && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="px-2"
                  >
                    <form onSubmit={handleAddEmployee} className="bg-bg/50 p-6 md:p-8 rounded-[2.5rem] border border-accent/10 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">الاسم الكامل</label>
                          <input required type="text" value={newEmp.name} onChange={e => setNewEmp({...newEmp, name: e.target.value})} className="input-field" placeholder="مثلاً محمد أحمد" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">البريد الإلكتروني (لتسجيل الدخول)</label>
                          <input required type="email" value={newEmp.email} onChange={e => setNewEmp({...newEmp, email: e.target.value})} className="input-field" placeholder="email@example.com" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">كلمة المرور (6 أحرف على الأقل)</label>
                          <input required type="password" value={newEmp.password} onChange={e => setNewEmp({...newEmp, password: e.target.value})} className="input-field" placeholder="••••••••" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">الدور الوظيفي</label>
                          <select value={newEmp.role || 'representative'} onChange={e => setNewEmp({...newEmp, role: e.target.value as Role})} className="input-field appearance-none">
                            {Object.entries(roleLabels)
                              .filter(([val]) => val !== 'developer' || profile?.role === 'developer')
                              .map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">خط السير المرتبط</label>
                          <select 
                            value={newEmp.routeId || ''} 
                            onChange={e => {
                              const selected = masterRoutes.find(r => r.id === e.target.value);
                              setNewEmp({
                                ...newEmp, 
                                routeId: e.target.value, 
                                routeName: selected?.name || ''
                              });
                            }} 
                            className="input-field appearance-none"
                          >
                            <option value="">بدون خط سير محدد</option>
                            {masterRoutes.map(r => (
                              <option key={r.id} value={r.id}>{r.name} {r.code ? `(${r.code})` : ''}</option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">الراتب الثابت</label>
                            <input required type="number" value={newEmp.baseSalary || ''} onChange={e => setNewEmp({...newEmp, baseSalary: parseFloat(e.target.value) || 0})} className="input-field" placeholder="0.00" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">نوع الراتب</label>
                            <select value={newEmp.salaryType || 'monthly'} onChange={e => setNewEmp({...newEmp, salaryType: e.target.value as 'daily' | 'monthly'})} className="input-field appearance-none">
                              <option value="monthly">شهري ثابت</option>
                              <option value="daily">يومي (حسب الحضور)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">عمولة التارجت (عند 100%)</label>
                            <input required type="number" value={newEmp.targetBonus || ''} onChange={e => setNewEmp({...newEmp, targetBonus: parseFloat(e.target.value) || 0})} className="input-field" placeholder="0.00" />
                          </div>
                        </div>
                        <div className="pt-2">
                          <p className="text-[10px] text-red-500 font-bold mb-2 text-center">
                            * تنبيه: عند الضغط على "إضافة"، سيتم تسجيل خروجك تلقائياً لتأمين الحساب الجديد.
                          </p>
                          <button disabled={creating} type="submit" className="w-full btn-primary flex items-center justify-center gap-2">
                            {creating ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div> : <Save size={18} />}
                            إضافة الموظف الآن
                          </button>
                        </div>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {editingUser && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="px-2"
                  >
                    <form onSubmit={handleUpdateUser} className="bg-bg/50 p-6 md:p-8 rounded-[2.5rem] border border-accent/10 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">تعديل الاسم</label>
                          <input required type="text" value={editingUser.name || ''} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="input-field" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">البريد (ثابت)</label>
                          <input disabled type="email" value={editingUser.email || ''} className="input-field opacity-50 bg-bg" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">تعديل الدور</label>
                          <select value={editingUser.role || 'representative'} onChange={e => setEditingUser({...editingUser, role: e.target.value as Role})} className="input-field appearance-none">
                            {Object.entries(roleLabels)
                              .filter(([val]) => val !== 'developer' || profile?.role === 'developer')
                              .map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">تعديل خط السير المرتبط</label>
                          <select 
                            value={editingUser.routeId || ''} 
                            onChange={e => {
                              const selected = masterRoutes.find(r => r.id === e.target.value);
                              setEditingUser({
                                ...editingUser, 
                                routeId: e.target.value, 
                                routeName: selected?.name || ''
                              });
                            }} 
                            className="input-field appearance-none"
                          >
                            <option value="">بدون خط سير محدد</option>
                            {masterRoutes.map(r => (
                              <option key={r.id} value={r.id}>{r.name} {r.code ? `(${r.code})` : ''}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">كلمة المرور</label>
                          <input required type="text" value={editingUser.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})} className="input-field" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">الراتب الثابت</label>
                            <input required type="number" value={editingUser.baseSalary || ''} onChange={e => setEditingUser({...editingUser, baseSalary: parseFloat(e.target.value) || 0})} className="input-field" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">نوع الراتب</label>
                            <select value={editingUser.salaryType || 'monthly'} onChange={e => setEditingUser({...editingUser, salaryType: e.target.value as 'daily' | 'monthly'})} className="input-field appearance-none">
                              <option value="monthly">شهري ثابت</option>
                              <option value="daily">يومي (حسب الحضور)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">عمولة التارجت (عند 100%)</label>
                            <input required type="number" value={editingUser.targetBonus || ''} onChange={e => setEditingUser({...editingUser, targetBonus: parseFloat(e.target.value) || 0})} className="input-field" />
                          </div>
                        </div>
                        <div className="pt-2 flex gap-3">
                          <button type="submit" className="flex-1 btn-primary flex items-center justify-center gap-2">
                            <Check size={18} />
                            حفظ التعديلات
                          </button>
                          <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-3 bg-white text-secondary border border-accent/10 rounded-2xl font-bold active:scale-95">
                            إلغاء
                          </button>
                        </div>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="px-2">
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-accent/10 overflow-hidden">
                  <div className="hidden md:block">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-bg/50 border-b border-accent/10">
                          <th className="p-6 font-bold text-secondary/60 uppercase text-[10px] tracking-widest">الموظف</th>
                          <th className="p-6 font-bold text-secondary/60 uppercase text-[10px] tracking-widest">الدور</th>
                          <th className="p-6 font-bold text-secondary/60 uppercase text-[10px] tracking-widest">كلمة المرور</th>
                          <th className="p-6 font-bold text-secondary/60 uppercase text-[10px] tracking-widest">الحالة</th>
                          <th className="p-6 font-bold text-secondary/60 uppercase text-[10px] tracking-widest text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.uid} className="border-b border-accent/5 hover:bg-bg/40 transition-colors">
                            <td className="p-6">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-bg rounded-xl flex items-center justify-center text-primary overflow-hidden border border-accent/5">
                                  {u.photoURL ? (
                                    <img 
                                      src={u.photoURL} 
                                      alt={u.name} 
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <UserIcon size={18} />
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-sm text-ink">{u.name}</div>
                                  <div className="text-[10px] text-secondary/50 font-mono">{u.role === 'developer' && profile?.role === 'manager' ? '•••••••••' : u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-6">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                                u.role === 'manager' ? "bg-primary/10 text-primary" :
                                u.role === 'accountant' ? "bg-blue-100 text-blue-600" :
                                u.role === 'representative' ? "bg-secondary/10 text-secondary" :
                                "bg-gray-100 text-gray-600"
                              )}>
                                {roleLabels[u.role]}
                              </span>
                            </td>
                            <td className="p-6">
                              <div className="font-mono text-xs text-secondary/60">{u.role === 'developer' && profile?.role === 'manager' ? '•••••••••' : (u.password || 'غير مسجلة')}</div>
                            </td>
                            <td className="p-6">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter",
                                (u.status === 'inactive') ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                              )}>
                                {u.status === 'inactive' ? 'غير نشط' : 'نشط'}
                              </span>
                            </td>
                            <td className="p-6">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => setViewingProfile(u)}
                                  className="p-2.5 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                                  title="عرض الملف الشخصي والإحصائيات"
                                >
                                  <UserIcon size={18} />
                                </button>
                                <button 
                                  onClick={() => {
                                    setEditingUser(u);
                                    setShowAddForm(false);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="p-2.5 text-primary hover:bg-primary/5 rounded-xl transition-all"
                                  title="تعديل"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button 
                                  onClick={() => setSelectedUserForLoan(u)}
                                  className="p-2.5 text-orange-500 hover:bg-orange-50 rounded-xl transition-all"
                                  title="إضافة سلفة"
                                >
                                  <Clock size={18} />
                                </button>
                                <button 
                                  onClick={() => {
                                    setTransferSource(u);
                                    setIsTransferModalOpen(true);
                                  }}
                                  className="p-2.5 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                  title="نقل البيانات لموظف آخر"
                                >
                                  <RefreshCcw size={18} />
                                </button>
                                <button 
                                  onClick={() => confirmDelete(u)}
                                  className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                  title="حذف"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden divide-y divide-accent/5">
                    {users.map(u => (
                      <div key={u.uid} className="p-4 flex items-center justify-between hover:bg-bg/20 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-bg rounded-xl flex items-center justify-center text-primary overflow-hidden border border-accent/5">
                            {u.photoURL ? (
                              <img 
                                src={u.photoURL} 
                                alt={u.name} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <UserIcon size={18} />
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="font-bold text-sm text-ink">{u.name}</div>
                            <div className="text-[10px] text-secondary/60 font-mono">{u.role === 'developer' && profile?.role === 'manager' ? '•••••••••' : u.email}</div>
                            <div className="text-[10px] text-primary font-bold">كلمة المرور: {u.role === 'developer' && profile?.role === 'manager' ? '•••••••••' : (u.password || '---')}</div>
                            <div className="pt-1 flex gap-1">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter",
                                u.role === 'manager' ? "bg-primary/10 text-primary" :
                                u.role === 'accountant' ? "bg-blue-100 text-blue-600" :
                                u.role === 'representative' ? "bg-secondary/10 text-secondary" :
                                "bg-gray-100 text-gray-600"
                              )}>
                                {roleLabels[u.role]}
                              </span>
                              {u.status === 'inactive' && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-red-100 text-red-600">
                                  غير نشط
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => setViewingProfile(u)}
                            className="p-3 text-indigo-500 active:bg-indigo-50 rounded-2xl transition-all"
                            title="عرض الملف الشخصي والإحصائيات"
                          >
                            <UserIcon size={20} />
                          </button>
                          <button 
                            onClick={() => {
                              setEditingUser(u);
                              setShowAddForm(false);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="p-3 text-primary active:bg-primary/10 rounded-2xl transition-all"
                            title="تعديل"
                          >
                            <Edit2 size={20} />
                          </button>
                          <button 
                            onClick={() => {
                              setTransferSource(u);
                              setIsTransferModalOpen(true);
                            }}
                            className="p-3 text-blue-500 active:bg-blue-50 rounded-2xl transition-all"
                            title="نقل البيانات لموظف آخر"
                          >
                            <RefreshCcw size={20} />
                          </button>
                          <button 
                            onClick={() => confirmDelete(u)}
                            className="p-3 text-red-500 active:bg-red-50 rounded-2xl transition-all"
                            title="حذف"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transfer Data Modal */}
              <AnimatePresence>
                {isTransferModalOpen && transferSource && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-accent/10"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                          <RefreshCcw size={24} />
                        </div>
                        <div>
                          <h3 className="text-xl font-serif font-black text-ink">نقل بيانات الموظف</h3>
                          <p className="text-xs text-secondary/60">سيتم نقل جميع العملاء والفواتير والعهد</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="p-4 bg-bg rounded-2xl border border-accent/5">
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">المصدر (الموظف القديم)</label>
                          <div className="font-bold text-ink">{transferSource.name}</div>
                          <div className="text-[10px] text-secondary/50">{transferSource.role === 'developer' && profile?.role === 'manager' ? '•••••••••' : transferSource.email}</div>
                        </div>

                        <div className="flex justify-center">
                          <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center text-secondary">
                            <ChevronLeft size={20} className="rotate-90 md:rotate-0" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">المستقبل (الموظف الجديد)</label>
                          <select 
                            value={transferTargetId || ''} 
                            onChange={e => setTransferTargetId(e.target.value)}
                            className="input-field appearance-none"
                          >
                            <option value="">اختر الموظف الجديد...</option>
                            {users.filter(u => u.uid !== transferSource.uid && (u.role !== 'developer' || profile?.role === 'developer')).map(u => (
                              <option key={u.uid} value={u.uid}>{u.name} ({roleLabels[u.role] || u.role})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">نوع عملية النقل</label>
                          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setTransferType('all')}
                              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${transferType === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                              كل البيانات والعملاء
                            </button>
                            <button
                              type="button"
                              onClick={() => setTransferType('day')}
                              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${transferType === 'day' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                              مبيعات يوم محدد 📅
                            </button>
                          </div>
                        </div>

                        {transferType === 'day' && (
                          <div>
                            <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">اختر تاريخ اليوم المراد نقله</label>
                            <input 
                              type="date" 
                              value={transferDate} 
                              onChange={e => setTransferDate(e.target.value)} 
                              className="input-field" 
                            />
                          </div>
                        )}

                        <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                          <p className="text-[10px] text-orange-700 font-bold leading-relaxed">
                            {transferType === 'day' 
                              ? `تنبيه: هذه العملية ستقوم بنقل الفواتير والتحصيلات والعهد والسيارات الخاصة باليوم المحدد (${transferDate}) فقط من المندوب ${transferSource.name} لتصبح باسم الموظف الجديد.`
                              : `تنبيه: هذه العملية ستقوم بتغيير ملكية جميع السجلات التاريخية والعملاء والعهد المرتبطة بـ ${transferSource.name} لتصبح باسم الموظف الجديد.`
                            } لا يمكن التراجع عن هذه الخطوة بسهولة.
                          </p>
                        </div>

                        <div className="flex gap-3">
                          <button 
                            onClick={handleTransferData}
                            disabled={isTransferring || !transferTargetId}
                            className="flex-1 btn-primary flex items-center justify-center gap-2"
                          >
                            {isTransferring ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div> : <Check size={18} />}
                            تأكيد النقل الآن
                          </button>
                          <button 
                            onClick={() => {
                              setIsTransferModalOpen(false);
                              setTransferSource(null);
                              setTransferTargetId('');
                            }}
                            className="flex-1 py-3 bg-white text-secondary border border-accent/10 rounded-2xl font-bold active:scale-95"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>


              </div>
            )}


          {mode === 'loading_requests' && (
            <LoadingRequestsAdmin showToast={showToast} profile={profile} customers={customers} />
          )}

          {mode === 'wallet_confirmation' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-ink">تأكيد تحويلات المحفظة</h2>
                <div className="bg-purple-50 text-purple-600 px-4 py-2 rounded-xl font-bold text-sm border border-purple-100 flex items-center gap-2">
                  <Wallet size={18} />
                  <span>قيد الانتظار: {invoices.filter(inv => (inv.walletAmount || 0) > 0 && !inv.isWalletConfirmed).length}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 px-2">
                {invoices
                  .filter(inv => (inv.walletAmount || 0) > 0 && !inv.isWalletConfirmed)
                  .sort((a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp))
                  .map(inv => (
                    <div key={inv.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-accent/10 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                          <Wallet size={24} />
                        </div>
                        <div>
                          <h3 className="font-serif font-bold text-lg text-ink">{inv.customerName}</h3>
                          <p className="text-[10px] text-secondary/50 uppercase tracking-widest">المندوب: {inv.representativeName}</p>
                          <p className="text-[10px] text-secondary/50 uppercase tracking-widest">التاريخ: {inv.date}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 flex-1 lg:px-8 justify-center lg:justify-end">
                        <div className="text-center lg:text-right">
                          <p className="text-[9px] font-bold text-secondary/40 uppercase tracking-widest mb-0.5">مبلغ المحفظة</p>
                          <p className="text-xl font-black text-purple-600">{inv.walletAmount?.toLocaleString()} ج.م</p>
                        </div>
                        <div className="text-center lg:text-right">
                          <p className="text-[9px] font-bold text-secondary/40 uppercase tracking-widest mb-0.5">إجمالي الفاتورة</p>
                          <p className="text-sm font-bold text-ink">{inv.totalPaidToday.toLocaleString()} ج.م</p>
                        </div>
                      </div>

                      <button 
                        onClick={async () => {
                          try {
                            await dataService.updateInvoice(inv.id!, { isWalletConfirmed: true });
                            showToast('تم تأكيد تحويل المحفظة بنجاح');
                          } catch (err: any) {
                            showToast('حدث خطأ أثناء التأكيد: ' + err.message);
                          }
                        }}
                        className="btn-primary bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2 md:w-36 shadow-lg shadow-purple-600/20 active:scale-95"
                      >
                        <Check size={18} />
                        تأكيد التحويل
                      </button>
                    </div>
                  ))
                }
                {invoices.filter(inv => (inv.walletAmount || 0) > 0 && !inv.isWalletConfirmed).length === 0 && (
                  <div className="bg-white p-12 rounded-[2.5rem] border border-accent/10 text-center space-y-4">
                    <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mx-auto">
                      <Wallet size={32} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-serif font-bold text-lg text-ink">لا توجد تحويلات معلقة</h3>
                      <p className="text-sm text-secondary/60">تم تأكيد جميع تحويلات المحفظة بنجاح.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === 'loans' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-ink">إدارة السلف</h2>
                {profile?.role === 'manager' && (
                  <button 
                    onClick={handleExportLoans}
                    className="btn-secondary flex items-center gap-2 px-4"
                  >
                    <Download size={18} />
                    <span className="hidden md:inline">تصدير إكسيل</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-2">
                <div className="bg-orange-50 p-6 rounded-[2rem] border border-orange-100">
                  <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">سلف قيد الانتظار</div>
                  <div className="text-2xl font-black text-orange-600">
                    {loans.filter(l => l.status === 'pending').reduce((acc, l) => acc + l.amount, 0).toLocaleString()} <span className="text-xs">ج.م</span>
                  </div>
                </div>
                <div className="bg-green-50 p-6 rounded-[2rem] border border-green-100">
                  <div className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">سلف معتمدة (غير مسددة)</div>
                  <div className="text-2xl font-black text-green-600">
                    {loans.filter(l => l.status === 'approved').reduce((acc, l) => acc + l.amount, 0).toLocaleString()} <span className="text-xs">ج.م</span>
                  </div>
                </div>
                <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                  <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">سلف مسددة</div>
                  <div className="text-2xl font-black text-blue-600">
                    {loans.filter(l => l.status === 'paid').reduce((acc, l) => acc + l.amount, 0).toLocaleString()} <span className="text-xs">ج.م</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] shadow-sm border border-accent/10 overflow-hidden">
                <div className="hidden md:block">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-bg/50 border-b border-accent/10">
                        <th className="p-6 font-bold text-secondary/60 uppercase text-[10px] tracking-widest">الموظف</th>
                        <th className="p-6 font-bold text-secondary/60 uppercase text-[10px] tracking-widest">المبلغ</th>
                        <th className="p-6 font-bold text-secondary/60 uppercase text-[10px] tracking-widest">التاريخ</th>
                        <th className="p-6 font-bold text-secondary/60 uppercase text-[10px] tracking-widest">ملاحظات</th>
                        <th className="p-6 font-bold text-secondary/60 uppercase text-[10px] tracking-widest text-center">الحالة / الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loans.map((loan) => (
                        <tr key={loan.id} className="border-b border-accent/5 hover:bg-bg/40 transition-colors">
                          <td className="p-6 font-bold text-sm text-ink">{loan.employeeName}</td>
                          <td className="p-6 font-bold text-sm text-primary">{loan.amount.toLocaleString()} ج.م</td>
                          <td className="p-6 text-xs text-secondary/60">{loan.date}</td>
                          <td className="p-6 text-xs text-secondary/60 max-w-xs truncate">{loan.note || '---'}</td>
                          <td className="p-6">
                            <div className="flex flex-col items-center gap-2">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                                loan.status === 'approved' ? "bg-green-100 text-green-600" :
                                loan.status === 'rejected' ? "bg-red-100 text-red-600" :
                                loan.status === 'paid' ? "bg-blue-100 text-blue-600" :
                                "bg-orange-100 text-orange-600"
                              )}>
                                {loan.status === 'approved' ? 'معتمدة' :
                                 loan.status === 'rejected' ? 'مرفوضة' :
                                 loan.status === 'paid' ? 'مسددة' : 'قيد الانتظار'}
                              </span>
                              {loan.status === 'pending' && (
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => loan.id && handleUpdateLoanStatus(loan.id, 'approved', loan.employeeId, loan.amount)}
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                    title="موافقة"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button 
                                    onClick={() => loan.id && handleUpdateLoanStatus(loan.id, 'rejected', loan.employeeId, loan.amount)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    title="رفض"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden divide-y divide-accent/5">
                  {loans.map((loan) => (
                    <div key={loan.id} className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-sm text-ink">{loan.employeeName}</div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter",
                            loan.status === 'approved' ? "bg-green-100 text-green-600" :
                            loan.status === 'rejected' ? "bg-red-100 text-red-600" :
                            loan.status === 'paid' ? "bg-blue-100 text-blue-600" :
                            "bg-orange-100 text-orange-600"
                          )}>
                            {loan.status === 'approved' ? 'معتمدة' :
                             loan.status === 'rejected' ? 'مرفوضة' :
                             loan.status === 'paid' ? 'مسددة' : 'قيد الانتظار'}
                          </span>
                          {loan.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => loan.id && handleUpdateLoanStatus(loan.id, 'approved', loan.employeeId, loan.amount)}
                                className="p-2 bg-green-50 text-green-600 rounded-xl"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                onClick={() => loan.id && handleUpdateLoanStatus(loan.id, 'rejected', loan.employeeId, loan.amount)}
                                className="p-2 bg-red-50 text-red-600 rounded-xl"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-primary font-bold">{loan.amount.toLocaleString()} ج.م</span>
                        <span className="text-secondary/50">{loan.date}</span>
                      </div>
                      {loan.note && <div className="text-[10px] text-secondary/60 italic">{loan.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {selectedUserForLoan && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-accent/10"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-serif font-bold text-ink">إضافة سلفة للموظف</h3>
                <button onClick={() => setSelectedUserForLoan(null)} className="p-2 text-secondary/40 hover:text-secondary transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="mb-6 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                <div className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-1">الموظف</div>
                <div className="font-bold text-ink">{selectedUserForLoan.name}</div>
              </div>

              <form onSubmit={handleSaveLoan} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">المبلغ</label>
                  <input 
                    required 
                    type="number" 
                    value={loanAmount || ''} 
                    onChange={e => setLoanAmount(Number(e.target.value))} 
                    className="input-field" 
                    placeholder="0.00"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">ملاحظات (اختياري)</label>
                  <textarea 
                    value={loanNote || ''} 
                    onChange={e => setLoanNote(e.target.value)} 
                    className="input-field min-h-[100px] resize-none" 
                    placeholder="سبب السلفة..."
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <button 
                    type="submit" 
                    disabled={isAddingLoan}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    {isAddingLoan ? 'جاري الحفظ...' : (
                      <>
                        <Check size={18} />
                        تأكيد السلفة
                      </>
                    )}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setSelectedUserForLoan(null)} 
                    className="flex-1 py-3 bg-white text-secondary border border-accent/10 rounded-2xl font-bold active:scale-95"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="حذف موظف"
        message={`هل أنت متأكد من حذف الموظف ${userToDelete?.name}؟ سيتم حذف حسابه نهائياً من النظام.`}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmOpen(false)}
        isDestructive={true}
        confirmText={isDeleting ? "جاري الحذف..." : "حذف الموظف نهائياً"}
        loading={isDeleting}
      />
    </div>
  );
}

function CarLoadingTab({ products, profile, showToast, allUsers }: { products: Product[], profile: UserProfile | null, showToast: (m: string, t?: 'success' | 'error') => void, allUsers: UserProfile[] }) {
  const [subTab, setSubTab] = useState<'individual' | 'summary'>('individual');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const canSelectRep = profile?.role === 'manager' || profile?.role === 'accountant' || profile?.role === 'supervisor' || profile?.role === 'storekeeper';
  const [selectedRepId, setSelectedRepId] = useState(canSelectRep ? '' : (profile?.uid || ''));
  const [loadingRecord, setLoadingRecord] = useState<CarLoading | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [repApprovedRequest, setRepApprovedRequest] = useState<LoadingRequest | null>(null);

  const [requests, setRequests] = useState<LoadingRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const representatives = allUsers.filter(u => u.role === 'representative');

  const allFlavors = useMemo(() => {
    const flavors = new Set<string>();
    products.forEach(p => {
      if (p.flavors && p.flavors.length > 0) {
        p.flavors.forEach(f => flavors.add(f));
      } else {
        flavors.add('بدون طعم');
      }
    });
    return Array.from(flavors).sort();
  }, [products]);

  const groupedSummary = useMemo(() => {
    const summary: { [key: string]: { [key: string]: number } } = {};
    requests
      .filter(r => r.status === 'approved')
      .forEach(request => {
        request.items.forEach(item => {
          if (!summary[item.productName]) {
            summary[item.productName] = {};
          }
          summary[item.productName][item.flavor] = (summary[item.productName][item.flavor] || 0) + item.quantity;
        });
      });

    return Object.entries(summary);
  }, [requests]);

  useEffect(() => {
    let ignore = false;
    
    if (!selectedRepId) {
      setLoadingRecord(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubscribe = dataService.subscribeToCarLoadingsByRepAndDate(selectedRepId, selectedDate, (data) => {
      try {
        if (ignore) return;
        
        console.log('CarLoadingTab received data:', data);
        if (data && data.length > 0) {
          setLoadingRecord(data[0] as CarLoading);
        } else {
          // Initialize a new record if not found
          const rep = representatives.find(r => r.uid === selectedRepId);
          const initialRecord: CarLoading = {
            date: selectedDate,
            representativeId: selectedRepId,
            representativeName: rep?.name || '...',
            items: products
              .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
              .map(p => ({
                productId: p.id,
                productName: p.name,
                quantity: 0
              })),
            largeCratesOut: 0,
            smallCratesOut: 0,
            status: 'pending',
            timestamp: new Date().toISOString()
          };
          setLoadingRecord(initialRecord);
        }
      } catch (e) {
        console.error('CarLoadingTab listener error:', e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }, (err) => {
      console.error('CarLoadingTab database error:', err);
      // Even on error, try to show the initial template so the user is not stuck
      const rep = representatives.find(r => r.uid === selectedRepId);
      const initialRecord: CarLoading = {
        date: selectedDate,
        representativeId: selectedRepId,
        representativeName: rep?.name || '...',
        items: products
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
          .map(p => ({
            productId: p.id,
            productName: p.name,
            quantity: 0
          })),
        largeCratesOut: 0,
        smallCratesOut: 0,
        status: 'pending',
        timestamp: new Date().toISOString()
      };
      if (!ignore) {
        setLoadingRecord(initialRecord);
        setLoading(false);
      }
    });

    return () => {
      ignore = true;
      unsubscribe();
    };
  }, [selectedDate, selectedRepId, products]);

  useEffect(() => {
    if (subTab !== 'summary') return;
    setRequestsLoading(true);
    const unsub = dataService.subscribeToLoadingRequestsByDate(selectedDate, (data) => {
      setRequests(data as LoadingRequest[]);
      setRequestsLoading(false);
    }, (err) => {
      console.error('CarLoadingTab requests subscription error:', err);
      setRequestsLoading(false);
    });
    return () => unsub();
  }, [selectedDate, subTab]);

  useEffect(() => {
    if (!selectedRepId || !selectedDate) {
      setRepApprovedRequest(null);
      return;
    }
    const unsub = dataService.subscribeToLoadingRequestsByRepAndDate(selectedRepId, selectedDate, (data) => {
      const approved = (data as LoadingRequest[]).find(r => r.status === 'approved');
      setRepApprovedRequest(approved || null);
    }, (err) => {
      console.error('CarLoadingTab repApprovedRequest subscription error:', err);
    });
    return () => unsub();
  }, [selectedRepId, selectedDate]);

  const handleUpdateItem = (productId: string, value: number) => {
    if (!loadingRecord || loadingRecord.status === 'confirmed') return;
    const newItems = loadingRecord.items.map(item => 
      item.productId === productId ? { ...item, quantity: value } : item
    );
    setLoadingRecord({ ...loadingRecord, items: newItems });
  };

  const handleSave = async () => {
    if (!loadingRecord || saving) return;
    setSaving(true);
    try {
      const recId = loadingRecord.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'loading_' + Date.now());
      const dataToSave: CarLoading = {
        ...loadingRecord,
        id: recId,
        status: 'confirmed',
        timestamp: new Date().toISOString()
      };
      
      // 1. Immediately update local state to confirmed with edited quantities
      setLoadingRecord(dataToSave);

      // 2. Persist to database via saveCarLoadingRecord
      await dataService.saveCarLoadingRecord(dataToSave);
      
      // Auto-register attendance
      const rep = allUsers.find(u => u.uid === loadingRecord.representativeId);
      if (rep) {
        await dataService.registerAttendance(rep.uid, rep.name).catch(() => {});
      }

      showToast('تم حفظ وتأكيد بيانات التحميل بنجاح ✓');
    } catch (err: any) {
      console.error(err);
      showToast(`فشل الحفظ: ${err.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    if (!loadingRecord) return;
    // 1. Immediately unlock editing in local UI
    setLoadingRecord({ ...loadingRecord, status: 'pending' });
    // 2. Also notify database
    if (loadingRecord.id) {
      dataService.updateCarLoading(loadingRecord.id, { status: 'pending' }).catch(console.error);
    }
    showToast('تم فتح التعديل، يمكنك تعديل الكميات وحفظها');
  };

  const isOldStyleId = selectedRepId && selectedRepId.startsWith('user_');

  return (
    <div className="space-y-8 pb-24">
      {/* Segmented Control for Sub-Tabs */}
      {profile?.role !== 'storekeeper' && (
        <div className="flex bg-blue-50/50 p-1.5 rounded-2xl max-w-md mx-auto border-2 border-blue-100">
          <button
            onClick={() => setSubTab('individual')}
            className={`flex-1 py-3 text-center rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              subTab === 'individual'
                ? 'bg-primary text-white shadow-md'
                : 'text-secondary/60 hover:text-primary hover:bg-white/50'
            }`}
          >
            <Package size={18} />
            تحميل السيارات
          </button>
          <button
            onClick={() => setSubTab('summary')}
            className={`flex-1 py-3 text-center rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              subTab === 'summary'
                ? 'bg-primary text-white shadow-md'
                : 'text-secondary/60 hover:text-primary hover:bg-white/50'
            }`}
          >
            <ClipboardList size={18} />
            جدول الكميات المجمعة
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-blue-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            {subTab === 'individual' || profile?.role === 'storekeeper' ? <Package size={24} /> : <ClipboardList size={24} />}
          </div>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-ink">
            {subTab === 'individual' || profile?.role === 'storekeeper' ? 'تحميل السيارة' : 'جدول الكميات المجمعة'}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {(subTab === 'individual' || profile?.role === 'storekeeper') && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-bold text-secondary/60">المندوب:</label>
              <select 
                value={selectedRepId || ''}
                onChange={(e) => setSelectedRepId(e.target.value)}
                className="bg-blue-50 px-4 py-2.5 rounded-xl border-2 border-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-ink"
              >
                <option value="">اختر المندوب</option>
                {representatives.map(rep => (
                  <option key={rep.uid} value={rep.uid}>{rep.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-secondary/60">التاريخ:</label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-blue-50 px-4 py-2.5 rounded-xl border-2 border-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-ink"
            />
          </div>
        </div>
      </div>

      {subTab === 'individual' || profile?.role === 'storekeeper' ? (
        <>
          {isOldStyleId && (
            <div className="bg-red-50 border-2 border-red-200 text-red-600 p-6 rounded-3xl flex items-start gap-4 shadow-sm animate-pulse">
              <AlertCircle className="shrink-0 mt-1" size={24} />
              <div className="space-y-1">
                <p className="font-bold text-lg">تنبيه تقني: معرف مندوب غير متوافق</p>
                <p className="text-sm">المندوب المختار لديه معرف قديم ({selectedRepId}). يرجى حذفه وإعادة إضافته كمنودب جديد لضمان توافق البيانات مع تحديثات النظام الجديدة.</p>
              </div>
            </div>
          )}

          {selectedRepId && loading && !loadingRecord && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] shadow-xl border-2 border-blue-100">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
              <p className="text-secondary font-bold">جاري تحميل البيانات...</p>
            </div>
          )}

          {selectedRepId && !loading && !loadingRecord && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] shadow-xl border-2 border-blue-100 italic text-secondary/40">
              لم يتم العثور على بيانات. يرجى اختيار مندوب مختلف أو التحقق من الاتصال.
            </div>
          )}

          {selectedRepId && loadingRecord && (
            <div className="space-y-6">
              {/* Import from Approved Loading Request Banner */}
              {repApprovedRequest && loadingRecord.status !== 'confirmed' && (
                <div className="bg-emerald-50 border-2 border-emerald-300 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs animate-in fade-in duration-200">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Package size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-ink text-sm">
                          يوجد طلب تشغيلة معتمد لهذا المندوب بتاريخ {selectedDate}
                        </p>
                        <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-md font-black">
                          معتمد من الإدارة
                        </span>
                      </div>
                      <p className="text-xs text-secondary/75 pt-0.5">
                        إجمالي الأصناف المطلوبة: {repApprovedRequest.items.reduce((s, i) => s + (i.quantity || 0), 0)} قطعة ({repApprovedRequest.items.length} صنف/طعم)
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      // Sum requested quantities by product ID
                      const productTotals: { [productId: string]: number } = {};
                      repApprovedRequest.items.forEach(it => {
                        productTotals[it.productId] = (productTotals[it.productId] || 0) + (Number(it.quantity) || 0);
                      });
                      const updatedItems = loadingRecord.items.map(item => {
                        if (productTotals[item.productId] !== undefined) {
                          return { ...item, quantity: productTotals[item.productId] };
                        }
                        return item;
                      });
                      setLoadingRecord({ ...loadingRecord, items: updatedItems });
                      showToast('تم استيراد كميات الأصناف من طلب التشغيلة المعتمد بنجاح!', 'success');
                    }}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 shrink-0 active:scale-95"
                  >
                    <ArrowDownToLine size={16} />
                    <span>استيراد الكميات إلى السيارة</span>
                  </button>
                </div>
              )}

              <div className="bg-white rounded-[2.5rem] shadow-xl border-2 border-blue-100 overflow-hidden">
                {loadingRecord.items.length > 0 ? (
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-blue-50/50 border-b-2 border-blue-100">
                        <th className="py-6 px-6 font-black text-[10px] text-blue-500 uppercase tracking-widest">المنتج</th>
                        <th className="py-6 px-6 text-center font-black text-[10px] text-blue-500 uppercase tracking-widest">الكمية المسلمة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50">
                      {[...loadingRecord.items]
                        .sort((a, b) => {
                          const pA = products.find(p => p.id === a.productId);
                          const pB = products.find(p => p.id === b.productId);
                          return (pA?.sortOrder || 0) - (pB?.sortOrder || 0);
                        })
                        .map((item) => (
                          <tr key={item.productId} className="hover:bg-blue-50/30 transition-colors group">
                            <td className="py-5 px-6 font-black text-ink">{item.productName}</td>
                            <td className="py-5 px-6 text-center">
                              <input 
                                type="number" 
                                disabled={loadingRecord.status === 'confirmed'}
                                value={item.quantity || ''}
                                onChange={(e) => handleUpdateItem(item.productId, parseInt(e.target.value) || 0)}
                                className="w-32 text-center p-3 bg-blue-50 border-2 border-blue-100 rounded-xl font-bold text-ink focus:border-primary border-none outline-none disabled:opacity-50"
                              />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-20 text-center text-secondary/40 italic font-serif">
                    لا توجد منتجات مسجلة في النظام. يرجى إضافة منتجات أولاً.
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <div className="w-full md:w-1/2 flex flex-col gap-3">
                  {loadingRecord.status === 'confirmed' && (
                    <button 
                      onClick={handleEdit}
                      className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                    >
                      <Edit3 size={18} />
                      تعديل البيانات
                    </button>
                  )}
                  <button 
                    onClick={handleSave}
                    disabled={saving || loadingRecord.status === 'confirmed' || isOldStyleId}
                    className="w-full py-5 bg-primary text-white rounded-[1.5rem] font-bold hover:bg-secondary transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                  >
                    <Save size={22} />
                    <span className="text-lg">{saving ? 'جاري الحفظ...' : 'حفظ بيانات التحميل'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-[2.5rem] shadow-xl border-2 border-blue-100 overflow-hidden">
          {requestsLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
              <p className="text-secondary font-bold">جاري تحميل البيانات...</p>
            </div>
          ) : groupedSummary.length === 0 ? (
            <div className="p-20 text-center text-secondary/40 italic font-serif">
              لا توجد طلبات معتمدة لهذا التاريخ لتجهيز كمياتها.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-blue-50/50 border-b-2 border-blue-100">
                    <th className="py-6 px-6 font-black text-[10px] text-blue-500 uppercase tracking-widest sticky right-0 bg-white/95 z-10">المنتج</th>
                    {allFlavors.map(flavor => (
                      <th key={flavor} className="py-6 px-4 text-center font-black text-[10px] text-blue-500 uppercase tracking-widest">{flavor}</th>
                    ))}
                    <th className="py-6 px-4 text-center font-black text-[10px] text-blue-500 uppercase tracking-widest">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {groupedSummary.map(([productName, flavorMap], idx) => {
                    const typedFlavorMap = flavorMap as { flavor: string; total: number }[];
                    const rowTotal = typedFlavorMap.reduce((acc, item) => acc + item.total, 0);
                    return (
                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="py-5 px-6 font-black text-ink sticky right-0 bg-white group-hover:bg-blue-50/30 z-10 border-l border-blue-50">{productName}</td>
                        {allFlavors.map(flavor => {
                          const flavorItem = typedFlavorMap.find(i => i.flavor === flavor);
                          return (
                            <td key={flavor} className="py-5 px-4 text-center text-sm font-bold">
                              {flavorItem ? (
                                <span className="px-3 py-1.5 bg-primary/5 text-primary rounded-xl font-black">{flavorItem.total}</span>
                              ) : (
                                <span className="text-secondary/10">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-5 px-4 text-center text-sm font-bold">
                          <span className="px-3 py-1.5 bg-secondary/10 text-secondary rounded-xl font-black">{rowTotal}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReceivingTab({ products, invoices, profile, showToast, allUsers, customers }: { products: Product[], invoices: Invoice[], profile: UserProfile | null, showToast: (m: string, t?: 'success' | 'error') => void, allUsers: UserProfile[], customers: Customer[] }) {
  const [subTab, setSubTab] = useState<'receiving' | 'settlement'>('receiving');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedRepId, setSelectedRepId] = useState('');
  const [returnRecord, setReturnRecord] = useState<CarReturn | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const representatives = useMemo(() => allUsers.filter(u => u.role === 'representative'), [allUsers]);

  const productsRef = useRef(products);
  const invoicesRef = useRef(invoices);
  const representativesRef = useRef(representatives);

  useEffect(() => {
    productsRef.current = products;
    invoicesRef.current = invoices;
    representativesRef.current = representatives;
  });

  useEffect(() => {
    let ignore = false;
    
    if (!selectedRepId) {
      setReturnRecord(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    // Actively query invoices for this date & rep from the database on-demand so damaged counts are accurate
    dataService.fetchInvoicesByDate(selectedDate, selectedRepId).catch(err => {
      console.warn('ReceivingTab fetchInvoicesByDate error:', err);
    });

    const unsubscribe = dataService.subscribeToCarReturnsByRepAndDate(selectedRepId, selectedDate, (data) => {
      try {
        if (ignore) return;
        
        console.log('ReceivingTab received data:', data);
        if (data && data.length > 0) {
          setReturnRecord(data[0] as CarReturn);
        } else {
          const rep = representativesRef.current.find(r => r.uid === selectedRepId);
          const repInvoices = invoicesRef.current.filter(inv => {
            const invIsoDate = normalizeDateStringToISO(inv.date || (inv as any).timestamp || '');
            const selIsoDate = normalizeDateStringToISO(selectedDate);
            const matchesDate = invIsoDate === selIsoDate;
            const invRepId = inv.representativeId || (inv as any).representativeid;
            return matchesDate && invRepId === selectedRepId;
          });
          setReturnRecord({
            date: selectedDate,
            representativeId: selectedRepId,
            representativeName: rep?.name || '...',
            items: productsRef.current
              .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
              .map(p => {
                let invoiceDamaged = 0;
                repInvoices.forEach(inv => {
                  const invItem = inv.items.find(i => i.productId === p.id);
                  if (invItem) {
                    const retDam = invItem.returnDamaged !== undefined ? invItem.returnDamaged : ((invItem as any).returndamaged || 0);
                    invoiceDamaged += (retDam || 0);
                  }
                });
                return {
                  productId: p.id,
                  productName: p.name,
                  surplus: 0,
                  damaged: invoiceDamaged
                };
              }),
            largeCratesIn: 0,
            smallCratesIn: 0,
            status: 'pending',
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error('ReceivingTab listener error:', e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }, (err) => {
      console.error('ReceivingTab database error:', err);
      // fallback
      const rep = representativesRef.current.find(r => r.uid === selectedRepId);
      const repInvoices = invoicesRef.current.filter(inv => inv.date === selectedDate && inv.representativeId === selectedRepId);
      if (!ignore) {
        setReturnRecord({
          date: selectedDate,
          representativeId: selectedRepId,
          representativeName: rep?.name || '...',
          items: productsRef.current
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
            .map(p => {
              let invoiceDamaged = 0;
              repInvoices.forEach(inv => {
                const invItem = inv.items.find(i => i.productId === p.id);
                if (invItem) {
                  const retDam = invItem.returnDamaged !== undefined ? invItem.returnDamaged : ((invItem as any).returndamaged || 0);
                  invoiceDamaged += (retDam || 0);
                }
              });
              return {
                productId: p.id,
                productName: p.name,
                surplus: 0,
                damaged: invoiceDamaged
              };
            }),
          largeCratesIn: 0,
          smallCratesIn: 0,
          status: 'pending',
          timestamp: new Date().toISOString()
        });
        setLoading(false);
      }
    });

    return () => {
      ignore = true;
      unsubscribe();
    };
  }, [selectedDate, selectedRepId]);

  const handleUpdateItem = (productId: string, field: 'surplus' | 'damaged', value: number) => {
    if (!returnRecord || returnRecord.status === 'confirmed') return;
    const newItems = returnRecord.items.map(item => 
      item.productId === productId ? { ...item, [field]: value } : item
    );
    setReturnRecord({ ...returnRecord, items: newItems });
  };

  const handleSave = async () => {
    if (!returnRecord || saving) return;
    setSaving(true);
    try {
      const dataToSave = {
        ...returnRecord,
        status: 'confirmed',
        timestamp: new Date().toISOString()
      };
      
      if (returnRecord.id) {
        await dataService.updateCarReturn(returnRecord.id, dataToSave);
      } else {
        await dataService.addCarReturn(dataToSave);
      }
      
      showToast('تم حفظ بيانات الاستلام من المندوب بنجاح');
    } catch (err: any) {
      console.error(err);
      showToast(`فشل الحفظ: ${err.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!returnRecord || !returnRecord.id) return;
    try {
      await dataService.updateCarReturn(returnRecord.id, { status: 'pending' });
      showToast('تم فتح التعديل مرة أخرى');
    } catch (err) {
      console.error(err);
      showToast('فشل فتح التعديل', 'error');
    }
  };

  const isOldStyleId = selectedRepId && selectedRepId.startsWith('user_');

  return (
    <div className="space-y-8 pb-24">
      {/* Segmented Control for Sub-Tabs */}
      <div className="flex bg-blue-50/50 p-1.5 rounded-2xl max-w-md mx-auto border-2 border-blue-100">
        <button
          onClick={() => setSubTab('receiving')}
          className={`flex-1 py-3 text-center rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
            subTab === 'receiving'
              ? 'bg-primary text-white shadow-md'
              : 'text-secondary/60 hover:text-primary hover:bg-white/50'
          }`}
        >
          <ArrowUpDown size={18} />
          استلام المرتجع
        </button>
        <button
          onClick={() => setSubTab('settlement')}
          className={`flex-1 py-3 text-center rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
            subTab === 'settlement'
              ? 'bg-primary text-white shadow-md'
              : 'text-secondary/60 hover:text-primary hover:bg-white/50'
          }`}
        >
          <Calculator size={18} />
          تقفيل اليومية
        </button>
      </div>

      {subTab === 'receiving' ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-blue-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                <ArrowUpDown size={24} />
              </div>
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-ink">استلام من المندوب</h2>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-bold text-secondary/60">المندوب:</label>
                <select 
                  value={selectedRepId || ''}
                  onChange={(e) => setSelectedRepId(e.target.value)}
                  className="bg-blue-50 px-4 py-2.5 rounded-xl border-2 border-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-ink"
                >
                  <option value="">اختر المندوب</option>
                  {representatives.map(rep => (
                    <option key={rep.uid} value={rep.uid}>{rep.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-bold text-secondary/60">التاريخ:</label>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-blue-50 px-4 py-2.5 rounded-xl border-2 border-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-ink"
                />
              </div>
            </div>
          </div>

          {isOldStyleId && (
            <div className="bg-red-50 border-2 border-red-200 text-red-600 p-6 rounded-3xl flex items-start gap-4 shadow-sm animate-pulse">
              <AlertCircle className="shrink-0 mt-1" size={24} />
              <div className="space-y-1">
                <p className="font-bold text-lg">تنبيه تقني: معرف مندوب غير متوافق</p>
                <p className="text-sm">المندوب المختار لديه معرف قديم ({selectedRepId}). يرجى حذفه وإعادة إضافته كمنودب جديد لضمان توافق البيانات مع تحديثات النظام الجديدة.</p>
              </div>
            </div>
          )}

          {selectedRepId && loading && !returnRecord && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] shadow-xl border-2 border-blue-100">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
              <p className="text-secondary font-bold">جاري تحميل البيانات...</p>
            </div>
          )}

          {selectedRepId && !loading && !returnRecord && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] shadow-xl border-2 border-blue-100 italic text-secondary/40">
              لم يتم العثور على بيانات. يرجى اختيار مندوب مختلف أو التحقق من الاتصال.
            </div>
          )}

          {selectedRepId && returnRecord && (
            <div className="space-y-8">
              <div className="bg-white rounded-[2.5rem] shadow-xl border-2 border-blue-100 overflow-hidden">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-blue-50/50 border-b-2 border-blue-100">
                      <th className="py-6 px-6 font-black text-[10px] text-blue-500 uppercase tracking-widest">المنتج</th>
                      <th className="py-6 px-4 text-center font-black text-[10px] text-blue-500 uppercase tracking-widest">فائض (سليم)</th>
                      <th className="py-6 px-4 text-center font-black text-[10px] text-blue-500 uppercase tracking-widest">تالف مؤكد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {[...returnRecord.items]
                      .sort((a, b) => {
                        const pA = products.find(p => p.id === a.productId);
                        const pB = products.find(p => p.id === b.productId);
                        return (pA?.sortOrder || 0) - (pB?.sortOrder || 0);
                      })
                      .map((item) => (
                        <tr key={item.productId} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-5 px-6 font-black text-ink">{item.productName}</td>
                          <td className="py-5 px-4 text-center">
                            <input 
                              type="number" 
                              disabled={returnRecord.status === 'confirmed'}
                              value={item.surplus || ''}
                              onChange={(e) => handleUpdateItem(item.productId, 'surplus', parseInt(e.target.value) || 0)}
                              className="w-24 text-center p-3 bg-blue-50 border-2 border-blue-100 rounded-xl font-bold text-ink focus:border-primary outline-none disabled:opacity-50"
                            />
                          </td>
                          <td className="py-5 px-4 text-center">
                            <input 
                              type="number" 
                              disabled={returnRecord.status === 'confirmed'}
                              value={item.damaged || ''}
                              onChange={(e) => handleUpdateItem(item.productId, 'damaged', parseInt(e.target.value) || 0)}
                              className="w-24 text-center p-3 bg-red-50 border-2 border-red-100 rounded-xl font-bold text-red-600 focus:border-red-500 outline-none disabled:opacity-50"
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-4">
                <div className="w-full md:w-1/2 flex flex-col gap-3">
                  {returnRecord.status === 'confirmed' && (
                    <button 
                      onClick={handleEdit}
                      className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                    >
                      <Edit3 size={18} />
                      تعديل البيانات
                    </button>
                  )}
                  <button 
                    onClick={handleSave}
                    disabled={saving || returnRecord.status === 'confirmed' || isOldStyleId}
                    className="w-full py-5 bg-primary text-white rounded-[1.5rem] font-bold hover:bg-secondary transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                  >
                    <Save size={22} />
                    <span className="text-lg">{saving ? 'جاري الحفظ...' : 'حفظ بيانات الاستلام'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <DailySettlementTab
          products={products}
          invoices={invoices}
          profile={profile}
          showToast={showToast}
          allUsers={allUsers}
          customers={customers}
        />
      )}
    </div>
  );
}

function PhoneReviewTab({
  invoices,
  customers,
  allUsers,
  products,
  showToast,
  profile,
}: {
  invoices: Invoice[];
  customers: Customer[];
  allUsers: UserProfile[];
  products: Product[];
  showToast: (message: string, type?: 'success' | 'error') => void;
  profile: UserProfile | null;
}) {
  const representatives = allUsers.filter(u => u.role === 'representative' && u.status !== 'inactive');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedRepId, setSelectedRepId] = useState('');
  const [reviewedInvoices, setReviewedInvoices] = useState<Record<string, boolean>>({});
  const [localSelectedInvoice, setLocalSelectedInvoice] = useState<Invoice | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const canEditInvoice = profile?.role === 'manager' || profile?.role === 'developer';

  // Filter invoices for selected date and representative
  const filteredInvoices = invoices.filter(inv => {
    const matchDate = inv.date === selectedDate;
    const matchRep = selectedRepId ? inv.representativeId === selectedRepId : true;
    return matchDate && matchRep;
  });

  const toggleReviewed = (invoiceId: string) => {
    setReviewedInvoices(prev => ({
      ...prev,
      [invoiceId]: !prev[invoiceId]
    }));
  };

  // Stats
  const totalInvoicesValue = filteredInvoices.reduce((acc, inv) => acc + (inv.totalPaidToday || 0), 0);
  const reviewedCount = filteredInvoices.filter(inv => reviewedInvoices[inv.id]).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-serif font-black text-ink flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-600">
              <Phone size={20} />
            </span>
            مراجعة الفواتير تليفونياً
          </h2>
          <p className="text-xs font-bold text-secondary/60 mt-1">مراجعة وتأكيد مبيعات اليوم مع العملاء عبر الهاتف</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <div className="relative">
            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-4 pr-11 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black text-ink focus:border-primary focus:bg-white transition-all outline-none"
            />
          </div>

          {/* Representative Selector */}
          <div className="relative min-w-[160px]">
            <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
            <select
              value={selectedRepId}
              onChange={(e) => setSelectedRepId(e.target.value)}
              className="pl-4 pr-11 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black text-ink focus:border-primary focus:bg-white transition-all outline-none appearance-none w-full"
            >
              <option value="">كل المناديب</option>
              {representatives.map(rep => (
                <option key={rep.uid} value={rep.uid}>{rep.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-secondary/40 uppercase tracking-wider">عدد الفواتير</p>
            <p className="text-2xl font-black text-ink mt-1">{filteredInvoices.length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500">
            <FileText size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-secondary/40 uppercase tracking-wider">إجمالي المبيعات</p>
            <p className="text-2xl font-black text-primary mt-1">{totalInvoicesValue.toLocaleString()} ج.م</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="font-serif font-bold text-lg">ج.م</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-secondary/40 uppercase tracking-wider">تمت مراجعته</p>
            <p className="text-2xl font-black text-green-600 mt-1">{reviewedCount} / {filteredInvoices.length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-500">
            <CheckCircle size={22} />
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-sm overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-secondary/40 font-bold">
            <Search className="mx-auto mb-4 text-secondary/20" size={48} />
            <p>لا توجد فواتير مسجلة لهذا اليوم والمندوب المحدد</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="py-4 px-6 font-black text-[10px] text-secondary/40 uppercase tracking-wider w-[80px]">المراجعة</th>
                    <th className="py-4 px-6 font-black text-[10px] text-secondary/40 uppercase tracking-wider">العميل</th>
                    <th className="py-4 px-6 font-black text-[10px] text-secondary/40 uppercase tracking-wider">المندوب</th>
                    <th className="py-4 px-6 font-black text-[10px] text-secondary/40 uppercase tracking-wider text-center">رقم الهاتف</th>
                    <th className="py-4 px-6 font-black text-[10px] text-secondary/40 uppercase tracking-wider text-center">الوقت</th>
                    <th className="py-4 px-6 font-black text-[10px] text-secondary/40 uppercase tracking-wider text-left">قيمة الفاتورة</th>
                    <th className="py-4 px-6 font-black text-[10px] text-secondary/40 uppercase tracking-wider text-center">اتصال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map((inv) => {
                    const cust = customers.find(c => c.id === inv.customerId);
                    const phone = cust?.phone || '';
                    const isReviewed = !!reviewedInvoices[inv.id];

                    return (
                      <tr 
                        key={inv.id}
                        className="hover:bg-slate-50/80 cursor-pointer transition-all active:bg-slate-100/50"
                        onClick={() => setLocalSelectedInvoice(inv)}
                      >
                        <td className="py-5 px-6" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleReviewed(inv.id)}
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                              isReviewed 
                                ? "bg-green-500 border-green-500 text-white" 
                                : "border-slate-300 hover:border-slate-400"
                            }`}
                          >
                            {isReviewed && <CheckCircle size={14} className="stroke-[3]" />}
                          </button>
                        </td>
                        <td className="py-5 px-6 font-black text-slate-900">{inv.customerName}</td>
                        <td className="py-5 px-6 font-bold text-slate-600">{inv.representativeName}</td>
                        <td className="py-5 px-6 font-mono font-bold text-center text-slate-500">
                          {phone || 'غير مسجل'}
                        </td>
                        <td className="py-5 px-6 font-bold text-center text-slate-500">{inv.time}</td>
                        <td className="py-5 px-6 font-serif font-black text-left text-primary">
                          {(inv.totalPaidToday || 0).toLocaleString()} ج.م
                        </td>
                        <td className="py-5 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                          {phone ? (
                            <a 
                              href={`tel:${phone}`}
                              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-green-50 hover:bg-green-100 text-green-600 active:scale-95 transition-all"
                              title="اتصال تليفوني"
                            >
                              <Phone size={16} />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 font-bold">لا يوجد رقم</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredInvoices.map((inv) => {
                const cust = customers.find(c => c.id === inv.customerId);
                const phone = cust?.phone || '';
                const isReviewed = !!reviewedInvoices[inv.id];

                return (
                  <div 
                    key={inv.id}
                    className="p-5 active:bg-slate-50 cursor-pointer transition-all space-y-4"
                    onClick={() => setLocalSelectedInvoice(inv)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                          <button
                            onClick={() => toggleReviewed(inv.id)}
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                              isReviewed 
                                ? "bg-green-500 border-green-500 text-white" 
                                : "border-slate-300"
                            }`}
                          >
                            {isReviewed && <CheckCircle size={14} className="stroke-[3]" />}
                          </button>
                        </div>
                        <div>
                          <p className={`font-black text-md leading-tight ${isReviewed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                            {inv.customerName}
                          </p>
                          <p className="text-[10px] font-bold text-secondary/50 mt-1">
                            {inv.representativeName} • {inv.time}
                          </p>
                        </div>
                      </div>

                      <p className="font-serif font-black text-primary text-md">
                        {(inv.totalPaidToday || 0).toLocaleString()} ج.م
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-50" onClick={(e) => e.stopPropagation()}>
                      {phone ? (
                        <a 
                          href={`tel:${phone}`}
                          className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                          <Phone size={14} />
                          اتصال ({phone})
                        </a>
                      ) : (
                        <div className="flex-1 py-3 bg-slate-100 text-slate-400 rounded-xl font-black text-xs text-center">
                          رقم الهاتف غير مسجل
                        </div>
                      )}

                      <button 
                        onClick={() => setLocalSelectedInvoice(inv)}
                        className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs active:scale-95 transition-all"
                      >
                        عرض التفاصيل
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Invoice Detail Modal */}
      <AnimatePresence>
        {localSelectedInvoice && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLocalSelectedInvoice(null)}
              className="absolute inset-0 bg-ink/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-[3rem] shadow-2xl p-4 md:p-8 border-2 border-blue-100"
            >
              <button 
                onClick={() => setLocalSelectedInvoice(null)}
                className="absolute left-6 top-6 p-2.5 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-all active:scale-95"
              >
                <X size={20} />
              </button>

              <div className="p-2 md:p-4">
                <div className="flex items-center justify-between mb-8 border-b border-blue-50 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-serif font-black text-ink">فاتورة مبيعات</h3>
                      <p className="text-blue-400 font-mono text-[10px] mt-1 tracking-widest uppercase">ID: {localSelectedInvoice.id.slice(-8).toUpperCase()}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-10">
                  <div className="space-y-3 bg-blue-50 p-5 rounded-[1.5rem] border-2 border-blue-100">
                    <div>
                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">العميل</p>
                      <p className="text-lg font-black text-ink leading-tight">{localSelectedInvoice.customerName}</p>
                      {(() => {
                        const invCust = customers.find(c => c.id === localSelectedInvoice.customerId);
                        return invCust?.phone ? (
                          <div className="flex items-center gap-2 mt-2">
                            <a 
                              href={`tel:${invCust.phone}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded-xl text-[10px] font-black hover:bg-green-700 transition-all active:scale-95"
                            >
                              <Phone size={10} />
                              اتصال: {invCust.phone}
                            </a>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div className="pt-2 border-t border-blue-100/50">
                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">المندوب</p>
                      <p className="text-xs font-bold text-ink/70">{localSelectedInvoice.representativeName}</p>
                    </div>
                  </div>
                  <div className="space-y-3 bg-blue-50 p-5 rounded-[1.5rem] border-2 border-blue-100 text-left">
                    <div>
                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">التاريخ</p>
                      <p className="text-md font-black text-ink">{localSelectedInvoice.date}</p>
                    </div>
                    <div className="pt-2 border-t border-blue-100/50">
                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">الوقت</p>
                      <p className="text-xs font-bold text-ink/70">{localSelectedInvoice.time}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-10">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b-2 border-blue-100">
                        <th className="py-3 font-black text-[9px] text-blue-500 uppercase tracking-widest">المنتج</th>
                        <th className="py-3 text-center font-black text-[9px] text-blue-500 uppercase tracking-widest">السعر</th>
                        <th className="py-3 text-center font-black text-[9px] text-blue-500 uppercase tracking-widest">عدد العلب</th>
                        {localSelectedInvoice.items.some(i => i.returnDamaged > 0) && (
                          <th className="py-3 text-center font-black text-[9px] text-red-500 uppercase tracking-widest">تالف</th>
                        )}
                        {localSelectedInvoice.items.some(i => i.gifts > 0) && (
                          <th className="py-3 text-center font-black text-[9px] text-green-500 uppercase tracking-widest">هدايا</th>
                        )}
                        <th className="py-3 text-left font-black text-[9px] text-blue-500 uppercase tracking-widest">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50">
                      {localSelectedInvoice.items
                        .filter(item => item.sold > 0 || item.returnDamaged > 0 || item.gifts > 0)
                        .map((item, i) => (
                        <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-3 text-xs font-black text-ink">{item.productName}</td>
                          <td className="py-3 text-center text-xs font-bold text-ink/60">{item.price}</td>
                          <td className="py-3 text-center text-xs font-black text-ink">{item.sold}</td>
                          {localSelectedInvoice.items.some(it => it.returnDamaged > 0) && (
                            <td className="py-3 text-center text-xs font-black text-red-600">{item.returnDamaged}</td>
                          )}
                          {localSelectedInvoice.items.some(it => it.gifts > 0) && (
                            <td className="py-3 text-center text-xs font-black text-green-600">{item.gifts}</td>
                          )}
                          <td className="py-3 text-left font-black text-xs text-ink">{(item.total || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-blue-100 bg-blue-50/30">
                        <td className="py-3 text-xs font-black text-ink">الإجمالي</td>
                        <td className="py-3 text-center text-xs font-black text-ink">-</td>
                        <td className="py-3 text-center text-xs font-black text-ink">
                          {localSelectedInvoice.items.reduce((acc, it) => acc + it.sold, 0)}
                        </td>
                        {localSelectedInvoice.items.some(it => it.returnDamaged > 0) && (
                          <td className="py-3 text-center text-xs font-black text-red-600">
                            {localSelectedInvoice.items.reduce((acc, it) => acc + it.returnDamaged, 0)}
                          </td>
                        )}
                        {localSelectedInvoice.items.some(it => it.gifts > 0) && (
                          <td className="py-3 text-center text-xs font-black text-green-600">
                            {localSelectedInvoice.items.reduce((acc, it) => acc + it.gifts, 0)}
                          </td>
                        )}
                        <td className="py-3 text-left font-black text-xs text-ink">
                          {(localSelectedInvoice.items.reduce((acc, it) => acc + (it.total || 0), 0)).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex justify-end">
                  <div className="w-full space-y-3 bg-blue-50 p-6 rounded-[2rem] border-2 border-blue-100">
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-500 font-bold">المجموع الفرعي</span>
                      <span className="font-black text-ink">{(localSelectedInvoice.subtotal || 0).toLocaleString()} ج.م</span>
                    </div>
                    {localSelectedInvoice.items.some(i => i.returnDamaged > 0) && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-500 font-bold">قيمة المرتجع</span>
                        <span className="font-black text-red-600">-{(localSelectedInvoice.items.reduce((acc, item) => acc + ((item.returnDamaged || 0) * (item.price || 0)), 0)).toLocaleString()} ج.م</span>
                      </div>
                    )}
                    {localSelectedInvoice.items.some(i => i.gifts > 0) && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-500 font-bold">قيمة الهدايا</span>
                        <span className="font-black text-green-600">+{(localSelectedInvoice.items.reduce((acc, item) => acc + ((item.gifts || 0) * (item.price || 0)), 0)).toLocaleString()} ج.م</span>
                      </div>
                    )}
                    {localSelectedInvoice.discountValue > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-500 font-bold">الخصم</span>
                        <span className="font-black text-red-600">-{localSelectedInvoice.discountValue} {localSelectedInvoice.discountType === 'percentage' ? '%' : 'ج.م'}</span>
                      </div>
                    )}
                    {localSelectedInvoice.credit > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-500 font-bold">آجل (مديونية)</span>
                        <span className="font-black text-red-600">-{(localSelectedInvoice.credit || 0).toLocaleString()} ج.م</span>
                      </div>
                    )}
                    {localSelectedInvoice.collection > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-500 font-bold">تحصيل (سداد قديم)</span>
                        <span className="font-black text-green-600">+{(localSelectedInvoice.collection || 0).toLocaleString()} ج.م</span>
                      </div>
                    )}
                    <div className="border-t border-blue-100 pt-3 flex justify-between text-sm">
                      <span className="text-blue-600 font-black">المستحق اليوم</span>
                      <span className="font-serif font-black text-blue-600">{(localSelectedInvoice.totalPaidToday || 0).toLocaleString()} ج.م</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-4 border-t border-blue-50 pt-6">
                  {canEditInvoice && (
                    <button
                      onClick={() => setIsEditModalOpen(true)}
                      className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-blue-600/20 transition-all hover:bg-blue-700 text-sm"
                    >
                      <Edit3 size={18} />
                      تعديل الفاتورة
                    </button>
                  )}
                  <button
                    onClick={() => setLocalSelectedInvoice(null)}
                    className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black active:scale-95 transition-all text-sm"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <EditInvoiceModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        invoice={localSelectedInvoice}
        customers={customers}
        products={products}
        allUsers={allUsers}
        showToast={showToast}
        onSuccess={() => {
          setLocalSelectedInvoice(null);
        }}
      />
    </div>
  );
}

function DailySettlementTab({ products, invoices, profile, showToast, allUsers, customers }: { products: Product[], invoices: Invoice[], profile: UserProfile | null, showToast: (m: string, t?: 'success' | 'error') => void, allUsers: UserProfile[], customers: Customer[] }) {
  const isManager = profile?.role === 'manager';
  const isAccountant = profile?.role === 'accountant';
  const isStorekeeper = profile?.role === 'storekeeper';
  const isRep = profile?.role === 'representative';
  const canSelectRep = isManager || isAccountant || isStorekeeper;

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedRepId, setSelectedRepId] = useState(canSelectRep ? '' : (profile?.uid || ''));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFetchingInvoices, setIsFetchingInvoices] = useState(false);
  
  const [carLoading, setCarLoading] = useState<CarLoading | null>(null);
  const [carReturn, setCarReturn] = useState<CarReturn | null>(null);
  const [settlement, setSettlement] = useState<DailySettlement | null>(null);
  const [amountHandedOver, setAmountHandedOver] = useState<number>(0);
  const [breakdownType, setBreakdownType] = useState<SettlementBreakdownType | null>(null);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<Invoice | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  useEffect(() => {
    if (settlement) {
      setAmountHandedOver(settlement.amountHandedOver || 0);
    } else {
      setAmountHandedOver(0);
    }
  }, [settlement]);

  const representatives = allUsers.filter(u => u.role === 'representative');

  useEffect(() => {
    let ignore = false;
    
    if (!selectedRepId) {
      setLoading(false);
      setCarLoading(null);
      setCarReturn(null);
      setSettlement(null);
      return;
    }

    setLoading(true);

    // Actively query invoices for this date & rep from the database on-demand so sold quantities are never zero
    setIsFetchingInvoices(true);
    dataService.fetchInvoicesByDate(selectedDate, selectedRepId)
      .catch(err => {
        console.warn('DailySettlementTab fetchInvoicesByDate error:', err);
      })
      .finally(() => {
        if (!ignore) setIsFetchingInvoices(false);
      });

    const unsubs: (() => void)[] = [];

    // Subscribe to loading
    const unsubLoading = dataService.subscribeToCarLoadingsByRepAndDate(selectedRepId, selectedDate, (data) => {
      if (!ignore) setCarLoading(data && data.length > 0 ? data[0] as CarLoading : null);
    });
    unsubs.push(unsubLoading);

    // Subscribe to return
    const unsubReturn = dataService.subscribeToCarReturnsByRepAndDate(selectedRepId, selectedDate, (data) => {
      if (!ignore) setCarReturn(data && data.length > 0 ? data[0] as CarReturn : null);
    });
    unsubs.push(unsubReturn);

    // Subscribe to settlement
    const unsubSettlement = dataService.subscribeToSettlementsByRepAndDate(selectedRepId, selectedDate, (data) => {
      if (!ignore) setSettlement(data && data.length > 0 ? data[0] as DailySettlement : null);
    });
    unsubs.push(unsubSettlement);

    // After a short delay, stop loading indicator
    const timer = setTimeout(() => {
      if (!ignore) setLoading(false);
    }, 1000);

    return () => {
      ignore = true;
      unsubs.forEach(u => u());
      clearTimeout(timer);
    };
  }, [selectedDate, selectedRepId]);

  const dailyInvoices = invoices.filter(inv => {
    const invIsoDate = normalizeDateStringToISO(inv.date || (inv as any).timestamp || '');
    const selIsoDate = normalizeDateStringToISO(selectedDate);
    const matchesDate = invIsoDate === selIsoDate;
    const invRepId = inv.representativeId || (inv as any).representativeid;
    const matchesRep = invRepId === selectedRepId;
    return matchesDate && matchesRep;
  });
  const totalInvoicesValue = dailyInvoices.reduce((acc, inv) => acc + (parseFloat(inv.totalPaidToday as any) || 0), 0);
  const confirmedWalletTotal = dailyInvoices.filter(inv => inv.isWalletConfirmed).reduce((acc, inv) => acc + (parseFloat(inv.walletAmount as any) || 0), 0);
  const totalDiscounts = dailyInvoices.reduce((acc, inv) => {
    const discountVal = parseFloat(inv.discountValue as any) || 0;
    const sub = parseFloat(inv.subtotal as any) || 0;
    const amount = inv.discountType === 'fixed' ? discountVal : (sub * discountVal / 100);
    return acc + (isNaN(amount) ? 0 : amount);
  }, 0);
  const totalCredit = dailyInvoices.reduce((acc, inv) => acc + (parseFloat(inv.credit as any) || 0), 0);
  const totalCollection = dailyInvoices.reduce((acc, inv) => acc + (parseFloat(inv.collection as any) || 0), 0);

  // Aggregate Data
  const settlementItems = products
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(p => {
      const loadItem = carLoading?.items.find(i => i.productId === p.id);
      const returnItem = carReturn?.items.find(i => i.productId === p.id);
      
      let sold = 0;
      let gifts = 0;
      let invoiceDamaged = 0;
      dailyInvoices.forEach(inv => {
        const invItem = inv.items.find(i => i.productId === p.id);
        if (invItem) {
          sold += (invItem.sold || 0);
          gifts += (invItem.gifts || 0);
          const retDam = invItem.returnDamaged !== undefined ? invItem.returnDamaged : ((invItem as any).returndamaged || 0);
          invoiceDamaged += (retDam || 0);
        }
      });

      const received = loadItem?.quantity || 0;
      const surplus = returnItem?.surplus || 0;
      
      const damaged = (carReturn && carReturn.status === 'confirmed')
        ? (returnItem?.damaged || 0)
        : invoiceDamaged;
        
      const remainingExpected = received - (sold + gifts);
      const diff = remainingExpected - surplus;
      
      return {
        productId: p.id,
        productName: p.name,
        price: p.price,
        received,
        sold,
        gifts,
        surplus,
        damaged,
        remainingExpected,
        diff
      };
    });

  const totals = settlementItems.reduce((acc, item) => ({
    received: acc.received + ((item.received || 0) * (parseFloat(item.price as any) || 0)),
    surplus: acc.surplus + ((item.surplus || 0) * (parseFloat(item.price as any) || 0)),
    damaged: acc.damaged + ((item.damaged || 0) * (parseFloat(item.price as any) || 0)),
    gifts: acc.gifts + ((item.gifts || 0) * (parseFloat(item.price as any) || 0)),
    sold: acc.sold + ((item.sold || 0) * (parseFloat(item.price as any) || 0))
  }), { received: 0, surplus: 0, damaged: 0, gifts: 0, sold: 0 });

  const totalDiffValue = settlementItems.reduce((acc, item) => acc + ((item.diff || 0) * (parseFloat(item.price as any) || 0)), 0);

  // crates aggregation
  const cratesOutLarge = carLoading?.largeCratesOut || 0;
  const cratesOutSmall = carLoading?.smallCratesOut || 0;
  const cratesInLarge = carReturn?.largeCratesIn || 0;
  const cratesInSmall = carReturn?.smallCratesIn || 0;
  const cratesDiffLarge = cratesOutLarge - cratesInLarge;
  const cratesDiffSmall = cratesOutSmall - cratesInSmall;

  const cashRequired = totals.received - totals.surplus - totals.damaged - totals.gifts - totalCredit - totalDiscounts + totalCollection;
  const finalRequired = Math.max(cashRequired, totalInvoicesValue);
  const deficit = finalRequired - amountHandedOver;

  const handleExportMissedVisits = (silent = false) => {
    if (!selectedRepId || !selectedDate) return;
    try {
      const rep = representatives.find(r => r.uid === selectedRepId);
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const parts = selectedDate.split('-');
      const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const weekdayName = daysOfWeek[dObj.getDay()];
      const arabicLabel = WEEKDAYS.find(w => w.value === weekdayName)?.label || weekdayName;

      const repCustomers = customers.filter(c => c.representativeId === selectedRepId || (c as any).representativeid === selectedRepId);
      const missedList: any[] = [];

      for (const customer of repCustomers) {
        const rawPreferredDays = customer.preferredDays || (customer as any).preferreddays || [];
        let preferredDays: string[] = [];
        if (Array.isArray(rawPreferredDays)) {
          preferredDays = rawPreferredDays;
        } else if (typeof rawPreferredDays === 'string' && rawPreferredDays.trim()) {
          try {
            preferredDays = JSON.parse(rawPreferredDays);
          } catch (e) {
            preferredDays = [];
          }
        }

        if (preferredDays.includes(weekdayName)) {
          const hasInvoice = invoices.some(inv => 
            (inv.customerId === customer.id || (inv as any).customerid === customer.id || inv.customerName === customer.shopName) && 
            inv.date === selectedDate
          );

          if (!hasInvoice) {
            missedList.push({
              'كود العميل': customer.id,
              'اسم المحل / العميل': customer.shopName,
              'اسم المالك': customer.ownerName || 'غير محدد',
              'رقم الهاتف': customer.phone || 'غير محدد',
              'المنطقة': customer.area || 'غير محدد',
              'المندوب المسؤول': customer.representativeName || rep?.name || 'غير محدد',
              'يوم الزيارة المفترض': arabicLabel,
              'التاريخ': selectedDate
            });
          }
        }
      }

      if (missedList.length === 0) {
        if (!silent) {
          showToast('جميع عملاء المندوب تمت زيارتهم أو لا يوجد عملاء متبقين في هذا اليوم لم يزاروا!', 'success');
        }
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(missedList);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "الزيارات الفائتة");
      XLSX.writeFile(workbook, `العملاء_غير_المزارين_${rep?.name || 'مندوب'}_${selectedDate}.xlsx`);
      if (!silent) {
        showToast('تم تحميل تقرير العملاء غير المزارين بنجاح');
      }
    } catch (error) {
      console.error('Export missed visits error:', error);
      if (!silent) {
        showToast('خطأ في تصدير تقرير الزيارات الفائتة', 'error');
      }
    }
  };

  const handleSaveOrConfirm = async (confirm: boolean = false) => {
    if (!selectedRepId || saving) return;
    setSaving(true);
    try {
      const rep = representatives.find(r => r.uid === selectedRepId);
      const data: any = {
        date: selectedDate,
        representativeId: selectedRepId,
        representativeName: rep?.name || '',
        items: settlementItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          received: item.received,
          returnedSurplus: item.surplus,
          damaged: item.damaged,
          gifts: item.gifts,
          sold: item.sold,
          remainingInCar: item.diff
        })),
        largeCratesDiff: cratesDiffLarge,
        smallCratesDiff: cratesDiffSmall,
        isConfirmed: confirm,
        isAmountReceived: confirm,
        amountHandedOver: amountHandedOver,
        deficit: finalRequired - amountHandedOver,
        walletTotal: confirmedWalletTotal,
        timestamp: new Date().toISOString()
      };

      if (settlement?.id) {
        await dataService.updateSettlement(settlement.id, data);
      } else {
        await dataService.addSettlement(data);
      }

      if (confirm && rep) {
        await dataService.registerAttendance(rep.uid, rep.name);
        
        const deficitVal = finalRequired - amountHandedOver;
        const formattedDeficit = deficitVal.toLocaleString() + " ج.م";

        // Notify Representative
        await dataService.createNotification(
          'تقفيل اليومية وإغلاق اليوم',
          `تم إغلاق يوميتك لتاريخ ${selectedDate} بنجاح. قيمة العجز: ${formattedDeficit}`,
          'settlement',
          profile?.uid || 'system',
          profile?.name || 'النظام',
          'settlement',
          rep.uid
        );

        // Notify Managers
        await dataService.createNotification(
          'تقفيل يومية مندوب',
          `قام ${profile?.name || 'النظام'} بإغلاق يومية المندوب ${rep.name} لتاريخ ${selectedDate}. قيمة العجز: ${formattedDeficit}`,
          'settlement',
          profile?.uid || 'system',
          profile?.name || 'النظام',
          'settlement'
        );

        // Auto-export the Excel file of unvisited customers
        try {
          handleExportMissedVisits(true);
        } catch (e) {
          console.error('Auto-export on confirm failed:', e);
        }
      }

      showToast(confirm ? 'تم تأكيد التقفيلة وإغلاق اليوم' : 'تم حفظ بيانات التقفيلة');
    } catch (err: any) {
      console.error(err);
      showToast(`فشل العملية: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const isOldStyleId = selectedRepId && selectedRepId.startsWith('user_');

  if (loading && !settlement && !carLoading && !carReturn) {
    return <div className="flex justify-center p-20 font-bold text-secondary animate-pulse italic">جاري تجميع بيانات اليومية...</div>;
  }

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-blue-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Calculator size={24} />
          </div>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-ink">تقفيلة اليوم</h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {canSelectRep && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-bold text-secondary/60">المندوب:</label>
              <select 
                value={selectedRepId || ''}
                onChange={(e) => setSelectedRepId(e.target.value)}
                className="bg-blue-50 px-4 py-2.5 rounded-xl border-2 border-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-ink"
              >
                <option value="">اختر المندوب</option>
                {representatives.map(rep => (
                  <option key={rep.uid} value={rep.uid}>{rep.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-secondary/60">التاريخ:</label>
            <div className="relative flex items-center gap-2">
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-blue-50 px-4 py-2.5 rounded-xl border-2 border-blue-100 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold text-ink"
              />
              <button
                type="button"
                onClick={() => {
                  if (selectedDate && selectedRepId) {
                    setIsFetchingInvoices(true);
                    dataService.fetchInvoicesByDate(selectedDate, selectedRepId)
                      .then(() => showToast('تم استدعاء وتحديث فواتير هذا التاريخ من السيرفر بنجاح', 'success'))
                      .catch(() => showToast('حدث خطأ أثناء استدعاء الفواتير', 'error'))
                      .finally(() => setIsFetchingInvoices(false));
                  }
                }}
                disabled={isFetchingInvoices || !selectedRepId}
                title="تحديث واستدعاء فواتير هذا التاريخ من السيرفر"
                className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-all border border-blue-200 active:scale-95 disabled:opacity-50"
              >
                <RefreshCcw size={16} className={isFetchingInvoices ? "animate-spin" : ""} />
              </button>
              {isFetchingInvoices && (
                <div className="absolute -bottom-5 right-0 text-[10px] font-bold text-primary flex items-center gap-1 animate-pulse whitespace-nowrap">
                  <RefreshCcw size={10} className="animate-spin" />
                  <span>جاري استدعاء مبيعات هذا اليوم...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isOldStyleId && (
        <div className="bg-red-50 border-2 border-red-200 text-red-600 p-6 rounded-3xl flex items-start gap-4 shadow-sm animate-pulse">
          <AlertCircle className="shrink-0 mt-1" size={24} />
          <div className="space-y-1">
            <p className="font-bold text-lg">تنبيه تقني: معرف مندوب غير متوافق</p>
            <p className="text-sm">المندوب المختار لديه معرف قديم ({selectedRepId}). يرجى حذفه وإعادة إضافته كمنودب جديد لضمان توافق البيانات مع تحديثات النظام الجديدة.</p>
          </div>
        </div>
      )}

      {!selectedRepId ? (
        <div className="bg-white p-20 rounded-[2.5rem] shadow-xl border-2 border-blue-100 text-center">
          <p className="text-secondary/40 font-bold">الرجاء اختيار المندوب لعرض التقفيلة</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Status Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={cn("p-4 rounded-2xl border-2 flex items-center gap-3", carLoading?.status === 'confirmed' ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700")}>
              {carLoading?.status === 'confirmed' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              <span className="font-bold">تحميل الصباح: {carLoading?.status === 'confirmed' ? 'مؤكد' : 'غير مؤكد'}</span>
            </div>
            <div className={cn("p-4 rounded-2xl border-2 flex items-center gap-3", carReturn?.status === 'confirmed' ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700")}>
              {carReturn?.status === 'confirmed' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              <span className="font-bold">استلام المساء: {carReturn?.status === 'confirmed' ? 'مؤكد' : 'غير مؤكد'}</span>
            </div>
            <div className={cn("p-4 rounded-2xl border-2 flex items-center gap-3", settlement?.isConfirmed ? "bg-primary/10 border-primary/20 text-primary" : "bg-blue-50 border-blue-200 text-blue-700")}>
              {settlement?.isConfirmed ? <Lock size={20} /> : <Unlock size={20} />}
              <span className="font-bold">حالة التقفيلة: {settlement?.isConfirmed ? 'مغلقة' : 'مفتوحة'}</span>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-xl border-2 border-blue-100 overflow-hidden overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-blue-50/50 border-b-2 border-blue-100">
                  <th className="py-6 px-6 font-black text-[10px] text-blue-500 uppercase tracking-widest">المنتج</th>
                  <th className="py-6 px-4 text-center font-black text-[10px] text-blue-500 uppercase tracking-widest">تحميل</th>
                  <th className="py-6 px-4 text-center font-black text-[10px] text-blue-500 uppercase tracking-widest text-secondary">مرتجع سليم</th>
                  <th className="py-6 px-4 text-center font-black text-[10px] text-blue-500 uppercase tracking-widest text-primary">مباع</th>
                  <th className="py-6 px-4 text-center font-black text-[10px] text-blue-500 uppercase tracking-widest text-green-600">هدايا</th>
                  <th className="py-6 px-4 text-center font-black text-[10px] text-blue-500 uppercase tracking-widest text-red-500">مرتجع تالف</th>
                  <th className="py-6 px-4 text-center font-black text-[10px] text-blue-500 uppercase tracking-widest">الفرق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {settlementItems.map((item) => (
                  <tr key={item.productId} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-5 px-6 font-black text-ink">{item.productName}</td>
                    <td className="py-5 px-4 text-center font-bold">{item.received}</td>
                    <td className="py-5 px-4 text-center font-bold text-secondary">{item.surplus}</td>
                    <td className="py-5 px-4 text-center font-bold text-primary">{item.sold}</td>
                    <td className="py-5 px-4 text-center font-bold text-green-600">{item.gifts}</td>
                    <td className="py-5 px-4 text-center font-bold text-red-500">{item.damaged}</td>
                    <td className={cn(
                      "py-5 px-4 text-center font-bold",
                      item.diff === 0 ? "text-green-600" : "text-red-600 bg-red-50/50"
                    )}>
                      {item.diff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Money and Crates Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-white p-4 sm:p-6 md:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-xl border-2 border-blue-100">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-serif font-black text-ink flex items-center gap-2 sm:gap-3">
                    <CreditCard className="text-primary" size={22} />
                    <span>الملخص المالي</span>
                  </h3>
                  <span className="text-[10px] sm:text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                    اضغط لأي تفاصيل 🔍
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 md:gap-4">
                  <SummaryCard 
                    label="إجمالي قيمة المستلم" 
                    value={totals.received} 
                    color="blue" 
                    onClick={() => setBreakdownType('received')} 
                  />
                  <SummaryCard 
                    label="قيمة مرتجع السليم" 
                    value={totals.surplus} 
                    color="green" 
                    onClick={() => setBreakdownType('surplus')} 
                  />
                  <SummaryCard 
                    label="إجمالي الفاقد (تالف)" 
                    value={totals.damaged} 
                    color="red" 
                    onClick={() => setBreakdownType('damaged')} 
                  />
                  <SummaryCard 
                    label="إجمالي الهدايا" 
                    value={totals.gifts} 
                    color="green" 
                    onClick={() => setBreakdownType('gifts')} 
                  />
                  <SummaryCard 
                    label="إجمالي الخصومات" 
                    value={totalDiscounts} 
                    color="red" 
                    onClick={() => setBreakdownType('discounts')} 
                  />
                  <SummaryCard 
                    label="إجمالي الآجل" 
                    value={totalCredit} 
                    color="red" 
                    onClick={() => setBreakdownType('credit')} 
                  />
                  <SummaryCard 
                    label="تحصيل ديون" 
                    value={totalCollection} 
                    color="green" 
                    onClick={() => setBreakdownType('collection')} 
                  />
                  <SummaryCard 
                    label="محفظة (مؤكدة)" 
                    value={confirmedWalletTotal} 
                    color="green" 
                    onClick={() => setBreakdownType('wallet')} 
                  />
                  <SummaryCard 
                    label="فرق العلب" 
                    value={totalDiffValue} 
                    color="blue" 
                    onClick={() => setBreakdownType('diffValue')} 
                  />
                  <SummaryCard 
                    label="المستحق" 
                    value={cashRequired} 
                    color="primary" 
                    onClick={() => setBreakdownType('cashRequired')} 
                  />
                  <SummaryCard 
                    label="إجمالي الفواتير" 
                    value={totalInvoicesValue} 
                    color="primary" 
                    className="col-span-2 text-center" 
                    onClick={() => setBreakdownType('invoices')} 
                  />
                </div>
                
                <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-blue-50/80 rounded-2xl sm:rounded-3xl border-2 border-blue-100 space-y-4">
                  <div className="flex justify-between items-center text-lg sm:text-xl font-black">
                    <span className="text-blue-600 text-sm sm:text-base">المطلوب نهائياً:</span>
                    <span className="text-blue-700 underline underline-offset-4 decoration-4 decoration-blue-200 text-lg sm:text-xl">
                      {finalRequired.toLocaleString()} ج.م
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-bold text-secondary/60">المبلغ المستلم فعلياً:</label>
                    <div className="relative">
                      <input 
                        type="number"
                        disabled={settlement?.isConfirmed && !isManager}
                        value={amountHandedOver || ''}
                        onChange={(e) => setAmountHandedOver(parseInt(e.target.value) || 0)}
                        className="w-full p-3 sm:p-4 bg-white border-2 border-blue-200 rounded-2xl font-black text-xl sm:text-2xl text-ink focus:border-primary outline-none"
                        placeholder="أدخل المبلغ..."
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary/30 font-bold text-sm">ج.م</span>
                    </div>
                  </div>

                  <div className={cn(
                    "flex justify-between items-center p-3.5 sm:p-4 rounded-xl",
                    deficit === 0 ? "bg-green-100 text-green-700" : deficit > 0 ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-700"
                  )}>
                    <span className="font-bold text-sm sm:text-base">{deficit > 0 ? 'العجز:' : deficit < 0 ? 'الزيادة:' : 'الحالة:'}</span>
                    <span className="text-lg sm:text-xl font-black">{Math.abs(deficit).toLocaleString()} ج.م</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                {(isManager || isAccountant || isStorekeeper) && (
                  <button 
                    onClick={() => handleSaveOrConfirm(true)}
                    disabled={saving || settlement?.isConfirmed || isOldStyleId}
                    className="w-full py-6 bg-green-600 text-white rounded-[2rem] font-black text-xl hover:bg-green-700 transition-all shadow-xl shadow-green-600/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                  >
                    <CheckCircle size={28} />
                    {settlement?.isConfirmed ? 'تم إغلاق اليوم بنجاح' : 'تأكيد التقفيلة النهائية وإغلاق اليوم'}
                  </button>
                )}
                
                <button 
                  onClick={() => handleSaveOrConfirm(false)}
                  disabled={saving || (settlement?.isConfirmed && !isManager) || isOldStyleId}
                  className="w-full py-5 bg-primary text-white rounded-[1.5rem] font-bold hover:bg-secondary transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                >
                  <Save size={22} />
                  <span>{saving ? 'جاري الحفظ...' : 'حفظ بيانات التقفيلة'}</span>
                </button>

                <button 
                  onClick={() => handleExportMissedVisits(false)}
                  className="w-full py-4 bg-blue-50 text-blue-700 rounded-[1.5rem] font-bold hover:bg-blue-100 transition-all border-2 border-blue-200 flex items-center justify-center gap-3"
                >
                  <Download size={22} />
                  <span>تحميل تقرير العملاء غير المزارين</span>
                </button>

                {settlement?.isConfirmed && isManager && (
                  <button 
                    onClick={async () => {
                      if (!settlement?.id) return;
                      await dataService.updateSettlement(settlement.id, { isConfirmed: false, isAmountReceived: false });
                      showToast('تم فتح التقفيلة للتعديل');
                    }}
                    className="w-full py-4 bg-orange-100 text-orange-600 rounded-2xl font-bold hover:bg-orange-200 transition-all border-2 border-orange-200"
                  >
                    إعادة فتح التقفيلة (للمدير فقط)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Financial Summary Breakdown Modal */}
      <DailySettlementBreakdownModal
        isOpen={!!breakdownType}
        type={breakdownType}
        onClose={() => setBreakdownType(null)}
        selectedDate={selectedDate}
        representativeName={representatives.find(r => r.uid === selectedRepId)?.name}
        products={products}
        invoices={invoices}
        dailyInvoices={dailyInvoices}
        customers={customers}
        carLoading={carLoading}
        carReturn={carReturn}
        settlement={settlement}
        settlementItems={settlementItems}
        totals={totals}
        totalDiscounts={totalDiscounts}
        totalCredit={totalCredit}
        totalCollection={totalCollection}
        confirmedWalletTotal={confirmedWalletTotal}
        totalDiffValue={totalDiffValue}
        cashRequired={cashRequired}
        finalRequired={finalRequired}
        totalInvoicesValue={totalInvoicesValue}
        cratesOutLarge={cratesOutLarge}
        cratesOutSmall={cratesOutSmall}
        cratesInLarge={cratesInLarge}
        cratesInSmall={cratesInSmall}
        cratesDiffLarge={cratesDiffLarge}
        cratesDiffSmall={cratesDiffSmall}
        onViewInvoice={(invoice) => {
          setSelectedInvoiceForModal(invoice);
          setIsInvoiceModalOpen(true);
        }}
      />

      {/* Invoice Detail Modal when clicked inside breakdown */}
      <EditInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        invoice={selectedInvoiceForModal}
        customers={customers}
        products={products}
        allUsers={allUsers}
        showToast={showToast}
        onSuccess={() => {
          setSelectedInvoiceForModal(null);
        }}
      />
    </div>
  );
}

function SummaryCard({ 
  label, 
  value, 
  color, 
  unit = "ج.م", 
  className,
  onClick 
}: { 
  label: string, 
  value: number, 
  color: 'blue' | 'red' | 'green' | 'primary', 
  unit?: string, 
  className?: string,
  onClick?: () => void 
}) {
  const colors = {
    blue: 'bg-blue-50/90 text-blue-700 border-blue-200/90 hover:border-blue-300 hover:bg-blue-100/80',
    red: 'bg-red-50/90 text-red-700 border-red-200/90 hover:border-red-300 hover:bg-red-100/80',
    green: 'bg-emerald-50/90 text-emerald-700 border-emerald-200/90 hover:border-emerald-300 hover:bg-emerald-100/80',
    primary: 'bg-primary/5 text-primary border-primary/20 hover:border-primary/30 hover:bg-primary/10'
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-3 sm:p-4 md:p-5 rounded-2xl sm:rounded-3xl border-2 text-right transition-all select-none relative group flex flex-col justify-between overflow-hidden min-w-0 shadow-xs",
        onClick && "cursor-pointer active:scale-95 transform duration-150",
        colors[color], 
        className
      )}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5 min-w-0">
        <p className="text-[11px] sm:text-xs font-black leading-tight opacity-80 group-hover:opacity-100 transition-opacity line-clamp-2">
          {label}
        </p>
        {onClick && (
          <span className="shrink-0 text-[9px] font-bold text-ink/60 bg-white/80 px-1 py-0.5 rounded-md shadow-2xs sm:opacity-0 group-hover:opacity-100 transition-opacity">
            🔍
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-start gap-1 flex-wrap mt-0.5">
        <span className="text-sm sm:text-base md:text-lg font-black tracking-tight break-all">
          {value.toLocaleString()}
        </span>
        <span className="text-[10px] sm:text-xs font-bold opacity-60 shrink-0">
          {unit}
        </span>
      </div>
    </div>
  );
}

function ProfileTab({ profile, showToast, loans, attendance, settlements, invoices, customers, products, settings }: { 
  profile: UserProfile | null, 
  showToast: (m: string, t?: 'success' | 'error') => void,
  loans: Loan[],
  attendance: Attendance[],
  settlements: DailySettlement[],
  invoices: Invoice[],
  customers: Customer[],
  products: Product[],
  settings: Settings | null
}) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedDetail, setSelectedDetail] = useState<'attendance' | 'loans' | 'deficits' | 'sales' | 'target' | 'credit' | null>(null);
  const [showLoanRequest, setShowLoanRequest] = useState(false);
  const [requestAmount, setRequestAmount] = useState<number>(0);
  const [requestNote, setRequestNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    // Check file size (max 500KB for base64 in Firestore)
    if (file.size > 500 * 1024) {
      showToast('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 500 كيلوبايت.', 'error');
      return;
    }

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        await dataService.updateUser(profile.uid, {
          photoURL: base64
        });
        showToast('تم تحديث الصورة الشخصية بنجاح!');
      } catch (err: any) {
        console.error('Error updating photo:', err);
        showToast('حدث خطأ أثناء تحديث الصورة: ' + (err.message || 'خطأ غير معروف'), 'error');
      } finally {
        setIsUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRequestLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestAmount <= 0 || !profile) return;
    setIsSubmitting(true);
    try {
      const newLoan: Loan = {
        employeeId: profile.uid,
        employeeName: profile.name,
        amount: requestAmount,
        date: format(new Date(), 'yyyy-MM-dd'),
        timestamp: new Date().toISOString(),
        note: requestNote,
        status: 'pending'
      };
      await dataService.addLoan(newLoan);
      
      // Create notification for manager
      await dataService.createNotification(
        'طلب سلفة جديد',
        `قام الموظف ${profile.name} بطلب سلفة بقيمة ${newLoan.amount} ج.م`,
        'loan',
        profile.uid,
        profile.name,
        'admin_loans'
      );

      showToast('تم إرسال طلب السلفة بنجاح! في انتظار موافقة الإدارة.');
      setShowLoanRequest(false);
      setRequestAmount(0);
      setRequestNote('');
    } catch (err) {
      showToast('حدث خطأ أثناء إرسال الطلب', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const userLoans = loans.filter(l => l.employeeId === profile?.uid && l.date.startsWith(selectedMonth));
  const userAttendance = attendance.filter(a => a.employeeId === profile?.uid && a.date.startsWith(selectedMonth));
  const userSettlements = settlements.filter(s => s.representativeId === profile?.uid && s.date.startsWith(selectedMonth));
  const userInvoices = invoices.filter(inv => inv.representativeId === profile?.uid && inv.date.startsWith(selectedMonth));
  const userCustomers = customers.filter(c => c.representativeId === profile?.uid);

  const totalLoans = userLoans.filter(l => l.status === 'approved' || l.status === 'paid').reduce((acc, l) => acc + l.amount, 0);
  const totalDeficits = userSettlements.reduce((acc, s) => acc + (s.deficit || 0), 0);
  const workDays = userAttendance.length;

  // Sales Stats
  const totalSoldUnits = userInvoices.reduce((acc, inv) => acc + inv.items.reduce((sum, item) => sum + item.sold, 0), 0);
  const totalSoldValue = userInvoices.reduce((acc, inv) => acc + inv.subtotal, 0);
  
  const totalReturnedUnits = userInvoices.reduce((acc, inv) => acc + inv.items.reduce((sum, item) => sum + (item.returnDamaged || 0), 0), 0);
  const totalReturnedValue = userInvoices.reduce((acc, inv) => acc + inv.items.reduce((sum, item) => sum + ((item.returnDamaged || 0) * item.price), 0), 0);
  
  const totalGiftsUnits = userInvoices.reduce((acc, inv) => acc + inv.items.reduce((sum, item) => sum + (item.gifts || 0), 0), 0);
  const totalGiftsValue = userInvoices.reduce((acc, inv) => acc + inv.items.reduce((sum, item) => sum + ((item.gifts || 0) * item.price), 0), 0);
  
  const totalDiscounts = userInvoices.reduce((acc, inv) => acc + (inv.discountType === 'fixed' ? inv.discountValue : (inv.subtotal * inv.discountValue / 100)), 0);

  const totalDepreciationValue = totalReturnedValue + totalGiftsValue + totalDiscounts;
  const depreciationRatio = totalSoldValue > 0 ? (totalDepreciationValue / totalSoldValue * 100) : 0;

  // Target Stats
  const dailyTarget = settings?.dailyTarget || 1000;
  
  // Calculate working days in month (excluding Fridays)
  const getWorkingDaysInMonth = (monthStr: string) => {
    const date = parseISO(monthStr + '-01');
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = getDaysInMonth(date);
    let count = 0;
    for (let i = 1; i <= days; i++) {
      const d = new Date(year, month, i);
      if (d.getDay() !== 5) { // 5 is Friday
        count++;
      }
    }
    return count;
  };

  const workingDaysCount = getWorkingDaysInMonth(selectedMonth);
  const monthlyTarget = dailyTarget * workingDaysCount;
  
  const netSoldUnits = totalSoldUnits - totalReturnedUnits;
  const targetProgress = monthlyTarget > 0 ? (netSoldUnits / monthlyTarget) * 100 : 0;

  // Salary Calculation
  const base = profile?.baseSalary || 0;
  const fixedEarned = profile?.salaryType === 'daily' ? workDays * base : (workingDaysCount > 0 ? (workDays / workingDaysCount) * base : 0);
  
  // Target Bonus Calculation
  const targetBonusAmount = profile?.targetBonus || 0;
  const targetEarned = (targetBonusAmount * targetProgress) / 100;
  const totalEarned = fixedEarned + targetEarned;
  
  const approvedLoans = userLoans.filter(l => l.status === 'approved').reduce((acc, l) => acc + l.amount, 0);
  const netSalary = totalEarned - approvedLoans;

  // Credit Stats
  const totalCustomerCredit = userCustomers.reduce((acc, c) => {
    return acc + (c.openingBalance || 0);
  }, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border-2 border-blue-100 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-primary/10 to-blue-50" />
        <div className="relative">
          <div 
            className="w-32 h-32 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl border-4 border-white relative group cursor-pointer overflow-hidden"
            onClick={() => fileInputRef.current?.click()}
          >
            {profile?.photoURL ? (
              <img 
                src={profile.photoURL} 
                alt={profile.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-28 h-28 bg-blue-50 rounded-full flex items-center justify-center text-primary">
                <UserIcon size={56} />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white w-8 h-8" />
            </div>
            {isUploadingPhoto && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                <RefreshCcw className="text-primary w-8 h-8 animate-spin" />
              </div>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handlePhotoUpload} 
          />
          <h2 className="text-3xl font-serif font-black text-ink mb-2">{profile?.name}</h2>
          <div className="flex flex-col items-center gap-2 mb-6">
            <div className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-black uppercase tracking-widest">
              {profile?.role === 'manager' ? 'مدير النظام' : profile?.role === 'accountant' ? 'محاسب' : profile?.role === 'storekeeper' ? 'مخزن' : 'مندوب مبيعات'}
            </div>
            {profile?.role === 'representative' && profile?.lastLocation && (new Date().getTime() - new Date(profile.lastLocation.timestamp).getTime() < 60000) && (
              <div className="flex items-center gap-1.5 text-[10px] font-black text-green-500 uppercase tracking-widest bg-green-50 px-3 py-1 rounded-full border border-green-100">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                متصل الآن (مباشر)
              </div>
            )}
          </div>
          
          {/* Notification Activation Button */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => (window as any).requestNotificationPermission?.()}
              className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Bell size={20} />
              تفعيل التنبيهات الخارجية (على الجهاز)
            </button>
          </div>
        </div>
      </div>

      {profile?.role !== 'manager' && (
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border-2 border-blue-100">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
            <h3 className="text-xl font-serif font-black text-ink">إحصائيات الموظف</h3>
            <div className="flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100">
              <Calendar size={18} className="text-blue-400" />
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent font-bold text-ink focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            <button 
              onClick={() => setSelectedDetail(selectedDetail === 'attendance' ? null : 'attendance')}
              className={cn(
                "p-6 rounded-[2rem] border-2 text-center transition-all active:scale-95",
                selectedDetail === 'attendance' ? "bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-600/20" : "bg-blue-50 border-blue-100 text-ink"
              )}
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm", selectedDetail === 'attendance' ? "bg-white/20 text-white" : "bg-white text-blue-500")}>
                <Calendar size={24} />
              </div>
              <div className={cn("text-[10px] font-black uppercase tracking-widest mb-1", selectedDetail === 'attendance' ? "text-white/70" : "text-blue-400")}>أيام العمل</div>
              <div className="text-3xl font-black">{workDays}</div>
            </button>

            <div className="relative group">
              <button 
                onClick={() => setSelectedDetail(selectedDetail === 'loans' ? null : 'loans')}
                className={cn(
                  "w-full p-6 rounded-[2rem] border-2 text-center transition-all active:scale-95",
                  selectedDetail === 'loans' ? "bg-orange-600 border-orange-600 text-white shadow-xl shadow-orange-600/20" : "bg-orange-50 border-orange-100 text-ink"
                )}
              >
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm", selectedDetail === 'loans' ? "bg-white/20 text-white" : "bg-white text-orange-500")}>
                  <Clock size={24} />
                </div>
                <div className={cn("text-[10px] font-black uppercase tracking-widest mb-1", selectedDetail === 'loans' ? "text-white/70" : "text-orange-400")}>إجمالي السلف</div>
                <div className="text-3xl font-black">{totalLoans.toLocaleString()} <span className="text-xs">ج.م</span></div>
              </button>
              {profile?.role === 'representative' && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowLoanRequest(true);
                  }}
                  className="absolute -top-2 -right-2 bg-white text-orange-600 p-2 rounded-full shadow-lg border border-orange-100 hover:scale-110 transition-transform active:scale-90"
                  title="طلب سلفة جديدة"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            <button 
              onClick={() => setSelectedDetail(selectedDetail === 'deficits' ? null : 'deficits')}
              className={cn(
                "p-6 rounded-[2rem] border-2 text-center transition-all active:scale-95",
                selectedDetail === 'deficits' ? "bg-red-600 border-red-600 text-white shadow-xl shadow-red-600/20" : "bg-red-50 border-red-100 text-ink"
              )}
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm", selectedDetail === 'deficits' ? "bg-white/20 text-white" : "bg-white text-red-500")}>
                <ArrowUpDown size={24} />
              </div>
              <div className={cn("text-[10px] font-black uppercase tracking-widest mb-1", selectedDetail === 'deficits' ? "text-white/70" : "text-red-400")}>إجمالي العجوزات</div>
              <div className="text-3xl font-black">{totalDeficits.toLocaleString()} <span className="text-xs">ج.م</span></div>
            </button>

            <div className="p-6 rounded-[2rem] border-2 text-center bg-green-50 border-green-100 text-ink flex flex-col items-center justify-center min-h-[200px]">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm bg-white text-green-500">
                <Wallet size={24} />
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest mb-1 text-green-400">صافي الراتب المستحق</div>
              <div className="text-3xl font-black text-green-600 mb-3 leading-none">
                {netSalary.toLocaleString()} <span className="text-xs">ج.م</span>
              </div>
              <div className="w-full space-y-2 pt-3 border-t border-green-100">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-secondary/50">الراتب الثابت:</span>
                  <div className="text-right">
                    <span className="text-ink">{fixedEarned.toLocaleString()} ج.م</span>
                    {profile?.salaryType === 'monthly' && workingDaysCount > 0 && (
                      <span className="text-[8px] text-secondary/40 block">({workDays}/{workingDaysCount} يوم)</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-green-500/70">عمولة التارجت:</span>
                  <span className="text-green-600">+{targetEarned.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-red-500/70">خصم السلف:</span>
                  <span className="text-red-600">-{approvedLoans.toLocaleString()} ج.م</span>
                </div>
              </div>
            </div>
          </div>

          {profile?.role === 'representative' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
              <button 
                onClick={() => setSelectedDetail(selectedDetail === 'sales' ? null : 'sales')}
                className={cn(
                  "p-6 rounded-[2rem] border-2 text-center transition-all active:scale-95",
                  selectedDetail === 'sales' ? "bg-green-600 border-green-600 text-white shadow-xl shadow-green-600/20" : "bg-green-50 border-green-100 text-ink"
                )}
              >
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm", selectedDetail === 'sales' ? "bg-white/20 text-white" : "bg-white text-green-500")}>
                  <FileText size={24} />
                </div>
                <div className={cn("text-[10px] font-black uppercase tracking-widest mb-1", selectedDetail === 'sales' ? "text-white/70" : "text-green-400")}>إحصائيات المبيعات</div>
                <div className="text-2xl font-black">{totalSoldValue.toLocaleString()} <span className="text-[10px]">ج.م</span></div>
              </button>

              <button 
                onClick={() => setSelectedDetail(selectedDetail === 'target' ? null : 'target')}
                className={cn(
                  "p-6 rounded-[2rem] border-2 text-center transition-all active:scale-95",
                  selectedDetail === 'target' ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-600/20" : "bg-indigo-50 border-indigo-100 text-ink"
                )}
              >
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm", selectedDetail === 'target' ? "bg-white/20 text-white" : "bg-white text-indigo-500")}>
                  <Check size={24} />
                </div>
                <div className={cn("text-[10px] font-black uppercase tracking-widest mb-1", selectedDetail === 'target' ? "text-white/70" : "text-indigo-400")}>التارجت الشهري</div>
                <div className="text-2xl font-black">{targetProgress.toFixed(1)}%</div>
              </button>

              <button 
                onClick={() => setSelectedDetail(selectedDetail === 'credit' ? null : 'credit')}
                className={cn(
                  "p-6 rounded-[2rem] border-2 text-center transition-all active:scale-95",
                  selectedDetail === 'credit' ? "bg-purple-600 border-purple-600 text-white shadow-xl shadow-purple-600/20" : "bg-purple-50 border-purple-100 text-ink"
                )}
              >
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm", selectedDetail === 'credit' ? "bg-white/20 text-white" : "bg-white text-purple-500")}>
                  <Users size={24} />
                </div>
                <div className={cn("text-[10px] font-black uppercase tracking-widest mb-1", selectedDetail === 'credit' ? "text-white/70" : "text-purple-400")}>أرصدة العملاء</div>
                <div className="text-2xl font-black">{totalCustomerCredit.toLocaleString()} <span className="text-[10px]">ج.م</span></div>
              </button>
            </div>
          )}

          <AnimatePresence>
            {selectedDetail && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-10 overflow-hidden"
              >
                <div className="p-6 bg-accent/5 rounded-[2rem] border-2 border-accent/10">
                  <h4 className="text-lg font-serif font-black text-ink mb-6 flex items-center gap-3">
                    <div className={cn(
                      "w-3 h-8 rounded-full",
                      selectedDetail === 'attendance' ? "bg-blue-500" : 
                      selectedDetail === 'loans' ? "bg-orange-500" : 
                      selectedDetail === 'deficits' ? "bg-red-500" :
                      selectedDetail === 'sales' ? "bg-green-500" :
                      selectedDetail === 'target' ? "bg-indigo-500" : "bg-purple-500"
                    )} />
                    {selectedDetail === 'attendance' ? 'تفاصيل الحضور' : 
                    selectedDetail === 'loans' ? 'تفاصيل السلف' : 
                    selectedDetail === 'deficits' ? 'تفاصيل العجوزات' :
                    selectedDetail === 'sales' ? 'تفاصيل المبيعات والاهلاكات' :
                    selectedDetail === 'target' ? 'متابعة التارجت' : 'أرصدة العملاء الآجل'}
                  </h4>

                  {selectedDetail === 'sales' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 bg-white rounded-2xl border border-accent/5">
                          <span className="text-xs font-bold text-secondary/60">المبيعات (علب)</span>
                          <span className="font-black text-ink">{totalSoldUnits}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-white rounded-2xl border border-accent/5">
                          <span className="text-xs font-bold text-secondary/60">قيمة المبيعات</span>
                          <span className="font-black text-green-600">{totalSoldValue.toLocaleString()} ج.م</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-white rounded-2xl border border-accent/5">
                          <span className="text-xs font-bold text-secondary/60">المرتجع الهالك (علب)</span>
                          <span className="font-black text-red-500">{totalReturnedUnits}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-white rounded-2xl border border-accent/5">
                          <span className="text-xs font-bold text-secondary/60">قيمة المرتجع</span>
                          <span className="font-black text-red-600">{totalReturnedValue.toLocaleString()} ج.م</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 bg-white rounded-2xl border border-accent/5">
                          <span className="text-xs font-bold text-secondary/60">الهدايا (علب)</span>
                          <span className="font-black text-blue-500">{totalGiftsUnits}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-white rounded-2xl border border-accent/5">
                          <span className="text-xs font-bold text-secondary/60">قيمة الهدايا</span>
                          <span className="font-black text-blue-600">{totalGiftsValue.toLocaleString()} ج.م</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-white rounded-2xl border border-accent/5">
                          <span className="text-xs font-bold text-secondary/60">إجمالي الخصومات</span>
                          <span className="font-black text-orange-600">{totalDiscounts.toLocaleString()} ج.م</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-primary/10 rounded-2xl border border-primary/20">
                          <span className="text-xs font-black text-primary">نسبة الإهلاكات</span>
                          <span className="font-black text-primary text-lg">{depreciationRatio.toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedDetail === 'target' && (
                    <div className="space-y-6">
                      <div className="p-6 bg-white rounded-[2rem] border border-accent/5 text-center">
                        <div className="text-[10px] font-black text-secondary/40 uppercase tracking-widest mb-2">التقدم نحو التارجت الشهري</div>
                        <div className="text-5xl font-black text-indigo-600 mb-4">{targetProgress.toFixed(1)}%</div>
                        <div className="w-full bg-accent/10 h-4 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(targetProgress, 100)}%` }}
                            className="h-full bg-indigo-600"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white rounded-2xl border border-accent/5 text-center">
                          <div className="text-[10px] font-black text-secondary/40 uppercase tracking-widest mb-1">صافي المبيعات</div>
                          <div className="font-black text-ink">{netSoldUnits.toLocaleString()} علبة</div>
                        </div>
                        <div className="p-4 bg-white rounded-2xl border border-accent/5 text-center">
                          <div className="text-[10px] font-black text-secondary/40 uppercase tracking-widest mb-1">التارجت المطلوب</div>
                          <div className="font-black text-ink">{monthlyTarget.toLocaleString()} علبة</div>
                        </div>
                      </div>
                      <p className="text-[10px] text-secondary/40 text-center italic">التارجت اليومي: {dailyTarget.toLocaleString()} علبة صافي (مبيعات - مرتجع)</p>
                    </div>
                  )}

                  {selectedDetail === 'credit' && (
                    <div className="space-y-4">
                      <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
                        {[...userCustomers].sort((a, b) => (parseFloat(b.openingBalance as any) || 0) - (parseFloat(a.openingBalance as any) || 0)).map(c => {
                          const currentBalance = (c.openingBalance || 0);
                          return (
                            <div key={c.id} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-accent/5">
                              <span className="font-bold text-ink">{c.shopName}</span>
                              <span className="font-black text-purple-600">{currentBalance.toLocaleString()} ج.م</span>
                            </div>
                          );
                        })}
                        {userCustomers.length === 0 && <div className="text-center py-8 text-secondary/40">لا يوجد عملاء مسجلين</div>}
                      </div>
                      <div className="p-4 bg-purple-600 text-white rounded-2xl flex justify-between items-center">
                        <span className="font-bold">إجمالي المديونيات</span>
                        <span className="font-black text-xl">{totalCustomerCredit.toLocaleString()} ج.م</span>
                      </div>
                    </div>
                  )}

                  {selectedDetail !== 'sales' && selectedDetail !== 'target' && selectedDetail !== 'credit' && (
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-right">
                        <thead>
                          <tr className="border-b border-accent/10">
                            <th className="py-4 text-[10px] font-black text-secondary/40 uppercase tracking-widest">التاريخ</th>
                            <th className="py-4 text-[10px] font-black text-secondary/40 uppercase tracking-widest">
                              {selectedDetail === 'attendance' ? 'الحالة' : selectedDetail === 'loans' ? 'المبلغ / الملاحظة' : 'قيمة العجز'}
                            </th>
                            {selectedDetail === 'loans' && <th className="py-4 text-[10px] font-black text-secondary/40 uppercase tracking-widest">الحالة</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDetail === 'attendance' && userAttendance.map(a => (
                            <tr key={a.id} className="border-b border-accent/5 last:border-0">
                              <td className="py-4 font-bold text-sm text-ink">{a.date}</td>
                              <td className="py-4">
                                <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-[10px] font-black">حاضر</span>
                              </td>
                            </tr>
                          ))}
                          {selectedDetail === 'loans' && userLoans.map(l => (
                            <tr key={l.id} className="border-b border-accent/5 last:border-0">
                              <td className="py-4 font-bold text-sm text-ink">{l.date}</td>
                              <td className="py-4">
                                <div className="font-bold text-ink">{l.amount} ج.م</div>
                                {l.note && <div className="text-[10px] text-secondary/50">{l.note}</div>}
                              </td>
                              <td className="py-4">
                                <span className={cn(
                                  "px-3 py-1 rounded-full text-[10px] font-black",
                                  l.status === 'approved' ? "bg-green-100 text-green-600" :
                                  l.status === 'rejected' ? "bg-red-100 text-red-600" :
                                  l.status === 'paid' ? "bg-blue-100 text-blue-600" :
                                  "bg-orange-100 text-orange-600"
                                )}>
                                  {l.status === 'approved' ? 'معتمدة' :
                                  l.status === 'rejected' ? 'مرفوضة' :
                                  l.status === 'paid' ? 'مسددة' : 'قيد الانتظار'}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {selectedDetail === 'deficits' && userSettlements.map(s => (
                            <tr key={s.id} className="border-b border-accent/5 last:border-0">
                              <td className="py-4 font-bold text-sm text-ink">{s.date}</td>
                              <td className="py-4 font-black text-red-600">{s.deficit} ج.م</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {((selectedDetail === 'attendance' && userAttendance.length === 0) ||
                        (selectedDetail === 'loans' && userLoans.length === 0) ||
                        (selectedDetail === 'deficits' && userSettlements.length === 0)) && (
                        <div className="py-12 text-center text-secondary/40 font-bold">لا يوجد بيانات لهذا الشهر</div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-12 pt-8 border-t border-accent/10">
            <p className="text-xs font-bold text-blue-400 text-center">انقر على البطاقات أعلاه لعرض التفاصيل</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showLoanRequest && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-accent/10"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-serif font-bold text-ink">تقديم طلب سلفة</h3>
                <button onClick={() => setShowLoanRequest(false)} className="p-2 text-secondary/40 hover:text-secondary transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleRequestLoan} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">المبلغ المطلوب</label>
                  <input 
                    required 
                    type="number" 
                    value={requestAmount || ''} 
                    onChange={e => setRequestAmount(Number(e.target.value))} 
                    className="input-field" 
                    placeholder="0.00"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">ملاحظات / سبب الطلب</label>
                  <textarea 
                    value={requestNote} 
                    onChange={e => setRequestNote(e.target.value)} 
                    className="input-field min-h-[100px] resize-none" 
                    placeholder="اكتب سبب طلب السلفة هنا..."
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? 'جاري الإرسال...' : (
                      <>
                        <Check size={18} />
                        إرسال الطلب
                      </>
                    )}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowLoanRequest(false)} 
                    className="flex-1 py-3 bg-white text-secondary border border-accent/10 rounded-2xl font-bold active:scale-95"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MasterRoutesTab({ masterRoutes, allUsers, customers, showToast }: {
  masterRoutes: MasterRoute[];
  allUsers: UserProfile[];
  customers: Customer[];
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingRoute, setEditingRoute] = useState<MasterRoute | null>(null);
  const [formData, setFormData] = useState<{ name: string; code: string; description: string }>({
    name: '',
    code: '',
    description: ''
  });
  const [saving, setSaving] = useState(false);
  
  // Delete confirm
  const [deletingRoute, setDeletingRoute] = useState<MasterRoute | null>(null);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast('يرجى إدخال اسم خط السير', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingRoute) {
        await dataService.updateMasterRoute(editingRoute.id, formData);
        showToast('تم تحديث خط السير بنجاح');
      } else {
        await dataService.addMasterRoute(formData);
        showToast('تم إضافة خط السير بنجاح');
      }
      setIsAdding(false);
      setEditingRoute(null);
      setFormData({ name: '', code: '', description: '' });
    } catch (err) {
      showToast('حدث خطأ أثناء حفظ خط السير', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRoute) return;
    try {
      await dataService.deleteMasterRoute(deletingRoute.id);
      showToast('تم حذف خط السير بنجاح');
      setDeletingRoute(null);
    } catch (err) {
      showToast('حدث خطأ أثناء حذف خط السير', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-ink flex items-center gap-2">
            <Navigation className="text-primary" size={28} />
            إدارة خطوط السير
          </h2>
          <p className="text-xs text-secondary/70 mt-1">
            قم بتعريف خطوط السير وتوزيع المناديب والعملاء عليها لسهولة التوجيه والعمليات
          </p>
        </div>
        <button
          onClick={() => {
            setEditingRoute(null);
            setFormData({ name: '', code: '', description: '' });
            setIsAdding(true);
          }}
          className="flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-primary text-white rounded-2xl font-bold hover:bg-secondary transition-all shadow-lg shadow-primary/20 active:scale-95"
        >
          <Plus size={20} />
          <span className="text-sm md:text-base">إضافة خط سير</span>
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-2">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Navigation size={24} />
          </div>
          <div>
            <p className="text-xs text-secondary font-bold">إجمالي خطوط السير</p>
            <p className="text-2xl font-black text-ink">{masterRoutes.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs text-secondary font-bold">المناديب المرتبطين بخطوط</p>
            <p className="text-2xl font-black text-ink">
              {allUsers.filter(u => u.routeId || u.routeName).length}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserPlus size={24} />
          </div>
          <div>
            <p className="text-xs text-secondary font-bold">العملاء المرتبطين بخطوط</p>
            <p className="text-2xl font-black text-ink">
              {customers.filter(c => c.routeId || c.routeName).length}
            </p>
          </div>
        </div>
      </div>

      {/* Form Modal / Inline */}
      <AnimatePresence>
        {(isAdding || editingRoute) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-2"
          >
            <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl border-2 border-primary/20 space-y-4">
              <h3 className="text-lg font-bold text-ink">
                {editingRoute ? 'تعديل بيانات خط السير' : 'إضافة خط سير جديد'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">
                    اسم خط السير *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="مثال: خط المعادي والمقطم"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">
                    كود خط السير (اختياري)
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    className="input-field"
                    placeholder="مثال: R01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">
                  وصف المناطق والملاحظات
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="input-field py-2"
                  rows={2}
                  placeholder="وصف المناطق والحي المشمول داخل هذا الخط..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {saving && <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>}
                  <Save size={18} />
                  حفظ خط السير
                </button>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setEditingRoute(null);
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Routes List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
        {masterRoutes.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center rounded-3xl border border-dashed border-gray-200">
            <Navigation size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-bold">لا يوجد خطوط سير مسجلة حتى الآن</p>
            <p className="text-xs text-gray-400 mt-1">اضغط على زر "إضافة خط سير" للبدء</p>
          </div>
        ) : (
          masterRoutes.map(route => {
            const assignedReps = allUsers.filter(u => u.routeId === route.id || u.routeName === route.name);
            const assignedCusts = customers.filter(c => c.routeId === route.id || c.routeName === route.name);

            return (
              <div
                key={route.id}
                className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-lg">
                        {route.code || route.name.substring(0, 2)}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-ink">{route.name}</h3>
                        {route.code && (
                          <span className="text-[10px] font-extrabold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">
                            الكود: {route.code}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingRoute(route);
                          setFormData({
                            name: route.name,
                            code: route.code || '',
                            description: route.description || ''
                          });
                          setIsAdding(false);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="تعديل"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => setDeletingRoute(route)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="حذف"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {route.description && (
                    <p className="text-xs text-secondary/80 mb-4 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      {route.description}
                    </p>
                  )}

                  {/* Representative and Customer Counts */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100/50">
                      <span className="block text-[10px] font-bold text-blue-700 uppercase">المناديب المسندة</span>
                      <span className="text-base font-black text-blue-900">{assignedReps.length} مندوب</span>
                    </div>
                    <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100/50">
                      <span className="block text-[10px] font-bold text-emerald-700 uppercase">العملاء التابعين</span>
                      <span className="text-base font-black text-emerald-900">{assignedCusts.length} عميل</span>
                    </div>
                  </div>

                  {/* List of assigned Reps */}
                  {assignedReps.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">
                        المناديب المسندة لهذا الخط:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {assignedReps.map(rep => (
                          <span
                            key={rep.uid}
                            className="text-xs font-bold bg-gray-100 text-ink px-2.5 py-1 rounded-lg border border-gray-200"
                          >
                            👤 {rep.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingRoute && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="w-12 h-12 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle size={28} />
              </div>
              <h3 className="text-xl font-bold text-center text-ink">تأكيد حذف خط السير</h3>
              <p className="text-sm text-center text-secondary">
                هل أنت تأكد من إغلاق وحذف خط السير <span className="font-bold text-ink">"{deletingRoute.name}"</span>؟
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleDelete}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-md shadow-red-600/20"
                >
                  تأكيد الحذف
                </button>
                <button
                  onClick={() => setDeletingRoute(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
