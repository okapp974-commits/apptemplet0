-- ==========================================
-- Supabase Database Setup Script for OK App
-- نصوص تهيئة قاعدة البيانات لبرنامج OK
-- ==========================================

-- 1. Drop existing tables if they exist to start fresh
-- حذف الجداول الحالية إذا كانت موجودة للبدء من جديد
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

-- 2. Create public.users table (User profiles)
-- جدول المستخدمين والملفات الشخصية للوصول بالصلاحيات
CREATE TABLE public.users (
    uid TEXT PRIMARY KEY,
    id TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('manager', 'accountant', 'supervisor', 'representative', 'storekeeper', 'developer')),
    password TEXT,
    "baseSalary" NUMERIC DEFAULT 0,
    "salaryType" TEXT DEFAULT 'monthly',
    "targetBonus" NUMERIC DEFAULT 0,
    "lastLocation" JSONB,
    "photoURL" TEXT,
    "fcmTokens" JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    updated_at TEXT
);

-- 3. Create public.products table (Inventory)
-- جدول المنتجات في المخزون
CREATE TABLE public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    "sortOrder" NUMERIC DEFAULT 0,
    flavors JSONB DEFAULT '[]'::jsonb,
    "isFrozen" BOOLEAN DEFAULT false
);

-- 4. Create public.customers table (Clients & Shops)
-- جدول العملاء والمحلات التجارية والمندوبين المسؤولين
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
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    "preferredDays" JSONB DEFAULT '[]'::jsonb,
    timestamp TEXT
);

-- 5. Create public.invoices table (Sales logs)
-- جدول الفواتير والمبيعات اليومية
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
    timestamp TEXT
);

-- 6. Create public.settlements table (Daily account reconciliation)
-- جدول التسويات اليومية للمندوبين
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
-- جدول السلفيات والقروض للموظفين
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
-- جدول الحضور والغياب اليومي للموظفين
CREATE TABLE public.attendance (
    id TEXT PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    date TEXT NOT NULL,
    timestamp TEXT,
    type TEXT DEFAULT 'present' CHECK (type IN ('present', 'absent'))
);

-- 9. Create public.settings table (System-wide configuration defaults)
-- جدول الإعدادات العامة مثل الهدف اليومي والموقع الرئيسي للمصنع
CREATE TABLE public.settings (
    id TEXT PRIMARY KEY,
    "dailyTarget" NUMERIC DEFAULT 1000,
    "factoryLocation" JSONB
);

-- 10. Create public.system_config table (License & Status validation)
-- جدول ترخيص وتفعيل النظام وتاريخ الانتهاء
CREATE TABLE public.system_config (
    id TEXT PRIMARY KEY,
    "expiryDate" TEXT NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "lockMessage" TEXT
);

-- 11. Create public.notifications table (Realtime alerts & logs)
-- جدول الإشعارات العامة والخاصة بين المندوبين والإدارة
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
-- جدول تحميلات السيارات الصباحية لكل مندوب
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
-- جدول طلبات التحميل المقدمة من المندوبين وبانتظار موافقة الإدارة
CREATE TABLE public.loading_requests (
    id TEXT PRIMARY KEY,
    "representativeId" TEXT NOT NULL,
    "representativeName" TEXT NOT NULL,
    date TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    "editRequested" BOOLEAN DEFAULT false,
    "canEdit" BOOLEAN DEFAULT true,
    timestamp TEXT
);

-- 14. Create public.car_returns table (Surplus and damaged items returned)
-- جدول مرتجعات السيارات والمتبقي والصناديق الفارغة في نهاية اليوم
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
-- جدول مسارات حركة المندوبين ومواقع الزيارات اليومية على الخريطة
CREATE TABLE public.routes (
    id TEXT PRIMARY KEY,
    "representativeId" TEXT NOT NULL,
    date TEXT NOT NULL,
    points JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- ==========================================
-- 3. DISABLE ROW LEVEL SECURITY (RLS) FOR FREE CLIENT ACCESS
-- تعطيل نظام الحماية لتسهيل وصول التطبيق مباشرة للقراءة والكتابة
-- ==========================================
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

-- ==========================================
-- 4. INSERT DEFAULT CONFIG & SEED DATA
-- إدخال إعدادات النظام الأولية الافتراضية للتشغيل دون أخطاء
-- ==========================================
INSERT INTO public.settings (id, "dailyTarget", "factoryLocation")
VALUES ('default', 1000, '{"lat": 30.0444, "lng": 31.2357}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.system_config (id, "expiryDate", "isActive", "lockMessage")
VALUES ('config', '2030-12-31', true, 'النظام مقفل حالياً. يرجى مراجعة المطور.')
ON CONFLICT (id) DO NOTHING;

-- Initial products for the ice cream factory
-- إدخال منتجات افتراضية لمصنع الآيس كريم لضمان التشغيل الأولي
INSERT INTO public.products (id, name, price, "sortOrder", flavors, "isFrozen") VALUES
('prod-1', 'كونو آيس كريم (كبير)', 15.00, 1, '["فانيليا", "شوكولاتة", "فراولة"]'::jsonb, true),
('prod-2', 'كوب آيس كريم (صغير)', 8.00, 2, '["فانيليا", "مانجو", "توت"]'::jsonb, true),
('prod-3', 'ستيك آيس كريم مغطى بالشوكولاتة', 12.00, 3, '["فانيليا وبندق", "كراميل"]'::jsonb, true),
('prod-4', 'علبة عائلية 1 لتر', 45.00, 4, '["شوكولاتة داكنة", "فواكه مشكلة"]'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 5. ENABLE REALTIME FOR ALL TABLES
-- تفعيل قنوات التحديث المباشر واللحظي لجميع جداول قاعدة البيانات تلقائياً
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
  public.routes;

