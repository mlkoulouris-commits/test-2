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
import { updateStaffMemberStatus } from '@/lib/actions/staff-management'
import { useRouter, useSearchParams } from 'next/navigation'
import { AssignStaffLocationsDialog } from '@/components/dashboard/assign-staff-locations-dialog'
import { ResetStaffPasswordDialog } from '@/components/dashboard/reset-staff-password-dialog'
import { UserCheck, UserX, X, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/lib/i18n/context'
import { useDateFormatter } from '@/lib/i18n/date-formatter'

interface StaffMember {
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
}

interface StaffManagerTableProps {
  staff: StaffMember[]
  locations: Array<{ id: number; name: string }>
}

export const StaffManagerTable = ({ staff, locations }: StaffManagerTableProps) => {
  const router = useRouter()
  const { t } = useLanguage()
  const { formatDate } = useDateFormatter()
  const searchParams = useSearchParams()
  const currentPage = Number(searchParams.get('page')) || 1

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [locationFilter, setLocationFilter] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [pageSize, setPageSize] = useState(10)

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    const result = await updateStaffMemberStatus(userId, !currentStatus)
    if (!result.error) {
      router.refresh()
    }
  }

  // Filter staff members
  const filteredStaff = useMemo(() => {
    return staff.filter(member => {
      // Search filter
      if (searchQuery) {
        const fullName = `${member.first_name} ${member.last_name}`.toLowerCase()
        if (!fullName.includes(searchQuery.toLowerCase())) return false
      }

      // Status filter
      if (statusFilter === 'active' && !member.is_active) return false
      if (statusFilter === 'inactive' && member.is_active) return false

      // Location filter
      if (locationFilter !== null) {
        const hasLocation = member.user_locations?.some(ul => ul.location_id === locationFilter)
        if (!hasLocation) return false
      }

      return true
    })
  }, [staff, statusFilter, locationFilter, searchQuery])

  // Paginate filtered staff
  const paginatedStaff = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredStaff.slice(startIndex, endIndex)
  }, [filteredStaff, currentPage, pageSize])

  const updatePageParam = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', page.toString())
    router.push(`?${params.toString()}`)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    updatePageParam(1)
  }

  const hasActiveFilters = statusFilter !== 'all' || locationFilter !== null || searchQuery !== ''

  const handleClearFilters = () => {
    setStatusFilter('all')
    setLocationFilter(null)
    setSearchQuery('')
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
          value={locationFilter?.toString() || 'all'}
          onValueChange={(val) => setLocationFilter(val === 'all' ? null : Number(val))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('users.allLocations')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('users.allLocations')}</SelectItem>
            {locations.map((loc) => (
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

      {/* Staff count */}
      <p className="text-sm text-muted-foreground">
        {filteredStaff.length === staff.length
          ? `${staff.length} ${t('staffManager.staffCount')}`
          : `${filteredStaff.length} ${t('users.of')} ${staff.length} ${t('staffManager.staffCount')}`
        }
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('users.name')}</TableHead>
            <TableHead>{t('users.locations')}</TableHead>
            <TableHead className="text-center">{t('common.status')}</TableHead>
            <TableHead>{t('users.created')}</TableHead>
            <TableHead className="text-center">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedStaff.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                {t('staffManager.noStaff')}
              </TableCell>
            </TableRow>
          ) : (
            paginatedStaff.map((member) => (
              <TableRow key={member.id} className="even:bg-muted/50">
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span>{member.first_name} {member.last_name}</span>
                    <span className="text-xs text-muted-foreground">{member.email}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {member.user_locations && member.user_locations.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {member.user_locations.map((ul) => (
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
                  <Badge
                    variant={member.is_active ? 'default' : 'secondary'}
                    className={member.is_active ? 'bg-green-600 hover:bg-green-700' : ''}
                  >
                    {member.is_active ? t('common.active') : t('common.inactive')}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(member.created_at)}
                </TableCell>
                <TableCell className="text-center">
                  <TooltipProvider>
                    <div className="flex gap-2 justify-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <AssignStaffLocationsDialog
                              userId={member.user_id}
                              userName={`${member.first_name} ${member.last_name}`}
                              currentLocationIds={member.user_locations?.map(ul => ul.location_id) || []}
                              availableLocations={locations}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{t('users.assignLocations')}</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <ResetStaffPasswordDialog
                              userId={member.user_id}
                              userName={`${member.first_name} ${member.last_name}`}
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
                            onClick={() => handleToggleStatus(member.user_id, member.is_active)}
                          >
                            {member.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {member.is_active ? t('banks.deactivate') : t('banks.activate')}
                        </TooltipContent>
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
        totalItems={filteredStaff.length}
        onPageChange={updatePageParam}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
