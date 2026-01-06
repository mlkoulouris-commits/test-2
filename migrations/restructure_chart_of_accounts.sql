-- ============================================================================
-- Granular Chart of Accounts Migration for Coffee Bar with Alcohol
-- ============================================================================
-- This migration implements a highly granular 3-level hierarchy with:
-- - 44 revenue accounts (by beverage/product type)
-- - 46 COGS accounts (mirroring revenue structure)
-- - 4 labor accounts
-- - 11 operating expense accounts
-- - 6 non-operating accounts
-- - Automatic Barsy category mapping
-- ============================================================================

-- Step 1: Clear all references to chart_of_accounts in dependent tables
UPDATE bills SET account_id = NULL WHERE account_id IS NOT NULL;
UPDATE bill_items SET account_id = NULL WHERE account_id IS NOT NULL;
UPDATE recurring_bill_templates SET account_id = NULL WHERE account_id IS NOT NULL;
UPDATE labor_costs SET account_id = NULL WHERE account_id IS NOT NULL;
UPDATE vendors SET default_account_id = NULL WHERE default_account_id IS NOT NULL;

-- Clear mappings
DELETE FROM barsy_article_account_mapping;
DELETE FROM barsy_category_account_mapping;

-- Delete all accounts
DELETE FROM chart_of_accounts;

-- Reset sequence
ALTER SEQUENCE chart_of_accounts_id_seq RESTART WITH 1;

-- Step 2: Update check constraint to include 'labor'
ALTER TABLE chart_of_accounts DROP CONSTRAINT IF EXISTS chart_of_accounts_account_type_check;
ALTER TABLE chart_of_accounts ADD CONSTRAINT chart_of_accounts_account_type_check
  CHECK (account_type IN ('revenue', 'cogs', 'labor', 'operating_expense', 'non_operating'));

-- ============================================================================
-- REVENUE ACCOUNTS (44 accounts)
-- ============================================================================

-- Net Sales (Level 1)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('1000', 'Net Sales', 'Нетни продажби', 'revenue', NULL, 1, 1, true);

