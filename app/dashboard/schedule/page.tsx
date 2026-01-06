import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { StaffScheduleView } from '@/components/dashboard/staff-schedule-view'
import { ManagerScheduleView } from '@/components/dashboard/manager-schedule-view'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'

export default async function SchedulePage() {
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

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'location_manager' || profile?.role === 'manager' || isAdmin

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
              <BreadcrumbPage>Schedule</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-2xl sm:text-3xl font-bold mt-2">Schedule</h1>
        <p className="text-muted-foreground mt-1">
          {isManager ? 'Manage staff schedules and shifts' : 'View your schedule and clock in/out'}
        </p>
      </div>

      {isManager ? (
        <ManagerScheduleView 
          locations={locations}
        />
      ) : (
        <StaffScheduleView 
          locations={locations}
        />
      )}
    </div>
  )
}
