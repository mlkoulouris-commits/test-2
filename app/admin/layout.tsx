import { getPendingBarsyBillsCount } from '@/lib/actions/barsy-bills-approval'
import { createClient } from '@/lib/supabase/server'
import { AdminLayoutClient } from '@/components/admin/admin-layout-client'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get user profile
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    profile = data
  }

  const { count: pendingBillsCount } = await getPendingBarsyBillsCount()

  return (
    <AdminLayoutClient profile={profile} pendingBillsCount={pendingBillsCount || 0}>
      {children}
    </AdminLayoutClient>
  )
}