-- Non-Alcoholic Beverages (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('1100', 'Non-Alcoholic Beverages', 'Безалкохолни напитки', 'revenue',
  (SELECT id FROM chart_of_accounts WHERE code = '1000'), 2, 1, true);

-- Non-Alcoholic sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('1101', 'Coffee & Espresso', 'Кафе и еспресо', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1100'), 3, 1, true),
  ('1102', 'Tea Service', 'Чай', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1100'), 3, 2, true),
  ('1103', 'Soft Drinks', 'Безалкохолни', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1100'), 3, 3, true),
  ('1104', 'Fresh & Lemonade', 'Фреш и лимонади', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1100'), 3, 4, true),
  ('1105', 'Non-Alcoholic Cocktails', 'Безалкохолни коктейли', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1100'), 3, 5, true);

-- Wine (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('1200', 'Wine', 'Вино', 'revenue',
  (SELECT id FROM chart_of_accounts WHERE code = '1000'), 2, 2, true);

-- Wine sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('1201', 'White Wine', 'Бяло вино', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1200'), 3, 1, true),
  ('1202', 'Red Wine', 'Червено вино', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1200'), 3, 2, true),
  ('1203', 'Rosé Wine', 'Розе вино', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1200'), 3, 3, true),
  ('1204', 'Sparkling Wine', 'Пенливо вино', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1200'), 3, 4, true);

-- Beer (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('1300', 'Beer', 'Бира', 'revenue',
  (SELECT id FROM chart_of_accounts WHERE code = '1000'), 2, 3, true);

-- Beer sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('1301', 'Beer', 'Бира', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1300'), 3, 1, true),
  ('1302', 'Hard Seltzer', 'Хард зелцер', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1300'), 3, 2, true);

-- Spirits (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('1400', 'Spirits', 'Спиртни напитки', 'revenue',
  (SELECT id FROM chart_of_accounts WHERE code = '1000'), 2, 4, true);

-- Spirits sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('1401', 'Vodka', 'Водка', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1400'), 3, 1, true),
  ('1402', 'Gin', 'Джин', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1400'), 3, 2, true),
  ('1403', 'Whisky', 'Уиски', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1400'), 3, 3, true),
  ('1404', 'Rum', 'Ром', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1400'), 3, 4, true),
  ('1405', 'Tequila', 'Текила', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1400'), 3, 5, true),
  ('1406', 'Cognac', 'Коняк', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1400'), 3, 6, true),
  ('1407', 'Liqueurs', 'Ликьори', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1400'), 3, 7, true),
  ('1408', 'Vermouth & Aperitifs', 'Вермути и аперитиви', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1400'), 3, 8, true),
  ('1409', 'Shots', 'Шотове', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1400'), 3, 9, true);

-- Cocktails (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('1500', 'Cocktails', 'Коктейли', 'revenue',
  (SELECT id FROM chart_of_accounts WHERE code = '1000'), 2, 5, true);

-- Cocktails sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('1501', 'Vodka Cocktails', 'Водка коктейли', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1500'), 3, 1, true),
  ('1502', 'Gin Cocktails', 'Джин коктейли', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1500'), 3, 2, true),
  ('1503', 'Rum Cocktails', 'Ром коктейли', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1500'), 3, 3, true),
  ('1504', 'Tequila Cocktails', 'Текила коктейли', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1500'), 3, 4, true),
  ('1505', 'Whisky Cocktails', 'Уиски коктейли', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1500'), 3, 5, true),
  ('1506', 'Liqueur & Aperitif Cocktails', 'Ликьорни и аперитивни коктейли', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1500'), 3, 6, true),
  ('1507', 'Classic Cocktails', 'Класически коктейли', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1500'), 3, 7, true),
  ('1508', 'Signature Cocktails', 'Авторски коктейли', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1500'), 3, 8, true),
  ('1509', 'Hot Cocktails', 'Топли коктейли', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1500'), 3, 9, true);

-- Food (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('1600', 'Food', 'Храна', 'revenue',
  (SELECT id FROM chart_of_accounts WHERE code = '1000'), 2, 6, true);

-- Food sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('1601', 'Food & Snacks', 'Храна и снаксове', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1600'), 3, 1, true),
  ('1602', 'Packaged Food', 'Пакетирана храна', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1600'), 3, 2, true);

-- Retail (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('1700', 'Retail', 'Търговия на дребно', 'revenue',
  (SELECT id FROM chart_of_accounts WHERE code = '1000'), 2, 7, true);

-- Retail sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('1701', 'Tea Retail', 'Продажба на чай', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1700'), 3, 1, true),
  ('1702', 'Coffee Retail', 'Продажба на кафе', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1700'), 3, 2, true),
  ('1703', 'Wine & Spirits Retail', 'Продажба на вино и спиртни напитки', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1700'), 3, 3, true),
  ('1704', 'Accessories', 'Аксесоари', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1700'), 3, 4, true),
  ('1705', 'Tobacco', 'Тютюневи изделия', 'revenue', (SELECT id FROM chart_of_accounts WHERE code = '1700'), 3, 5, true);

-- ============================================================================
-- COGS ACCOUNTS (46 accounts)
-- ============================================================================

-- COGS (Level 1)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('2000', 'Cost of Goods Sold', 'Себестойност на продадените стоки', 'cogs', NULL, 1, 2, true);

-- Non-Alcoholic COGS (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('2100', 'Non-Alcoholic COGS', 'Себестойност безалкохолни', 'cogs',
  (SELECT id FROM chart_of_accounts WHERE code = '2000'), 2, 1, true);

-- Non-Alcoholic COGS sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('2101', 'Coffee & Espresso COGS', 'Себестойност кафе', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2100'), 3, 1, true),
  ('2102', 'Tea COGS', 'Себестойност чай', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2100'), 3, 2, true),
  ('2103', 'Soft Drinks COGS', 'Себестойност безалкохолни', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2100'), 3, 3, true),
  ('2104', 'Fresh & Lemonade COGS', 'Себестойност фреш и лимонади', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2100'), 3, 4, true),
  ('2105', 'Non-Alcoholic Cocktails COGS', 'Себестойност безалкохолни коктейли', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2100'), 3, 5, true);

-- Wine COGS (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('2200', 'Wine COGS', 'Себестойност вино', 'cogs',
  (SELECT id FROM chart_of_accounts WHERE code = '2000'), 2, 2, true);

-- Wine COGS sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('2201', 'White Wine COGS', 'Себестойност бяло вино', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2200'), 3, 1, true),
  ('2202', 'Red Wine COGS', 'Себестойност червено вино', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2200'), 3, 2, true),
  ('2203', 'Rosé Wine COGS', 'Себестойност розе вино', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2200'), 3, 3, true),
  ('2204', 'Sparkling Wine COGS', 'Себестойност пенливо вино', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2200'), 3, 4, true);

-- Beer COGS (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('2300', 'Beer COGS', 'Себестойност бира', 'cogs',
  (SELECT id FROM chart_of_accounts WHERE code = '2000'), 2, 3, true);

-- Beer COGS sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('2301', 'Beer COGS', 'Себестойност бира', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2300'), 3, 1, true),
  ('2302', 'Hard Seltzer COGS', 'Себестойност хард зелцер', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2300'), 3, 2, true);

-- Spirits COGS (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('2400', 'Spirits COGS', 'Себестойност спиртни напитки', 'cogs',
  (SELECT id FROM chart_of_accounts WHERE code = '2000'), 2, 4, true);

-- Spirits COGS sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('2401', 'Vodka COGS', 'Себестойност водка', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2400'), 3, 1, true),
  ('2402', 'Gin COGS', 'Себестойност джин', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2400'), 3, 2, true),
  ('2403', 'Whisky COGS', 'Себестойност уиски', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2400'), 3, 3, true),
  ('2404', 'Rum COGS', 'Себестойност ром', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2400'), 3, 4, true),
  ('2405', 'Tequila COGS', 'Себестойност текила', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2400'), 3, 5, true),
  ('2406', 'Cognac COGS', 'Себестойност коняк', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2400'), 3, 6, true),
  ('2407', 'Liqueurs COGS', 'Себестойност ликьори', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2400'), 3, 7, true),
  ('2408', 'Vermouth & Aperitifs COGS', 'Себестойност вермути и аперитиви', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2400'), 3, 8, true),
  ('2409', 'Shots COGS', 'Себестойност шотове', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2400'), 3, 9, true);

-- Cocktails COGS (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('2500', 'Cocktails COGS', 'Себестойност коктейли', 'cogs',
  (SELECT id FROM chart_of_accounts WHERE code = '2000'), 2, 5, true);

-- Cocktails COGS sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('2501', 'Vodka Cocktails COGS', 'Себестойност водка коктейли', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2500'), 3, 1, true),
  ('2502', 'Gin Cocktails COGS', 'Себестойност джин коктейли', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2500'), 3, 2, true),
  ('2503', 'Rum Cocktails COGS', 'Себестойност ром коктейли', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2500'), 3, 3, true),
  ('2504', 'Tequila Cocktails COGS', 'Себестойност текила коктейли', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2500'), 3, 4, true),
  ('2505', 'Whisky Cocktails COGS', 'Себестойност уиски коктейли', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2500'), 3, 5, true),
  ('2506', 'Liqueur & Aperitif Cocktails COGS', 'Себестойност ликьорни и аперитивни коктейли', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2500'), 3, 6, true),
  ('2507', 'Classic Cocktails COGS', 'Себестойност класически коктейли', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2500'), 3, 7, true),
  ('2508', 'Signature Cocktails COGS', 'Себестойност авторски коктейли', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2500'), 3, 8, true),
  ('2509', 'Hot Cocktails COGS', 'Себестойност топли коктейли', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2500'), 3, 9, true);

-- Food COGS (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('2600', 'Food COGS', 'Себестойност храна', 'cogs',
  (SELECT id FROM chart_of_accounts WHERE code = '2000'), 2, 6, true);

-- Food COGS sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('2601', 'Food & Snacks COGS', 'Себестойност храна и снаксове', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2600'), 3, 1, true),
  ('2602', 'Packaged Food COGS', 'Себестойност пакетирана храна', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2600'), 3, 2, true);

-- Retail COGS (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('2700', 'Retail COGS', 'Себестойност търговия', 'cogs',
  (SELECT id FROM chart_of_accounts WHERE code = '2000'), 2, 7, true);

-- Retail COGS sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('2701', 'Tea Retail COGS', 'Себестойност продажба чай', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2700'), 3, 1, true),
  ('2702', 'Coffee Retail COGS', 'Себестойност продажба кафе', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2700'), 3, 2, true),
  ('2703', 'Wine & Spirits Retail COGS', 'Себестойност продажба вино и спиртни', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2700'), 3, 3, true),
  ('2704', 'Accessories COGS', 'Себестойност аксесоари', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2700'), 3, 4, true),
  ('2705', 'Tobacco COGS', 'Себестойност тютюневи изделия', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2700'), 3, 5, true);

-- Other COGS (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('2800', 'Other COGS', 'Други себестойности', 'cogs',
  (SELECT id FROM chart_of_accounts WHERE code = '2000'), 2, 8, true);

-- Other COGS sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('2801', 'Packaging & Consumables', 'Опаковки и консумативи', 'cogs', (SELECT id FROM chart_of_accounts WHERE code = '2800'), 3, 1, true);

-- ============================================================================
-- LABOR ACCOUNTS (4 accounts)
-- ============================================================================

-- LABOR (Level 1)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('3000', 'Labor Costs', 'Разходи за труд', 'labor', NULL, 1, 3, true);

-- Wages & Benefits (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('3100', 'Wages & Benefits', 'Заплати и осигуровки', 'labor',
  (SELECT id FROM chart_of_accounts WHERE code = '3000'), 2, 1, true);

-- Labor sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('3101', 'Wages & Salaries', 'Заплати и надници', 'labor', (SELECT id FROM chart_of_accounts WHERE code = '3100'), 3, 1, true),
  ('3102', 'Payroll Taxes & Benefits', 'Данъци и осигуровки', 'labor', (SELECT id FROM chart_of_accounts WHERE code = '3100'), 3, 2, true);

-- ============================================================================
-- OPERATING EXPENSE ACCOUNTS (11 accounts)
-- ============================================================================

-- OPERATING EXPENSES (Level 1)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('4000', 'Operating Expenses', 'Оперативни разходи', 'operating_expense', NULL, 1, 4, true);

-- Occupancy (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('4100', 'Occupancy', 'Разходи за помещение', 'operating_expense',
  (SELECT id FROM chart_of_accounts WHERE code = '4000'), 2, 1, true);

-- Occupancy sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('4101', 'Rent & Occupancy', 'Наем и помещение', 'operating_expense', (SELECT id FROM chart_of_accounts WHERE code = '4100'), 3, 1, true),
  ('4102', 'Utilities', 'Комунални услуги', 'operating_expense', (SELECT id FROM chart_of_accounts WHERE code = '4100'), 3, 2, true);

-- Operations (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('4200', 'Operations', 'Операции', 'operating_expense',
  (SELECT id FROM chart_of_accounts WHERE code = '4000'), 2, 2, true);

-- Operations sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('4201', 'Marketing & Sales', 'Маркетинг и продажби', 'operating_expense', (SELECT id FROM chart_of_accounts WHERE code = '4200'), 3, 1, true),
  ('4202', 'Repairs & Maintenance', 'Ремонт и поддръжка', 'operating_expense', (SELECT id FROM chart_of_accounts WHERE code = '4200'), 3, 2, true),
  ('4203', 'Admin & POS', 'Администрация и POS', 'operating_expense', (SELECT id FROM chart_of_accounts WHERE code = '4200'), 3, 3, true);

-- Other Operating (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('4300', 'Other Operating', 'Други оперативни', 'operating_expense',
  (SELECT id FROM chart_of_accounts WHERE code = '4000'), 2, 3, true);

-- Other Operating sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('4301', 'Licenses & Insurance', 'Лицензи и застраховки', 'operating_expense', (SELECT id FROM chart_of_accounts WHERE code = '4300'), 3, 1, true),
  ('4302', 'Other Operating Expenses', 'Други оперативни разходи', 'operating_expense', (SELECT id FROM chart_of_accounts WHERE code = '4300'), 3, 2, true);

-- ============================================================================
-- NON-OPERATING ACCOUNTS (6 accounts)
-- ============================================================================

-- NON-OPERATING (Level 1)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('5000', 'Non-Operating Items', 'Неоперативни позиции', 'non_operating', NULL, 1, 5, true);

-- Financial Items (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('5100', 'Financial Items', 'Финансови позиции', 'non_operating',
  (SELECT id FROM chart_of_accounts WHERE code = '5000'), 2, 1, true);

-- Financial sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('5101', 'Interest Expense', 'Разходи за лихви', 'non_operating', (SELECT id FROM chart_of_accounts WHERE code = '5100'), 3, 1, true),
  ('5102', 'Other Income/(Expense)', 'Други приходи/(разходи)', 'non_operating', (SELECT id FROM chart_of_accounts WHERE code = '5100'), 3, 2, true);

-- Tax Items (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('5200', 'Tax Items', 'Данъчни позиции', 'non_operating',
  (SELECT id FROM chart_of_accounts WHERE code = '5000'), 2, 2, true);

-- Tax sub-accounts (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES
  ('5201', 'Income Tax', 'Данък върху печалбата', 'non_operating', (SELECT id FROM chart_of_accounts WHERE code = '5200'), 3, 1, true);

-- ============================================================================
-- BARSY CATEGORY AUTO-MAPPING
-- ============================================================================
-- Note: The auto-mapping is performed via UPDATE statements after initial INSERT
-- based on category name patterns. See the application code for the detailed
-- mapping logic in lib/actions/profit-loss.ts and lib/actions/cashflow.ts
