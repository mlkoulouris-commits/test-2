'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Menu, Home, DollarSign, FileText, Calendar, TrendingUp, Shield, Users, FileCheck, Wallet, CheckSquare } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

interface MobileNavProps {
  navItems: Array<{ href: string; label: string }>
  profile: any
  roleLabels: Record<string, string>
}

const icons: Record<string, any> = {
  Sales: DollarSign,
  'Report Sales': Wallet,
  'Review Sales': CheckSquare,
  Transactions: FileText,
  Schedule: Calendar,
  'Staff Status': Users,
  Invoices: FileCheck,
  Reports: TrendingUp,
}

export const MobileNav = ({ navItems, profile, roleLabels }: MobileNavProps) => {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle>Menu</SheetTitle>
          <ThemeToggle />
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-1 pb-4 border-b">
            <p className="font-medium">{profile?.first_name} {profile?.last_name}</p>
            <p className="text-sm text-muted-foreground">
              {roleLabels[profile?.role || ''] || profile?.role}
            </p>
          </div>

          <Link href="/dashboard" onClick={() => setOpen(false)}>
            <Button variant="ghost" className="w-full justify-start" size="lg">
              <Home className="mr-3 h-5 w-5" />
              Dashboard
            </Button>
          </Link>

          <div className="space-y-1">
            {navItems.map(item => {
              const Icon = icons[item.label] || Home
              return (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start" size="lg">
                    <Icon className="mr-3 h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </div>

          {profile?.role === 'admin' && (
              <div className="pt-4 border-t">
                <Link href="/admin" onClick={() => setOpen(false)}>
                  <Button className="w-full justify-start" size="lg">
                    <Shield className="mr-3 h-5 w-5" />
                    Admin Panel
                  </Button>
                </Link>
              </div>
            )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

