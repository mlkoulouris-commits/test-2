import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { IncomePageClient } from '@/components/dashboard/income-page-client'

export default async function IncomePage() {
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

  // Get user's assigned locations
  const isAdmin = profile.role === 'admin'
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

  return <IncomePageClient locations={locations} />
}
