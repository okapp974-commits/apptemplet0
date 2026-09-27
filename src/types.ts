export type Role = 'manager' | 'accountant' | 'supervisor' | 'representative' | 'backup_representative' | 'storekeeper' | 'developer';

export interface UserProfile {
  uid: string;
  id?: string;
  name: string;
  email: string;
  role: Role;
  password?: string;
  baseSalary?: number;
  salaryType?: 'daily' | 'monthly';
  targetBonus?: number;
  lastLocation?: {
    lat: number;
    lng: number;
    timestamp: string;
  };
  photoURL?: string;
  fcmTokens?: string[];
  status?: 'active' | 'inactive';
  routeId?: string;
  routeName?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  sortOrder: number;
  flavors?: string[];
  isFrozen?: boolean;
}

export interface LoadingRequestItem {
  productId: string;
  productName: string;
  flavor: string;
  quantity: number;
}

export interface SelectedVisitCustomer {
  id: string;
  shopName: string;
  ownerName?: string;
  area?: string;
  phone?: string;
  isPreferredDay: boolean;
  preferredDays?: string[];
}

export interface LoadingRequest {
  id?: string;
  representativeId: string;
  representativeName: string;
  date: string;
  items: LoadingRequestItem[];
  selectedCustomers?: SelectedVisitCustomer[];
  nonPreferredWarning?: boolean;
  status: 'pending' | 'approved' | 'rejected';
  editRequested?: boolean;
  canEdit?: boolean;
  timestamp: any;
}

export interface Customer {
  id: string;
  shopName: string;
  ownerName: string;
  area: string;
  phone: string;
  openingBalance: number;
  location?: { lat: number; lng: number };
  representativeId: string;
  representativeName: string;
  status: 'active' | 'suspended';
  preferredDays?: string[];
  routeId?: string;
  routeName?: string;
}

export interface MasterRoute {
  id: string;
  name: string;
  code?: string;
  description?: string;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  price: number;
  sold: number;
  returnDamaged: number;
  gifts: number;
  total: number;
}

export interface Invoice {
  id: string;
  date: string;
  time: string;
  customerId: string;
  customerName: string;
  items: InvoiceItem[];
  subtotal: number;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  credit: number;
  collection: number;
  totalPaidToday: number;
  walletAmount?: number;
  isWalletConfirmed?: boolean;
  representativeId: string;
  representativeName: string;
  timestamp: any;
  customerBalanceAfter?: number;
}

export interface DailySettlementItem {
  productId: string;
  productName: string;
  received: number;
  returnedSurplus: number;
  gifts: number;
  damaged: number;
  confirmedDamaged: number;
  remainingInCar: number;
  sold: number;
  boxDiff: number;
}

export interface CarLoadingItem {
  productId: string;
  productName: string;
  quantity: number;
}

export interface CarLoading {
  id?: string;
  date: string;
  representativeId: string;
  representativeName: string;
  items: CarLoadingItem[];
  largeCratesOut: number;
  smallCratesOut: number;
  status: 'confirmed' | 'pending';
  timestamp: any;
}

export interface CarReturnItem {
  productId: string;
  productName: string;
  surplus: number;
  damaged: number;
}

export interface CarReturn {
  id?: string;
  date: string;
  representativeId: string;
  representativeName: string;
  items: CarReturnItem[];
  largeCratesIn: number;
  smallCratesIn: number;
  status: 'confirmed' | 'pending';
  timestamp: any;
}

export interface DailySettlement {
  id: string;
  date: string;
  representativeId: string;
  representativeName: string;
  items: DailySettlementItem[];
  largeCratesDiff: number;
  smallCratesDiff: number;
  isConfirmed: boolean;
  isAmountReceived: boolean;
  amountHandedOver: number;
  walletTotal?: number;
  deficit: number;
  boxDifference: number;
  boxDifferenceValue: number;
  timestamp: any;
}

export type LoanStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface Loan {
  id?: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  date: string;
  timestamp: any;
  note?: string;
  status: LoanStatus;
}

export interface Attendance {
  id?: string;
  employeeId: string;
  employeeName: string;
  date: string;
  timestamp: any;
  type: 'present' | 'absent';
}

export interface Settings {
  id: string;
  dailyTarget: number;
  factoryLocation?: { lat: number; lng: number };
  companyPhone?: string;
}

export interface SystemConfig {
  id: string;
  expiryDate: string;
  isActive: boolean;
  lockMessage?: string;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: string;
}

export interface Route {
  id?: string;
  representativeId: string;
  date: string;
  points: RoutePoint[];
}

export interface Notification {
  id?: string;
  title: string;
  message: string;
  type: 'invoice' | 'customer' | 'settlement' | 'loan' | 'system';
  senderId: string;
  senderName: string;
  recipientId?: string;
  isRead: boolean;
  timestamp: any;
  date: string;
  targetTab?: string;
}
