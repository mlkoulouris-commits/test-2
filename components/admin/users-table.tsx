'use client'

import { useState, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import { updateUserStatus } from '@/lib/actions/users'
import { useRouter, useSearchParams } from 'next/navigation'
import { AssignLocationsDialog } from './assign-locations-dialog'
import { ManageUserSkillsDialog } from './manage-user-skills-dialog'
import { EditUserDialog } from './edit-user-dialog'
import { ResetPasswordDialog } from './reset-password-dialog'
import { Clock, CheckCircle2, UserCheck, UserX, X, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/lib/i18n/context'
import { useDateFormatter } from '@/lib/i18n/date-formatter'

interface User {
  id: number
  user_id: string
  first_name: string
  last_name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  user_locations?: Array<{
    location_id: number
    locations: {
      id: number
      name: string
    }
  }>
  current_shift?: {
    user_id: string
    location_id: number
    clock_in: string
    locations: {
      id: number
      name: string
    }
  }
  is_within_schedule?: boolean
  today_schedule?: Array<{
    user_id: string
    location_id: number
    start_time: string
    end_time: string
    locations: {
      id: number
      name: string
    }
  }>
}

interface UsersTableProps {
  users: User[]
  allLocations: Array<{ id: number; name: string }>
}

export const UsersTable = ({ users, allLocations }: UsersTableProps) => {
  const router = useRouter()
  const { t } = useLanguage()
  const { formatDate } = useDateFormatter()
  const searchParams = useSearchParams()
  const currentPage = Number(searchParams.get('page')) || 1

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<'name' | 'role' | 'status' | 'created' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [pageSize, setPageSize] = useState(10)

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    const result = await updateUserStatus(userId, !currentStatus)
    if (!result.error) {
      router.refresh()
    }
  }

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    let filtered = users.filter(user => {
      // Search filter
      if (searchQuery) {
        const fullName = `${user.first_name} ${user.last_name}`.toLowerCase()
        if (!fullName.includes(searchQuery.toLowerCase())) return false
      }

      // Status filter
      if (statusFilter === 'active' && !user.is_active) return false
      if (statusFilter === 'inactive' && user.is_active) return false

      // Role filter
      if (roleFilter !== 'all' && user.role !== roleFilter) return false

      // Location filter
      if (locationFilter !== null) {
        const hasLocation = user.user_locations?.some(ul => ul.location_id === locationFilter)
        if (!hasLocation) return false
      }

      return true
    })

    // Sort
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: string | number = ''
        let bValue: string | number = ''

        switch (sortField) {
          case 'name':
            aValue = `${a.first_name} ${a.last_name}`.toLowerCase()
            bValue = `${b.first_name} ${b.last_name}`.toLowerCase()
            break
          case 'role':
            aValue = a.role.toLowerCase()
            bValue = b.role.toLowerCase()
            break
          case 'status':
            aValue = a.is_active ? 1 : 0
            bValue = b.is_active ? 1 : 0
            break
          case 'created':
            aValue = new Date(a.created_at).getTime()
            bValue = new Date(b.created_at).getTime()
            break
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [users, statusFilter, roleFilter, locationFilter, searchQuery, sortField, sortDirection])

  // Paginate filtered users
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredUsers.slice(startIndex, endIndex)
  }, [filteredUsers, currentPage, pageSize])

  const updatePageParam = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', page.toString())
    router.push(`?${params.toString()}`)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    updatePageParam(1)
  }

  const hasActiveFilters = statusFilter !== 'all' || roleFilter !== 'all' || locationFilter !== null || searchQuery !== ''

  const handleClearFilters = () => {
    setStatusFilter('all')
    setRoleFilter('all')
    setLocationFilter(null)
    setSearchQuery('')
  }

  const handleSort = (field: 'name' | 'role' | 'status' | 'created') => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New field, default to ascending
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getRoleBadge = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      admin: 'destructive',
      manager: 'default',
      location_manager: 'secondary',
      staff_member: 'outline',
      shareholder: 'default',
    }
    const labels: Record<string, string> = {
      admin: t('roles.admin'),
      manager: t('roles.manager'),
      location_manager: t('roles.locationManager'),
      staff_member: t('roles.staffMember'),
      shareholder: t('roles.shareholder'),
    }
    return <Badge variant={variants[role] || 'outline'}>{labels[role] || role}</Badge>
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-[250px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('users.searchByName')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val as 'all' | 'active' | 'inactive')}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t('users.allStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('users.allStatus')}</SelectItem>
            <SelectItem value="active">{t('common.active')}</SelectItem>
            <SelectItem value="inactive">{t('common.inactive')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={roleFilter}
          onValueChange={setRoleFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('users.allRoles')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('users.allRoles')}</SelectItem>
            <SelectItem value="admin">{t('roles.admin')}</SelectItem>
            <SelectItem value="manager">{t('roles.manager')}</SelectItem>
            <SelectItem value="location_manager">{t('roles.locationManager')}</SelectItem>
            <SelectItem value="staff_member">{t('roles.staffMember')}</SelectItem>
            <SelectItem value="shareholder">{t('roles.shareholder')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={locationFilter?.toString() || 'all'}
          onValueChange={(val) => setLocationFilter(val === 'all' ? null : Number(val))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('users.allLocations')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('users.allLocations')}</SelectItem>
            {allLocations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id.toString()}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="ml-auto"
          >
            <X className="h-4 w-4 mr-1" />
            {t('users.clearFilters')}
          </Button>
        )}
      </div>

      {/* Users count */}
      <p className="text-sm text-muted-foreground">
        {filteredUsers.length === users.length
          ? `${users.length} ${t('users.userCount')}`
          : `${filteredUsers.length} ${t('users.of')} ${users.length} ${t('users.userCount')}`
        }
      </p>

    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Button
              variant="ghost"
              onClick={() => handleSort('name')}
              className="hover:bg-transparent p-0 h-auto font-medium"
            >
              {t('users.name')}
            </Button>
          </TableHead>
          <TableHead>
            <Button
              variant="ghost"
              onClick={() => handleSort('role')}
              className="hover:bg-transparent p-0 h-auto font-medium"
            >
              {t('users.role')}
            </Button>
          </TableHead>
          <TableHead className="text-center">{t('users.clockStatus')}</TableHead>
          <TableHead>{t('users.locations')}</TableHead>
          <TableHead className="text-center">
            <Button
              variant="ghost"
              onClick={() => handleSort('status')}
              className="hover:bg-transparent p-0 h-auto font-medium"
            >
              {t('common.status')}
            </Button>
          </TableHead>
          <TableHead>
            <Button
              variant="ghost"
              onClick={() => handleSort('created')}
              className="hover:bg-transparent p-0 h-auto font-medium"
            >
              {t('users.created')}
            </Button>
          </TableHead>
          <TableHead className="text-center">{t('common.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {paginatedUsers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              {t('users.noUsers')}
            </TableCell>
          </TableRow>
        ) : (
          paginatedUsers.map((user) => (
            <TableRow key={user.id} className="even:bg-muted/50">
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{user.first_name} {user.last_name}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </TableCell>
              <TableCell>{getRoleBadge(user.role)}              </TableCell>
              <TableCell className="text-center">
                {user.current_shift ? (
                  <div className="flex flex-col gap-1 items-center">
                    <Badge className="bg-green-500 w-fit">
                      <Clock className="h-3 w-3 mr-1" />
                      {t('users.clockedIn')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      @ {user.current_shift.locations?.name}
                    </span>
                    {user.is_within_schedule && (
                      <Badge variant="outline" className="w-fit text-green-600 border-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {t('users.onSchedule')}
                      </Badge>
                    )}
                    {!user.is_within_schedule && user.today_schedule && user.today_schedule.length > 0 && (
                      <Badge variant="outline" className="w-fit text-orange-600 border-orange-600">
                        {t('users.outsideSchedule')}
                      </Badge>
                    )}
                  </div>
                ) : user.today_schedule && user.today_schedule.length > 0 ? (
                  <div className="flex flex-col gap-1 items-center">
                    <Badge variant="outline" className="w-fit">
                      {t('users.notClockedIn')}
                    </Badge>
                    {user.is_within_schedule && (
                      <Badge variant="outline" className="w-fit text-orange-600 border-orange-600">
                        {t('users.shouldBeWorking')}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">{t('users.noShiftToday')}</span>
                )}
              </TableCell>
              <TableCell>
                {user.user_locations && user.user_locations.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {user.user_locations.map((ul) => (
                      <Badge key={ul.location_id} variant="outline" className="text-xs">
                        {ul.locations.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">{t('users.noLocations')}</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={user.is_active ? 'default' : 'secondary'} className={user.is_active ? 'bg-green-600 hover:bg-green-700' : ''}>
                  {user.is_active ? t('common.active') : t('common.inactive')}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(user.created_at)}
              </TableCell>
              <TableCell className="text-center">
                <TooltipProvider>
                  <div className="flex gap-2 justify-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <EditUserDialog
                            userId={user.user_id}
                            firstName={user.first_name}
                            lastName={user.last_name}
                            role={user.role}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{t('users.editUser')}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <AssignLocationsDialog
                            userId={user.user_id}
                            userName={`${user.first_name} ${user.last_name}`}
                            currentLocationIds={user.user_locations?.map(ul => ul.location_id) || []}
                            allLocations={allLocations}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{t('users.assignLocations')}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <ManageUserSkillsDialog
                            userId={user.user_id}
                            userName={`${user.first_name} ${user.last_name}`}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{t('users.manageSkills')}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <ResetPasswordDialog
                            userId={user.user_id}
                            userName={`${user.first_name} ${user.last_name}`}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{t('users.resetPassword')}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(user.user_id, user.is_active)}
                        >
                          {user.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{user.is_active ? t('banks.deactivate') : t('banks.activate')}</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>

    <DataTablePagination
      currentPage={currentPage}
      pageSize={pageSize}
      totalItems={filteredUsers.length}
      onPageChange={updatePageParam}
      onPageSizeChange={handlePageSizeChange}
    />
    </div>
  )
}
