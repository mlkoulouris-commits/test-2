import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StaffStatusView } from '@/components/dashboard/staff-status-view'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import Link from 'next/link'

export default async function StaffStatusPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Only allow managers and location managers
  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'location_manager' || profile?.role === 'manager' || isAdmin

  if (!isManager) {
    redirect('/dashboard')
  }

  // Admins get all locations, others get assigned locations
  let locations = []
  if (isAdmin) {
    const { data: allLocations } = await supabase
      .from('locations')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    locations = allLocations || []
  } else {
    const { data: userLocations } = await supabase
      .from('user_locations')
      .select('location_id, locations(id, name)')
      .eq('user_id', user.id)
    locations = userLocations?.map((ul: any) => ul.locations) || []
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard">Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Staff Status</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-2xl sm:text-3xl font-bold mt-2">Staff Status</h1>
        <p className="text-muted-foreground mt-1">
          Monitor staff clock in/out status
        </p>
      </div>

      <StaffStatusView 
        locations={locations}
      />
    </div>
  )
}

