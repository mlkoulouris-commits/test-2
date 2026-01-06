import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, ChevronsUpDown, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { useLanguage } from '@/lib/i18n/context'

interface Location {
  id: number
  name: string
}

interface Employee {
  user_id: string
  first_name: string
  last_name: string
}

interface IncomeApprovalFiltersProps {
  locations: Location[]
  employees: Employee[]
  filteredStatus: 'pending' | 'approved' | 'rejected' | 'all'
  filteredLocationId: number | null
  filteredEmployeeId: string | null
  dateRange: DateRange | undefined
  onStatusChange: (status: 'pending' | 'approved' | 'rejected' | 'all') => void
  onLocationChange: (locationId: number | null) => void
  onEmployeeChange: (employeeId: string | null) => void
  onDateRangeChange: (dateRange: DateRange | undefined) => void
  onClearFilters: () => void
}

export const IncomeApprovalFilters = ({
  locations,
  employees,
  filteredStatus,
  filteredLocationId,
  filteredEmployeeId,
  dateRange,
  onStatusChange,
  onLocationChange,
  onEmployeeChange,
  onDateRangeChange,
  onClearFilters,
}: IncomeApprovalFiltersProps) => {
  const { t } = useLanguage()
  const [employeeComboOpen, setEmployeeComboOpen] = useState(false)

  const selectedEmployee = employees.find(e => e.user_id === filteredEmployeeId)

  const hasActiveFilters = 
    filteredStatus !== 'pending' || 
    filteredLocationId !== null || 
    filteredEmployeeId !== null || 
    dateRange !== undefined

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={filteredStatus}
        onValueChange={(val) => onStatusChange(val as 'pending' | 'approved' | 'rejected' | 'all')}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t('incomeApproval.filterStatus')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('incomeApproval.allStatus')}</SelectItem>
          <SelectItem value="pending">{t('billStatus.pending')}</SelectItem>
          <SelectItem value="approved">{t('billStatus.approved')}</SelectItem>
          <SelectItem value="rejected">{t('billStatus.rejected')}</SelectItem>
        </SelectContent>
      </Select>
      
      {locations.length > 1 && (
        <Select
          value={filteredLocationId?.toString() || 'all'}
          onValueChange={(val) => onLocationChange(val === 'all' ? null : Number(val))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('incomeApproval.allLocations')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('incomeApproval.allLocations')}</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id.toString()}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Popover open={employeeComboOpen} onOpenChange={setEmployeeComboOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={employeeComboOpen}
            className="w-[220px] justify-between"
          >
            {selectedEmployee
              ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}`
              : t('incomeApproval.allEmployees')}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0">
          <Command>
            <CommandInput placeholder={t('incomeApproval.searchEmployee')} />
            <CommandList>
              <CommandEmpty>{t('incomeApproval.noEmployee')}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="all"
                  onSelect={() => {
                    onEmployeeChange(null)
                    setEmployeeComboOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !filteredEmployeeId ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {t('incomeApproval.allEmployees')}
                </CommandItem>
                {employees.map((employee) => (
                  <CommandItem
                    key={employee.user_id}
                    value={`${employee.first_name} ${employee.last_name}`}
                    onSelect={() => {
                      onEmployeeChange(employee.user_id)
                      setEmployeeComboOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        filteredEmployeeId === employee.user_id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {employee.first_name} {employee.last_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[280px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "MMM dd, yyyy")} -{" "}
                  {format(dateRange.to, "MMM dd, yyyy")}
                </>
              ) : (
                format(dateRange.from, "MMM dd, yyyy")
              )
            ) : (
              <span>{t('incomeApproval.allDates')}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={2}
          />
          {dateRange && (
            <div className="p-3 border-t">
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => onDateRangeChange(undefined)}
              >
                {t('incomeApproval.clearDates')}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="ml-auto"
        >
          <X className="h-4 w-4 mr-1" />
          {t('incomeApproval.clearFilters')}
        </Button>
      )}
    </div>
  )
}

