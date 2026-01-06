# Vendor Data Fields Guide

This document explains the vendor data fields available in the system and how to populate them.

## Overview

The vendor form includes extended company information fields for Bulgarian vendors. These fields help maintain comprehensive vendor records including official registration data, financial information, and contact details.

## Database Fields

The `vendors` table includes the following fields:

### Basic Information
- `name` (required) - Company name in English
- `name_bg` - Company name in Bulgarian (Cyrillic)
- `tax_id` - EIK/Bulstat number (Bulgarian company ID)
- `contact_name` - Primary contact person
- `contact_email` - Contact email address
- `contact_phone` - Contact phone number
- `payment_terms` - Payment terms (e.g., "Net 30")
- `notes` - General notes and comments

### Official Registration Data
- `vat_number` - VAT registration number (format: BG + number)
- `legal_form` - Legal entity type (ООД, ЕООД, АД, etc.)
- `address` - Full registered address
- `city` - City/municipality
- `registration_date` - Date of company registration

### Financial Information
- `revenue_amount` - Annual revenue
- `revenue_year` - Year of revenue data
- `employees_count` - Number of employees
- `employees_year` - Year of employee count
- `capital_amount` - Registered capital amount

### Business Details
- `business_activity` - Description of business activities

### System Fields
- `is_active` - Whether vendor is active
- `created_at` - Record creation timestamp
- `updated_at` - Last update timestamp
- `created_by` - User who created record
- `updated_by` - User who last updated record

## How to Populate Vendor Data

### Manual Data Entry (Recommended)

1. **Navigate to vendor detail page**
   ```
   /admin/vendors/{id}
   ```

2. **Fill in basic information**
   - Required: Company name (English)
   - Recommended: Bulgarian name, tax ID
   - Contact details

3. **Add official company data** (if available)
   - Visit [Papagal.bg](https://papagal.bg) manually
   - Search for company by EIK
   - Copy relevant information
   - Paste into vendor form

4. **Save changes**
   - Click "Save Changes"
   - Data is immediately available

### Where to Find Company Data

#### Papagal.bg (Primary Source)
- URL: https://papagal.bg
- Search by: EIK/Bulstat number or company name
- Provides:
  - ✓ Official names (BG & EN)
  - ✓ VAT registration
  - ✓ Legal form
  - ✓ Address
  - ✓ Financial data (revenue, employees, capital)
  - ✓ Registration date

#### BULSTAT Registry (Official Source)
- URL: https://reports.bulstat.bg
- Search by: Bulstat code
- Provides:
  - ✓ Official registration data
  - ✓ Legal status
  - ✓ Registered address
  - ✓ Business activities

#### Company Documents
- Invoices: Often include VAT number, address
- Contracts: Legal name, registration details
- Business cards: Contact information
- Website: Company information page

## Best Practices

### Data Quality
✓ **Verify critical information** - Double-check EIK, VAT numbers
✓ **Use official sources** - Papagal.bg or BULSTAT registry
✓ **Document sources** - Note where data came from in notes field
✓ **Update regularly** - Review vendor data quarterly/annually
✓ **Keep contacts current** - Update email/phone when they change

### What to Prioritize
1. **Essential** (for all vendors):
   - Company name (English)
   - Tax ID (EIK)
   - Contact information
   - Payment terms

2. **Important** (for major vendors):
   - Bulgarian company name
   - VAT number
   - Legal form
   - Full address

3. **Optional** (nice to have):
   - Financial data
   - Registration date
   - Business activity description

### Data Entry Tips
- **Copy-paste carefully** - Avoid typos in numbers
- **Format consistently** - Use standard formats
  - VAT: BG123456789
  - Phone: +359 XXX XXX XXX
  - Dates: YYYY-MM-DD
- **Complete sections** - If adding financial data, include the year
- **Use notes field** - Document special arrangements, history

## Field Formats & Examples

### Tax ID (EIK/Bulstat)
```
Format: 9 or 13 digits
Examples:
  201050150
  130591250
```

### VAT Number
```
Format: BG + 9 or 13 digits
Examples:
  BG201050150
  BG130591250
```

### Legal Form
```
Common types:
  - ООД (Дружество с ограничена отговорност)
  - ЕООД (Еднолично дружество с ограничена отговорност)
  - АД (Акционерно дружество)
  - ЕАД (Еднолично акционерно дружество)
  - ЕТ (Едноличен търговец)
```

### Address
```
Format: Full address with postal code
Example:
  БЪЛГАРИЯ, гр. София (1528), р-н Искър, 
  бул. "Искърско шосе" No 7, ет. 2
```

### Revenue/Capital
```
Format: Numeric value in BGN
Examples:
  105564000 (105.5 million BGN)
  500000 (500k BGN capital)
```

### Employees
```
Format: Integer number
Examples:
  145 (145 employees)
  5 (5 employees)
```

## Company Information Card

When extended company data is entered, a "Company Information" card appears on the vendor detail page showing:

- VAT Number
- Legal Form
- Registration Date
- City
- Full Address
- Revenue (with year)
- Employee count (with year)
- Capital amount
- Business Activity

This provides a comprehensive view of the vendor's official status and size.

## Why Manual Entry?

**Note**: An automated sync feature was previously implemented but removed due to:
- Cloudflare bot protection on Papagal.bg
- CAPTCHA requirements on BULSTAT
- Unreliable automated scraping
- Terms of Service concerns

**Manual entry is:**
- ✓ More reliable
- ✓ Allows data verification
- ✓ Respects website terms of service
- ✓ Gives control over what's stored
- ✓ Faster for individual vendors

## Bulk Import (Future)

Planned features for easier data management:
- CSV import for multiple vendors
- Copy-paste from spreadsheet
- Template download for data entry
- Duplicate vendor detection

## Support & Questions

For data entry assistance:
1. Check vendor's official documents (invoices, contracts)
2. Search Papagal.bg manually: https://papagal.bg
3. Contact vendor directly for updated information
4. Document data source in notes field

---

**Remember**: Data quality is more important than data quantity. It's better to have accurate basic information than incomplete extended data.


