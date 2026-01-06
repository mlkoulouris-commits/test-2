import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SkillsPageClient } from '@/components/admin/skills-page-client'

export default async function SkillsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin-login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const { data: skills } = await supabase
    .from('skills')
    .select('*')
    .order('name')

  return <SkillsPageClient skills={skills || []} />
}













