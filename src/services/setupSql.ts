export const SUPABASE_SETUP_SQL = `-- ==========================================
-- Supabase Database Setup Script for OK App
-- نصوص تهيئة قاعدة البيانات لبرنامج OK
-- ==========================================

-- 1. Drop existing tables if they exist to start fresh
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.settlements CASCADE;
DROP TABLE IF EXISTS public.loans CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.system_config CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.car_loadings CASCADE;
DROP TABLE IF EXISTS public.loading_requests CASCADE;
DROP TABLE IF EXISTS public.car_returns CASCADE;
DROP TABLE IF EXISTS public.routes CASCADE;
DROP TABLE IF EXISTS public.master_routes CASCADE;

-- 2. Create public.users table (User profiles)
CREATE TABLE public.users (
    uid TEXT PRIMARY KEY,
    id TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('manager', 'accountant', 'supervisor', 'representative', 'backup_representative', 'storekeeper', 'developer')),
    password TEXT,
    "baseSalary" NUMERIC DEFAULT 0,
    "salaryType" TEXT DEFAULT 'monthly',
    "targetBonus" NUMERIC DEFAULT 0,
    "lastLocation" JSONB,
    "photoURL" TEXT,
    "fcmTokens" JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    "routeId" TEXT,
    "routeName" TEXT,
    updated_at TEXT
);

-- 3. Create public.products table (Inventory)
CREATE TABLE public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    "sortOrder" NUMERIC DEFAULT 0,
    flavors JSONB DEFAULT '[]'::jsonb,
    "isFrozen" BOOLEAN DEFAULT false
);

-- 4. Create public.customers table (Clients & Shops)
CREATE TABLE public.customers (
    id TEXT PRIMARY KEY,
    "shopName" TEXT NOT NULL,
    "ownerName" TEXT,
    area TEXT,
    phone TEXT,
    address TEXT,
    "openingBalance" NUMERIC DEFAULT 0,
    location JSONB,
    "representativeId" TEXT,
    "representativeName" TEXT,
    "routeId" TEXT,
    "routeName" TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    "preferredDays" JSONB DEFAULT '[]'::jsonb,
    timestamp TEXT
);

-- 5. Create public.invoices table (Sales logs)
CREATE TABLE public.invoices (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    "time" TEXT,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC DEFAULT 0,
    "discountType" TEXT DEFAULT 'fixed' CHECK ("discountType" IN ('fixed', 'percentage')),
    "discountValue" NUMERIC DEFAULT 0,
    credit NUMERIC DEFAULT 0,
    collection NUMERIC DEFAULT 0,
    "totalPaidToday" NUMERIC DEFAULT 0,
    "walletAmount" NUMERIC DEFAULT 0,
    "isWalletConfirmed" BOOLEAN DEFAULT false,
    "representativeId" TEXT NOT NULL,
    "representativeName" TEXT NOT NULL,
    "routeId" TEXT,
    "routeName" TEXT,
    timestamp TEXT
);

-- 6. Create public.settlements table (Daily account reconciliation)
CREATE TABLE public.settlements (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "representativeName" TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    "largeCratesDiff" NUMERIC DEFAULT 0,
    "smallCratesDiff" NUMERIC DEFAULT 0,
    "isConfirmed" BOOLEAN DEFAULT false,
    "isAmountReceived" BOOLEAN DEFAULT false,
    "amountHandedOver" NUMERIC DEFAULT 0,
    "walletTotal" NUMERIC DEFAULT 0,
    deficit NUMERIC DEFAULT 0,
    "boxDifference" NUMERIC DEFAULT 0,
    "boxDifferenceValue" NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending',
    "totalAmount" NUMERIC DEFAULT 0,
    timestamp TEXT
);

-- 7. Create public.loans table (Financial advances/loans)
CREATE TABLE public.loans (
    id TEXT PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    date TEXT NOT NULL,
    timestamp TEXT,
    note TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid'))
);

-- 8. Create public.attendance table (Duty attendance tracker)
CREATE TABLE public.attendance (
    id TEXT PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    date TEXT NOT NULL,
    timestamp TEXT,
    type TEXT DEFAULT 'present' CHECK (type IN ('present', 'absent'))
);

-- 9. Create public.settings table (System-wide configuration defaults)
CREATE TABLE public.settings (
    id TEXT PRIMARY KEY,
    "dailyTarget" NUMERIC DEFAULT 1000,
    "factoryLocation" JSONB
);

-- 10. Create public.system_config table (License & Status validation)
CREATE TABLE public.system_config (
    id TEXT PRIMARY KEY,
    "expiryDate" TEXT NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "lockMessage" TEXT
);

-- 11. Create public.notifications table (Realtime alerts & logs)
CREATE TABLE public.notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('invoice', 'customer', 'settlement', 'loan', 'system')),
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "recipientId" TEXT,
    "isRead" BOOLEAN DEFAULT false,
    timestamp TEXT,
    date TEXT NOT NULL,
    "targetTab" TEXT
);

-- 12. Create public.car_loadings table (Daily inventory taken out)
CREATE TABLE public.car_loadings (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "representativeName" TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    "largeCratesOut" NUMERIC DEFAULT 0,
    "smallCratesOut" NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('confirmed', 'pending')),
    timestamp TEXT
);

-- 13. Create public.loading_requests table (Mendoub requests for stock)
CREATE TABLE public.loading_requests (
    id TEXT PRIMARY KEY,
    "representativeId" TEXT NOT NULL,
    "representativeName" TEXT NOT NULL,
    date TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    "selectedCustomers" JSONB DEFAULT '[]'::jsonb,
    "nonPreferredWarning" BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    "editRequested" BOOLEAN DEFAULT false,
    "canEdit" BOOLEAN DEFAULT true,
    timestamp TEXT
);

-- 14. Create public.car_returns table (Surplus and damaged items returned)
CREATE TABLE public.car_returns (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "representativeName" TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    "largeCratesIn" NUMERIC DEFAULT 0,
    "smallCratesIn" NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('confirmed', 'pending')),
    timestamp TEXT
);

-- 15. Create public.routes table (Live tracking GPS coordinates)
CREATE TABLE public.routes (
    id TEXT PRIMARY KEY,
    "representativeId" TEXT NOT NULL,
    date TEXT NOT NULL,
    points JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 16. Create public.master_routes table (Master Sales Routes)
CREATE TABLE public.master_routes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT
);

-- Migration helpers for existing tables (if not using DROP)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "routeId" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "routeName" TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "routeId" TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "routeName" TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "preferredDays" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "routeId" TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "routeName" TEXT;
ALTER TABLE public.loading_requests ADD COLUMN IF NOT EXISTS "selectedCustomers" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.loading_requests ADD COLUMN IF NOT EXISTS "nonPreferredWarning" BOOLEAN DEFAULT false;
ALTER TABLE public.loading_requests ADD COLUMN IF NOT EXISTS "editRequested" BOOLEAN DEFAULT false;
ALTER TABLE public.loading_requests ADD COLUMN IF NOT EXISTS "canEdit" BOOLEAN DEFAULT true;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_loadings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.loading_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_returns DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_routes DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. INSERT DEFAULT CONFIG & SEED DATA
-- ==========================================
INSERT INTO public.settings (id, "dailyTarget", "factoryLocation")
VALUES ('default', 1000, '{"lat": 30.0444, "lng": 31.2357}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.system_config (id, "expiryDate", "isActive", "lockMessage")
VALUES ('config', '2030-12-31', true, 'النظام مقفل حالياً. يرجى مراجعة المطور.')
ON CONFLICT (id) DO NOTHING;

-- Initial master users
INSERT INTO public.users (uid, id, name, email, role, password, "baseSalary", "salaryType", "targetBonus", status) VALUES
('developer-uid-default', 'developer-uid-default', 'المطور الرئيسي', 'okapp974@gmail.com', 'developer', 'Moh@123@', 0, 'monthly', 0, 'active'),
('admin-uid-default', 'admin-uid-default', 'المدير العام (الرئيسي)', 'admin@ok.com', 'manager', '123456789', 0, 'monthly', 0, 'active'),
('amin-uid-default', 'amin-uid-default', 'أمين - الإدارة', 'amin@ok.com', 'manager', '123456789', 0, 'monthly', 0, 'active'),
('mohsen-uid-default', 'mohsen-uid-default', 'محسن - المحاسبة', 'mohsen@ok.com', 'accountant', '123456789', 0, 'monthly', 0, 'active')
ON CONFLICT (uid) DO NOTHING;

-- Initial products for the ice cream factory
INSERT INTO public.products (id, name, price, "sortOrder", flavors, "isFrozen") VALUES
('prod-1', 'كونو آيس كريم (كبير)', 15.00, 1, '["فانيليا", "شوكولاتة", "فراولة"]'::jsonb, true),
('prod-2', 'كوب آيس كريم (صغير)', 8.00, 2, '["فانيليا", "مانجو", "توت"]'::jsonb, true),
('prod-3', 'ستيك آيس كريم مغطى بالشوكولاتة', 12.00, 3, '["فانيليا وبندق", "كراميل"]'::jsonb, true),
('prod-4', 'علبة عائلية 1 لتر', 45.00, 4, '["شوكولاتة داكنة", "فواكه مشكلة"]'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- Initial master routes
INSERT INTO public.master_routes (id, name, code, description) VALUES
('route-1', 'خط الهرم والجيزة', 'R01', 'منطقة الهرم وفيصل والجيزة'),
('route-2', 'خط المعادي والمقطم', 'R02', 'منطقة المعادي والدائري والمقطم'),
('route-3', 'خط مدينة نصر والتجمع', 'R03', 'منطقة مدينة نصر ومصر الجديدة والتجمع'),
('route-4', 'خط وسط البلد وشبرا', 'R04', 'منطقة وسط البلد وشبرا والظاهر')
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 5. ENABLE REALTIME FOR ALL TABLES
-- ==========================================
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE 
  public.users, 
  public.products, 
  public.customers, 
  public.invoices, 
  public.settlements, 
  public.loans, 
  public.attendance, 
  public.settings, 
  public.system_config, 
  public.notifications, 
  public.car_loadings, 
  public.loading_requests, 
  public.car_returns, 
  public.routes,
  public.master_routes;
`;

