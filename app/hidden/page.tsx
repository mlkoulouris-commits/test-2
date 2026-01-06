import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { DollarSign, FileText, Package, RefreshCw, UserCheck, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HiddenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const hiddenPages = [
    {
      href: "/dashboard/sales",
      label: "Enter Daily Sales",
      description: "Record daily cash and card sales",
      icon: DollarSign,
    },
    {
      href: "/admin/transactions",
      label: "Record Transaction",
      description: "Log receipts with line items",
      icon: FileText,
    },
    {
      href: "/dashboard/schedule",
      label: "Manage Schedule",
      description: "Manage shifts and clock in/out",
      icon: Users,
    },
    {
      href: "/dashboard/staff-status",
      label: "Staff Status",
      description: "View and manage staff status",
      icon: UserCheck,
    },
    {
      href: "/dashboard/inventory",
      label: "Check Inventory",
      description: "Track stock and supplier invoices",
      icon: Package,
    },
    {
      href: "/admin/barsy-sync",
      label: "Barsy Sync",
      description: "Sync sales and inventory data from Barsy POS",
      icon: RefreshCw,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Hidden Pages</h1>
            <p className="text-muted-foreground mt-2">
              Access to pages that have been hidden from the main navigation
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {hiddenPages.map((page) => {
              const Icon = page.icon;
              return (
                <Link key={page.href} href={page.href} className="block">
                  <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <Icon className="h-6 w-6 text-primary" />
                        <CardTitle className="text-lg">{page.label}</CardTitle>
                      </div>
                      <CardDescription>{page.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
