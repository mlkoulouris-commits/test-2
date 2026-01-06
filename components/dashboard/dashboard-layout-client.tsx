"use client";

import { LogoutButton } from "@/components/dashboard/logout-button";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { Footer } from "@/components/footer";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/context";
import Image from "next/image";
import Link from "next/link";

interface Profile {
  first_name: string;
  last_name: string;
  role: string;
}

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  profile: Profile | null;
  isManager: boolean;
}

export const DashboardLayoutClient = ({
  children,
  profile,
  isManager,
}: DashboardLayoutClientProps) => {
  const { t } = useLanguage();

  const roleLabels: Record<string, string> = {
    admin: t("roles.admin"),
    manager: t("roles.manager"),
    location_manager: t("roles.locationManager"),
    staff_member: t("roles.staffMember"),
    shareholder: t("roles.shareholder"),
  };

  const navItems = [
    { href: "/dashboard/income", label: t("nav.reportSales") },
    ...(isManager
      ? [{ href: "/dashboard/income/approve", label: t("nav.reviewSales") }]
      : []),
    ...(isManager
      ? [{ href: "/dashboard/staff-manager", label: t("nav.staffManager") }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <MobileNav
              navItems={navItems}
              profile={profile}
              roleLabels={roleLabels}
            />
            <Link href="/dashboard">
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
                  <Button variant="ghost" size="sm">
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/50 border">
              <span className="text-sm font-semibold">
                {profile?.first_name} {profile?.last_name}
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                ({roleLabels[profile?.role || ""] || profile?.role})
              </span>
            </div>
            {profile?.role === "admin" && (
              <Link href="/admin" className="hidden sm:inline">
                <Button size="sm">{t("common.admin")}</Button>
              </Link>
            )}
            <LanguageToggle />
            <ThemeToggle />
            <LogoutButton />
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
