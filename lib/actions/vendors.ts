"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface CreateVendorData {
  name: string;
  nameBg?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  paymentTerms?: string;
  notes?: string;
}

export const createVendor = async (data: CreateVendorData) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: vendor, error } = await supabase
    .from("vendors")
    .insert({
      name: data.name,
      name_bg: data.nameBg,
      contact_name: data.contactName,
      contact_email: data.contactEmail,
      contact_phone: data.contactPhone,
      payment_terms: data.paymentTerms,
      notes: data.notes,
      created_by: user?.id || null,
      updated_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/vendors");
  return { success: true, data: vendor };
};

export const getAllVendors = async (options?: {
  page?: number;
  pageSize?: number;
  search?: string;
}) => {
  const supabase = await createClient();
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 10;
  const search = options?.search?.trim();

  let countQuery = supabase
    .from("vendors")
    .select("*", { count: "exact", head: true });

  let dataQuery = supabase.from("vendors").select("*").order("name");

  // Apply search filter
  if (search) {
    countQuery = countQuery.or(
      `name.ilike.%${search}%,contact_name.ilike.%${search}%,contact_email.ilike.%${search}%`
    );
    dataQuery = dataQuery.or(
      `name.ilike.%${search}%,contact_name.ilike.%${search}%,contact_email.ilike.%${search}%`
    );
  }

  // Get total count
  const { count, error: countError } = await countQuery;

  if (countError) {
    return { error: countError.message };
  }

  // Get paginated data
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await dataQuery.range(from, to);

  if (error) {
    return { error: error.message };
  }

  return { data, total: count || 0 };
};

export const getVendorById = async (id: number) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vendors")
    .select(
      `
      *,
      chart_of_accounts!vendors_default_account_id_fkey (
        id,
        code,
        name,
        name_bg
      )
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    return { error: error.message };
  }

  return {
    data: {
      ...data,
      default_account_code: data.chart_of_accounts?.code || null,
      default_account_name: data.chart_of_accounts?.name || null,
    },
  };
};

export interface UpdateVendorData {
  name?: string;
  nameBg?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  paymentTerms?: string;
  notes?: string;
  taxId?: string;
  defaultAccountId?: number | null;
}

export const updateVendor = async (id: number, data: UpdateVendorData) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const updateData: Record<string, unknown> = {
    updated_by: user?.id || null,
    updated_at: new Date().toISOString(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.nameBg !== undefined) updateData.name_bg = data.nameBg;
  if (data.contactName !== undefined)
    updateData.contact_name = data.contactName;
  if (data.contactEmail !== undefined)
    updateData.contact_email = data.contactEmail;
  if (data.contactPhone !== undefined)
    updateData.contact_phone = data.contactPhone;
  if (data.paymentTerms !== undefined)
    updateData.payment_terms = data.paymentTerms;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.taxId !== undefined) updateData.tax_id = data.taxId;
  if (data.defaultAccountId !== undefined)
    updateData.default_account_id = data.defaultAccountId;

  const { error } = await supabase
    .from("vendors")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/vendors/${id}`);
  return { success: true };
};

export const toggleVendorStatus = async (id: number, isActive: boolean) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("vendors")
    .update({
      is_active: isActive,
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/vendors/${id}`);
  return { success: true };
};

export interface BarsySupplier {
  id: number;
  barsy_location_id: string;
  supplier_id: number;
  supplier_name: string;
  bulstat: string | null;
  vat_number: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  is_active: boolean;
  payment_terms_days: number | null;
  barsy_locations?: {
    name: string;
  };
}

export const getVendorSuppliers = async (vendorId: number) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("barsy_suppliers")
    .select(
      `
      *,
      barsy_locations!barsy_suppliers_barsy_location_id_fkey (name)
    `
    )
    .eq("vendor_id", vendorId)
    .order("supplier_name");

  if (error) {
    return { error: error.message };
  }

  return { data: data as BarsySupplier[] };
};

// Update vendor default account
export const updateVendorDefaultAccount = async (
  vendorId: number,
  accountId: number | null
) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("vendors")
    .update({
      default_account_id: accountId,
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", vendorId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/vendors");
  revalidatePath("/admin/bills");
  return { success: true };
};
