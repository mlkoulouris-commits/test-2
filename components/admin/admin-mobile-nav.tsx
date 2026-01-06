'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Menu, Home, Users, Tag, MapPin, Package, Truck, Award, ChevronDown, ChevronRight, DollarSign, Settings } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface AdminMobileNavProps {
  navItems: Array<{ href: string; label: string; badge?: number }>
  settingsMenuItems: Array<{ href: string; label: string; badge?: number }>
  financeMenuItems: Array<{ href: string; label: string; badge?: number }>
  barsyMenuItems: Array<{ href: string; label: string; badge?: number }>
  profile?: {
    first_name: string
    last_name: string
    role: string
  } | null
  roleLabels?: Record<string, string>
}

const icons: Record<string, any> = {
  Users: Users,
  Skills: Award,
  Brands: Tag,
  Locations: MapPin,
  Products: Package,
  Vendors: Truck,
}

export const AdminMobileNav = ({ navItems, settingsMenuItems, financeMenuItems, barsyMenuItems, profile, roleLabels }: AdminMobileNavProps) => {
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [financeOpen, setFinanceOpen] = useState(false)
  const [barsyOpen, setBarsyOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle>Admin Menu</SheetTitle>
          <ThemeToggle />
        </SheetHeader>
        <div className="mt-6 space-y-2">
          {profile && (
            <div className="px-3 py-2 mb-4 rounded-md bg-muted/50 border">
              <p className="text-sm font-semibold">
                {profile.first_name} {profile.last_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {roleLabels?.[profile.role] || profile.role}
              </p>
            </div>
          )}
          <Link href="/admin" onClick={() => setOpen(false)}>
            <Button variant="ghost" className="w-full justify-start" size="lg">
              <Home className="mr-3 h-5 w-5" />
              Dashboard
            </Button>
          </Link>

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

          <Collapsible open={financeOpen} onOpenChange={setFinanceOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start" size="lg">
                <DollarSign className="mr-3 h-5 w-5" />
                Finance
                {financeOpen ? (
                  <ChevronDown className="ml-auto h-5 w-5" />
                ) : (
                  <ChevronRight className="ml-auto h-5 w-5" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-8 space-y-1 mt-1">
              {financeMenuItems.map(item => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start" size="sm">
                    {item.label}
                  </Button>
                </Link>
              ))}
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={barsyOpen} onOpenChange={setBarsyOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start" size="lg">
                <Package className="mr-3 h-5 w-5" />
                Barsy
                {barsyOpen ? (
                  <ChevronDown className="ml-auto h-5 w-5" />
                ) : (
                  <ChevronRight className="ml-auto h-5 w-5" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-8 space-y-1 mt-1">
              {barsyMenuItems.map(item => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start" size="sm">
                    {item.label}
                    {item.badge && item.badge > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="ml-auto h-5 min-w-5 rounded-full px-1 text-xs"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                </Link>
              ))}
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start" size="lg">
                <Settings className="mr-3 h-5 w-5" />
                Settings
                {settingsOpen ? (
                  <ChevronDown className="ml-auto h-5 w-5" />
                ) : (
                  <ChevronRight className="ml-auto h-5 w-5" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-8 space-y-1 mt-1">
              {settingsMenuItems.map(item => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start" size="sm">
                    {item.label}
                  </Button>
                </Link>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SheetContent>
    </Sheet>
  )
}

