"use client";

import { AccountSelector } from "@/components/admin/account-selector";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  getVendorById,
  getVendorSuppliers,
  toggleVendorStatus,
  updateVendor,
  updateVendorDefaultAccount,
  type BarsySupplier,
} from "@/lib/actions/vendors";
import { BookOpen, Check } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Vendor {
  id: number;
  name: string;
  name_bg: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  payment_terms: string | null;
  notes: string | null;
  tax_id: string | null;
  vat_number: string | null;
  legal_form: string | null;
  address: string | null;
  city: string | null;
  registration_date: string | null;
  revenue_amount: number | null;
  revenue_year: number | null;
  employees_count: number | null;
  employees_year: number | null;
  capital_amount: number | null;
  business_activity: string | null;
  papagal_url: string | null;
  papagal_last_sync: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  default_account_id: number | null;
  default_account_code: string | null;
  default_account_name: string | null;
}

export default function VendorDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = parseInt(params.id as string);

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [suppliers, setSuppliers] = useState<BarsySupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [defaultAccountId, setDefaultAccountId] = useState<number | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);

  const loadVendor = async () => {
    setLoading(true);
    setError(null);
    const result = await getVendorById(vendorId);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setVendor(result.data as Vendor);
      setDefaultAccountId(result.data.default_account_id || null);
    }
    setLoading(false);
  };

  const loadSuppliers = async () => {
    setLoadingSuppliers(true);
    const result = await getVendorSuppliers(vendorId);

    if (!result.error && result.data) {
      setSuppliers(result.data);
    }
    setLoadingSuppliers(false);
  };

  useEffect(() => {
    loadVendor();
    loadSuppliers();
  }, [vendorId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!vendor) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      nameBg: formData.get("nameBg") as string,
      contactName: formData.get("contactName") as string,
      contactEmail: formData.get("contactEmail") as string,
      contactPhone: formData.get("contactPhone") as string,
      paymentTerms: formData.get("paymentTerms") as string,
      notes: formData.get("notes") as string,
      taxId: formData.get("taxId") as string,
    };

    const result = await updateVendor(vendorId, data);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      loadVendor();
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  };

  const handleToggleStatus = async () => {
    if (!vendor) return;

    const result = await toggleVendorStatus(vendorId, !vendor.is_active);
    if (!result.error) {
      loadVendor();
    }
  };

  const handleSaveDefaultAccount = async () => {
    setSavingAccount(true);
    setAccountSaved(false);

    const result = await updateVendorDefaultAccount(vendorId, defaultAccountId);

    if (!result.error) {
      setAccountSaved(true);
      loadVendor();
      setTimeout(() => setAccountSaved(false), 3000);
    }
    setSavingAccount(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/vendors">Vendors</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Loading...</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/vendors">Vendors</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Error</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error || "Vendor not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/vendors">Vendors</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{vendor.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{vendor.name}</h1>
          <p className="text-muted-foreground mt-2">Vendor Details</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={vendor.is_active ? "default" : "secondary"}>
            {vendor.is_active ? "Active" : "Inactive"}
          </Badge>
          <Button variant="outline" onClick={handleToggleStatus}>
            {vendor.is_active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendor Information</CardTitle>
          <CardDescription>
            Update vendor details and contact information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Vendor Name (English)</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    disabled={saving}
                    defaultValue={vendor.name}
                    placeholder="e.g., Sofia Beverages Ltd"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nameBg">Vendor Name (Bulgarian)</Label>
                  <Input
                    id="nameBg"
                    name="nameBg"
                    disabled={saving}
                    defaultValue={vendor.name_bg || ""}
                    placeholder="напр., София Бевъриджис ЕООД"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="contactName">Contact Name</Label>
                  <Input
                    id="contactName"
                    name="contactName"
                    disabled={saving}
                    defaultValue={vendor.contact_name || ""}
                    placeholder="Contact person"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    name="contactPhone"
                    type="tel"
                    disabled={saving}
                    defaultValue={vendor.contact_phone || ""}
                    placeholder="+359 xxx xxx xxx"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  disabled={saving}
                  defaultValue={vendor.contact_email || ""}
                  placeholder="vendor@example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Input
                    id="paymentTerms"
                    name="paymentTerms"
                    disabled={saving}
                    defaultValue={vendor.payment_terms || ""}
                    placeholder="e.g., Net 30"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="taxId">Tax ID / Bulstat</Label>
                  <Input
                    id="taxId"
                    name="taxId"
                    disabled={saving}
                    defaultValue={vendor.tax_id || ""}
                    placeholder="e.g., 123456789"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  disabled={saving}
                  defaultValue={vendor.notes || ""}
                  placeholder="Additional notes"
                  rows={4}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && (
              <p className="text-sm text-green-600">
                Vendor updated successfully!
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/admin/vendors")}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Default Chart of Accounts
          </CardTitle>
          <CardDescription>
            Set the default expense account for bills from this vendor. This
            will be used when no specific account is assigned to a bill.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AccountSelector
            value={defaultAccountId}
            onChange={setDefaultAccountId}
            label="Default Expense Account"
            placeholder="Select default account..."
            disabled={savingAccount}
          />

          <div className="flex items-center gap-4">
            <Button
              onClick={handleSaveDefaultAccount}
              disabled={
                savingAccount || defaultAccountId === vendor.default_account_id
              }
            >
              {savingAccount ? "Saving..." : "Save Default Account"}
            </Button>
            {accountSaved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <Check className="h-4 w-4" />
                Saved
              </span>
            )}
          </div>

          {vendor.default_account_code &&
            defaultAccountId === vendor.default_account_id && (
              <p className="text-sm text-muted-foreground">
                Current default:{" "}
                <span className="font-mono">{vendor.default_account_code}</span>{" "}
                - {vendor.default_account_name}
              </p>
            )}
        </CardContent>
      </Card>

      {(vendor.vat_number ||
        vendor.legal_form ||
        vendor.address ||
        vendor.revenue_amount ||
        vendor.employees_count) && (
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>
              Additional company details (manually entered)
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {vendor.vat_number && (
              <div>
                <Label className="text-muted-foreground">VAT Number</Label>
                <p className="font-medium">{vendor.vat_number}</p>
              </div>
            )}
            {vendor.legal_form && (
              <div>
                <Label className="text-muted-foreground">Legal Form</Label>
                <p className="font-medium">{vendor.legal_form}</p>
              </div>
            )}
            {vendor.registration_date && (
              <div>
                <Label className="text-muted-foreground">
                  Registration Date
                </Label>
                <p className="font-medium">
                  {new Date(vendor.registration_date).toLocaleDateString()}
                </p>
              </div>
            )}
            {vendor.city && (
              <div>
                <Label className="text-muted-foreground">City</Label>
                <p className="font-medium">{vendor.city}</p>
              </div>
            )}
            {vendor.address && (
              <div className="md:col-span-2">
                <Label className="text-muted-foreground">Address</Label>
                <p className="font-medium">{vendor.address}</p>
              </div>
            )}
            {vendor.revenue_amount && (
              <div>
                <Label className="text-muted-foreground">Revenue</Label>
                <p className="font-medium">
                  {vendor.revenue_amount.toLocaleString()} лв
                  {vendor.revenue_year && ` (${vendor.revenue_year})`}
                </p>
              </div>
            )}
            {vendor.employees_count && (
              <div>
                <Label className="text-muted-foreground">Employees</Label>
                <p className="font-medium">
                  {vendor.employees_count}
                  {vendor.employees_year && ` (${vendor.employees_year})`}
                </p>
              </div>
            )}
            {vendor.capital_amount && (
              <div>
                <Label className="text-muted-foreground">Capital</Label>
                <p className="font-medium">
                  {vendor.capital_amount.toLocaleString()} лв
                </p>
              </div>
            )}
            {vendor.business_activity && (
              <div className="md:col-span-2">
                <Label className="text-muted-foreground">
                  Business Activity
                </Label>
                <p className="font-medium text-sm">
                  {vendor.business_activity}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Linked Barsy Suppliers</CardTitle>
          <CardDescription>
            Supplier records from Barsy locations linked to this vendor master
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSuppliers ? (
            <p className="text-center text-muted-foreground py-8">
              Loading suppliers...
            </p>
          ) : suppliers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No linked suppliers found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Supplier ID</TableHead>
                  <TableHead>Bulstat</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">
                      {supplier.supplier_name}
                    </TableCell>
                    <TableCell>
                      {supplier.barsy_locations?.name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      #{supplier.supplier_id}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {supplier.bulstat || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {supplier.contact_person && (
                        <div>
                          <div>{supplier.contact_person}</div>
                          {supplier.phone && (
                            <div className="text-xs text-muted-foreground">
                              {supplier.phone}
                            </div>
                          )}
                        </div>
                      )}
                      {!supplier.contact_person && supplier.phone && (
                        <div className="text-muted-foreground">
                          {supplier.phone}
                        </div>
                      )}
                      {!supplier.contact_person && !supplier.phone && "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={supplier.is_active ? "default" : "secondary"}
                      >
                        {supplier.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span>{new Date(vendor.created_at).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Updated:</span>
            <span>{new Date(vendor.updated_at).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
