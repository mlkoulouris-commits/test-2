import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayoutClient } from '@/components/dashboard/dashboard-layout-client'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const isManager = profile?.role === 'location_manager' || profile?.role === 'manager' || profile?.role === 'admin'

  return (
    <DashboardLayoutClient profile={profile} isManager={isManager}>
      {children}
    </DashboardLayoutClient>
  )
}

