import { getAllUsersWithStatus } from '@/lib/actions/admin-users'
import { getAllLocations } from '@/lib/actions/locations'
import { UsersPageClient } from '@/components/admin/users-page-client'

export default async function UsersPage() {
  const result = await getAllUsersWithStatus()
  const locationsResult = await getAllLocations()

  return (
    <UsersPageClient
      users={result.data || []}
      locations={locationsResult.data || []}
      error={result.error}
    />
  )
}

