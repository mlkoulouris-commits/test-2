export interface Bill {
  id: number;
  source: "barsy" | "manual";
  location_id: number;
  vendor_id: number;
  doc_num: string | null;
  doc_date: string | null;
  due_date: string | null;
  total_amount: number;
  total_paid: number;
  balance: number;
  status: "approved" | "partially_paid" | "paid" | "voided";
  description: string | null;
  vendor_name: string | null;
  location_name: string | null;
  created_at: string;
  attachment_count?: number;
  has_vat?: boolean;
  vat_rate?: number | null;
  vat_amount?: number | null;
}

export interface BillStats {
  totalUnpaid: number;
  partiallyPaid: number;
  outstanding: number;
  overdue: number;
  dueThisMonth: number;
}

export interface BillItem {
  id: number;
  bill_id: number;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  vat_rate?: number | null;
  vat_amount?: number | null;
}

export interface BillPaymentApplication {
  bill_id: number;
  amount_applied: number;
}

export interface PaymentRecord {
  location_id: number;
  payment_method: "cash" | "bank_transfer" | "check" | "other";
  payment_date: string;
  total_amount: number;
  bank_account_id?: number | null;
  reference_number?: string | null;
  notes?: string | null;
  applications: BillPaymentApplication[];
}

export interface BillPaymentWithDetails {
  id: number;
  location_id: number;
  payment_method: string;
  payment_date: string;
  total_amount: number;
  bank_account_id: number | null;
  reference_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  locations?: {
    name: string;
  };
  bank_accounts?: {
    account_name: string;
    bank_name: string | null;
  } | null;
  profiles?: {
    first_name: string;
    last_name: string;
  } | null;
}

export interface PaymentStats {
  totalPayments: number;
  totalAmount: number;
  byMethod: Record<string, { count: number; amount: number }>;
}

export interface PaymentApplicationDetail {
  id: number;
  bill_id: number;
  amount_applied: number;
  bill_doc_num: string | null;
  bill_doc_date: string | null;
  bill_total_amount: number;
  vendor_name: string | null;
}

export interface BillPaymentDetails extends BillPaymentWithDetails {
  applications: PaymentApplicationDetail[];
}

export type RecurringFrequency = "weekly" | "monthly" | "bimonthly";

export interface RecurringBillTemplate {
  id: number;
  location_id: number;
  vendor_id: number;
  frequency: RecurringFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  default_amount: number;
  description: string | null;
  due_date_offset: number;
  account_id: number | null;
  is_active: boolean;
  last_generated_at: string | null;
  next_generation_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined fields
  location_name?: string;
  vendor_name?: string;
  account_code?: string | null;
  account_name?: string | null;
}

export interface PendingRecurringBill {
  template: RecurringBillTemplate;
  period_start: string;
  period_end: string;
  due_date: string;
  already_exists: boolean;
}

export interface CreateRecurringTemplateInput {
  location_id: number;
  vendor_id: number;
  frequency: RecurringFrequency;
  day_of_week?: number | null;
  day_of_month?: number | null;
  default_amount?: number;
  description?: string | null;
  due_date_offset?: number;
  account_id?: number | null;
}

export interface UpdateRecurringTemplateInput {
  frequency?: RecurringFrequency;
  day_of_week?: number | null;
  day_of_month?: number | null;
  default_amount?: number;
  description?: string | null;
  due_date_offset?: number;
  account_id?: number | null;
  is_active?: boolean;
}
