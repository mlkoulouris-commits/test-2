"use client";

import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { Footer } from "@/components/footer";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/lib/i18n/context";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface Profile {
  first_name: string;
  last_name: string;
  role: string;
}

interface AdminLayoutClientProps {
  children: React.ReactNode;
  profile: Profile | null;
  pendingBillsCount: number;
}

export const AdminLayoutClient = ({
  children,
  profile,
  pendingBillsCount,
}: AdminLayoutClientProps) => {
  const { t } = useLanguage();

  const roleLabels: Record<string, string> = {
    admin: t("roles.admin"),
    manager: t("roles.manager"),
    location_manager: t("roles.locationManager"),
    staff_member: t("roles.staffMember"),
    shareholder: t("roles.shareholder"),
  };

  const navItems = [
    { href: "/admin/users", label: t("nav.users") },
    { href: "/admin/products", label: t("nav.products") },
  ];

  // For mobile nav, include Transactions and Reports as main items
  const mobileNavItems = [
    { href: "/admin/users", label: t("nav.users") },
    { href: "/admin/products", label: t("nav.products") },
    { href: "/admin/transactions", label: t("nav.transactions") },
    { href: "/admin/reports", label: t("nav.reports") },
  ];

  const settingsMenuItems = [
    { href: "/admin/brands", label: t("nav.brands") },
    { href: "/admin/locations", label: t("nav.locations") },
    { href: "/admin/skills", label: t("nav.skills") },
  ];

  const financeMenuItems = [
    { href: "/admin/banks", label: t("nav.banks") },
    { href: "/admin/vendors", label: t("nav.vendors") },
    { href: "/admin/bills", label: t("nav.bills") },
    { href: "/admin/bill-payments", label: t("nav.billPayments") },
    { href: "/admin/labor-costs", label: t("nav.laborCosts") },
    { href: "/admin/inventory", label: t("nav.inventory") },
    { href: "/admin/chart-of-accounts", label: t("nav.chartOfAccounts") },
    { href: "/admin/profit-loss", label: t("nav.profitLoss") },
    { href: "/admin/cashflow", label: t("nav.cashflow") },
  ];

  const barsyMenuItems = [
    { href: "/admin/suppliers", label: t("nav.suppliers") },
    { href: "/admin/barsy-sync", label: t("nav.sync") },
    {
      href: "/admin/barsy-bills",
      label: t("nav.invoices"),
      badge: pendingBillsCount,
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <AdminMobileNav
              navItems={mobileNavItems}
              settingsMenuItems={settingsMenuItems}
              financeMenuItems={financeMenuItems}
              barsyMenuItems={barsyMenuItems}
              profile={profile}
              roleLabels={roleLabels}
            />
            <Link href="/admin">
              <Image
                src="/images/logo.jpg"
                alt="Memento Logo"
                width={32}
                height={32}
                className="rounded-md"
              />
            </Link>
            <nav className="hidden md:flex gap-2">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button variant="ghost" size="sm" className="relative">
                    {item.label}
                  </Button>
                </Link>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    {t("nav.finance")}
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {financeMenuItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <DropdownMenuItem className="cursor-pointer">
                        {item.label}
                      </DropdownMenuItem>
                    </Link>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Link href="/admin/transactions">
                <Button variant="ghost" size="sm" className="relative">
                  {t("nav.transactions")}
                </Button>
              </Link>
              <Link href="/admin/reports">
                <Button variant="ghost" size="sm" className="relative">
                  {t("nav.reports")}
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    {t("nav.barsy")}
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {barsyMenuItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <DropdownMenuItem className="cursor-pointer">
                        {item.label}
                        {item.badge && item.badge > 0 && (
                          <Badge
                            variant="destructive"
                            className="ml-2 h-5 min-w-5 rounded-full px-1 text-xs"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </DropdownMenuItem>
                    </Link>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    {t("nav.settings")}
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {settingsMenuItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <DropdownMenuItem className="cursor-pointer">
                        {item.label}
                      </DropdownMenuItem>
                    </Link>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {profile && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/50 border">
                <span className="text-sm font-semibold">
                  {profile.first_name} {profile.last_name}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  ({roleLabels[profile.role] || profile.role})
                </span>
              </div>
            )}
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                {t("common.dashboard")}
              </Button>
            </Link>
            <LanguageToggle />
            <ThemeToggle />
            <form action="/api/admin/logout" method="POST">
              <Button variant="outline" size="sm" type="submit">
                {t("common.logout")}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 flex-1 w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
};
