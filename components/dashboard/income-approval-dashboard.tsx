'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import { IncomeApprovalFilters } from './income-approval-filters'
import { IncomeReportMobileCard } from './income-report-mobile-card'
import { IncomeReportTable } from './income-report-table'
import { IncomeReportApproveDialog } from './income-report-approve-dialog'
import { IncomeReportRejectDialog } from './income-report-reject-dialog'
import { IncomeReportDetailsDialog } from './income-report-details-dialog'
import {
  getReportsForApproval,
  approveIncomeReport,
  rejectIncomeReport,
  getBankAccountsForLocation
} from '@/lib/actions/employee-income'
import { BankAccount } from '@/lib/actions/bank-accounts'
import { IncomeReport } from '@/lib/types/income-report'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/context'
import { useCurrency } from '@/lib/i18n/currency'

interface Location {
  id: number
  name: string
}

export const IncomeApprovalDashboard = ({ locations }: { locations: Location[] }) => {
  const { t } = useLanguage()
  const { formatAmount: formatCurrencyLocale } = useCurrency()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPage = Number(searchParams.get('page')) || 1

  const [reports, setReports] = useState<IncomeReport[]>([])
  const [filteredLocationId, setFilteredLocationId] = useState<number | null>(null)
  const [filteredStatus, setFilteredStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [filteredEmployeeId, setFilteredEmployeeId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<IncomeReport | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedCashAccount, setSelectedCashAccount] = useState<number | null>(null)
  const [selectedCardAccount, setSelectedCardAccount] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    loadReports()
  }, [filteredLocationId, filteredStatus, filteredEmployeeId, dateRange])

  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return reports.slice(startIndex, endIndex)
  }, [reports, currentPage, pageSize])

  const loadReports = async () => {
    setIsLoading(true)
    const status = filteredStatus === 'all' ? undefined : filteredStatus
    const startDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined
    const endDate = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined

    const result = await getReportsForApproval(
      filteredLocationId || undefined,
      status,
      filteredEmployeeId || undefined,
      startDate,
      endDate
    )
    if (result.success && result.data) {
      setReports(result.data as IncomeReport[])
    }
    setIsLoading(false)
  }

  const getTotalAmount = (report: IncomeReport) => {
    // Exclude cash_tips from total as they are just recorded, not deposited
    return report.cash_sales + report.card_sales + report.card_tips
  }

  const handleViewDetails = (report: IncomeReport) => {
    setSelectedReport(report)
    setDetailsOpen(true)
  }

  const handleApproveClick = async (report: IncomeReport) => {
    setSelectedReport(report)

    // Load bank accounts for this location
    const result = await getBankAccountsForLocation(report.locations.id)
    if (result.success && result.data) {
      setBankAccounts(result.data as BankAccount[])

      // Auto-select cash and card accounts
      const cashAccount = result.data.find((acc: BankAccount) => acc.account_type === 'cash')
      const posAccount = result.data.find((acc: BankAccount) => acc.account_type === 'pos')
      const bankAccount = result.data.find((acc: BankAccount) => acc.account_type === 'bank')

      if (cashAccount) {
        setSelectedCashAccount(cashAccount.id)
      }
      // Prefer POS account for card sales, fallback to bank account
      if (posAccount) {
        setSelectedCardAccount(posAccount.id)
      } else if (bankAccount) {
        setSelectedCardAccount(bankAccount.id)
      }
    }

    setApproveOpen(true)
  }

  const handleRejectClick = (report: IncomeReport) => {
    setSelectedReport(report)
    setRejectReason('')
    setRejectOpen(true)
  }

  const handleApproveConfirm = async () => {
    setError('')
    setSuccess('')

    if (!selectedReport || !selectedCashAccount || !selectedCardAccount) {
      setError('Please select both cash and card accounts')
      return
    }

    setIsSubmitting(true)
    const result = await approveIncomeReport(selectedReport.id, selectedCashAccount, selectedCardAccount)
    setIsSubmitting(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(`${t('common.success')}: ${t('incomeApproval.cash')}: ${formatCurrencyLocale(result.cashAmount || 0, 'BGN')}, ${t('incomeApproval.cardPos')}: ${formatCurrencyLocale(result.cardAmount || 0, 'BGN')}`)
      setTimeout(() => {
        setApproveOpen(false)
        setSelectedReport(null)
        setSelectedCashAccount(null)
        setSelectedCardAccount(null)
        setSuccess('')
        loadReports()
      }, 1500)
    }
  }

  const handleRejectConfirm = async () => {
    setError('')
    setSuccess('')

    if (!selectedReport) return

    if (!rejectReason.trim()) {
      setError('Please provide a reason for rejection')
      return
    }

    setIsSubmitting(true)
    const result = await rejectIncomeReport(selectedReport.id, rejectReason)
    setIsSubmitting(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('Report rejected')
      setTimeout(() => {
        setRejectOpen(false)
        setSelectedReport(null)
        setRejectReason('')
        setSuccess('')
        loadReports()
      }, 1500)
    }
  }

  // Get unique employees from reports
  const uniqueEmployees = Array.from(
    new Map(
      reports.map(r => [
        r.employee_profile?.user_id,
        r.employee_profile
      ])
    ).entries()
  )
    .filter(([userId]) => userId)
    .map(([userId, profile]) => ({
      user_id: userId as string,
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
    }))
    .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))

  const handleClearFilters = () => {
    setFilteredStatus('pending')
    setFilteredLocationId(null)
    setFilteredEmployeeId(null)
    setDateRange(undefined)
  }

  const updatePageParam = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', page.toString())
    router.push(`?${params.toString()}`)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    updatePageParam(1)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <CardTitle>{t('incomeApproval.salesReports')}</CardTitle>

            <IncomeApprovalFilters
              locations={locations}
              employees={uniqueEmployees}
              filteredStatus={filteredStatus}
              filteredLocationId={filteredLocationId}
              filteredEmployeeId={filteredEmployeeId}
              dateRange={dateRange}
              onStatusChange={setFilteredStatus}
              onLocationChange={setFilteredLocationId}
              onEmployeeChange={setFilteredEmployeeId}
              onDateRangeChange={setDateRange}
              onClearFilters={handleClearFilters}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">{t('common.loading')}</p>
          ) : reports.length === 0 ? (
            <p className="text-muted-foreground">{t('incomeApproval.noReports')}</p>
          ) : paginatedReports.length === 0 ? (
            <p className="text-muted-foreground">{t('incomeApproval.noReportsPage')}</p>
          ) : (
            <div className="space-y-4 sm:space-y-0">
              {/* Mobile Card View */}
              <div className="sm:hidden space-y-3">
                {paginatedReports.map((report) => (
                  <IncomeReportMobileCard
                    key={report.id}
                    report={report}
                    onViewDetails={handleViewDetails}
                    getTotalAmount={getTotalAmount}
                  />
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block">
                <IncomeReportTable
                  reports={paginatedReports}
                  onViewDetails={handleViewDetails}
                  getTotalAmount={getTotalAmount}
                />
              </div>
            </div>
          )}

          {reports.length > 10 && (
            <div className="pt-4">
              <DataTablePagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={reports.length}
                onPageChange={updatePageParam}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <IncomeReportApproveDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        report={selectedReport}
        bankAccounts={bankAccounts}
        selectedCashAccount={selectedCashAccount}
        selectedCardAccount={selectedCardAccount}
        onCashAccountChange={setSelectedCashAccount}
        onCardAccountChange={setSelectedCardAccount}
        onConfirm={handleApproveConfirm}
        isSubmitting={isSubmitting}
        error={error}
        success={success}
        getTotalAmount={getTotalAmount}
      />

      <IncomeReportRejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        report={selectedReport}
        rejectReason={rejectReason}
        onRejectReasonChange={setRejectReason}
        onConfirm={handleRejectConfirm}
        isSubmitting={isSubmitting}
        error={error}
        success={success}
        getTotalAmount={getTotalAmount}
      />

      <IncomeReportDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        report={selectedReport}
        onApprove={handleApproveClick}
        onReject={handleRejectClick}
        getTotalAmount={getTotalAmount}
      />
    </>
  )
}
