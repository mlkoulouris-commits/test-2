import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getLocationStaffMembers, getManagerLocations } from '@/lib/actions/staff-management'
import { StaffManagerPageClient } from '@/components/dashboard/staff-manager-page-client'

export default async function StaffManagerPage() {
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

  if (!profile) {
    redirect('/login')
  }

  // Only allow location_manager, manager, or admin
  const isManager = profile.role === 'location_manager' || profile.role === 'manager' || profile.role === 'admin'

  if (!isManager) {
    redirect('/dashboard')
  }

  // Get staff members for the manager's locations
  const staffResult = await getLocationStaffMembers()
  const locationsResult = await getManagerLocations()

  return (
    <StaffManagerPageClient
      staff={staffResult.data || []}
      locations={locationsResult.data || []}
      error={staffResult.error || locationsResult.error}
    />
  )
}
