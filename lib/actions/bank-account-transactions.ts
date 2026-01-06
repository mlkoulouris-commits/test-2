'use server'

import { createClient } from '@/lib/supabase/server'

export interface BankAccountTransaction {
  id: string // Prefixed with type: 'payment-123', 'salary-456', or 'income-789'
  type: 'payment' | 'salary' | 'income'
  date: string
  amount: number
  description: string
  reference: string | null
  notes: string | null
  created_at: string
  details?: any
}

export const getBankAccountTransactions = async (
  accountId: number,
  fromDate: Date,
  toDate: Date
) => {
  const supabase = await createClient()
  const fromDateStr = fromDate.toISOString().split('T')[0]
  const toDateStr = toDate.toISOString().split('T')[0]

  console.log('getBankAccountTransactions:', { accountId, fromDateStr, toDateStr })

  // Get bill payments (outgoing)
  const { data: payments, error: paymentsError } = await supabase
    .from('bill_payments')
    .select(`
      id,
      payment_number,
      payment_date,
      total_amount,
      payment_method,
      reference_number,
      notes,
      created_at
    `)
    .eq('bank_account_id', accountId)
    .gte('payment_date', fromDateStr)
    .lte('payment_date', toDateStr)

  if (paymentsError) {
    return { error: paymentsError.message }
  }

  // Get salary payments (outgoing)
  const { data: salaryPayments, error: salaryPaymentsError } = await supabase
    .from('salary_payments')
    .select(`
      id,
      payment_number,
      payment_date,
      total_amount,
      reference_number,
      notes,
      created_at
    `)
    .eq('bank_account_id', accountId)
    .gte('payment_date', fromDateStr)
    .lte('payment_date', toDateStr)

  if (salaryPaymentsError) {
    return { error: salaryPaymentsError.message }
  }

  // Get account details to determine location and type
  const { data: account } = await supabase
    .from('bank_accounts')
    .select('account_type, account_name, location_id')
    .eq('id', accountId)
    .single()

  if (!account) {
    return { error: 'Account not found' }
  }

  // Get income reports for this location
  const { data: incomeReports, error: incomeError } = await supabase
    .from('employee_income_reports')
    .select(`
      id,
      business_date,
      cash_sales,
      cash_tips,
      card_sales,
      card_tips,
      status,
      approved_at,
      user_id,
      location_id
    `)
    .eq('location_id', account.location_id)
    .eq('status', 'approved')
    .gte('business_date', fromDateStr)
    .lte('business_date', toDateStr)

  if (incomeError) {
    console.error('Income reports error:', incomeError)
    return { error: incomeError.message }
  }

  console.log('Income reports found:', incomeReports?.length, 'for location:', account.location_id)

  // Get applied bills for each payment
  const paymentTransactions = await Promise.all(
    (payments || []).map(async (payment) => {
      const { data: applications } = await supabase
        .from('bill_payment_applications')
        .select(`
          amount_applied,
          new_bill_id,
          bills!bill_payment_applications_new_bill_id_fkey (
            id,
            doc_num,
            vendor:vendors!bills_vendor_id_fkey (
              name
            )
          )
        `)
        .eq('payment_id', payment.id)

      const appliedBills = (applications || [])
        .filter((app: any) => app.bills && app.bills.vendor)
        .map((app: any) => ({
          bill_id: app.bills.id,
          bill_doc_num: app.bills.doc_num,
          vendor_name: app.bills.vendor.name,
          amount_applied: app.amount_applied,
        }))

      const uniqueVendorNames = [...new Set(appliedBills.map((b) => b.vendor_name))]
      const vendorNames = uniqueVendorNames.join(', ')

      return {
        id: `payment-${payment.id}`,
        type: 'payment' as const,
        date: payment.payment_date,
        amount: -payment.total_amount, // Negative for outgoing
        description: `Payment to ${vendorNames || 'Vendor'}`,
        reference: payment.payment_number || payment.reference_number,
        notes: payment.notes,
        created_at: payment.created_at,
        details: {
          payment_method: payment.payment_method,
          applied_bills: appliedBills,
        },
      }
    })
  )

  // Get applied labor costs for each salary payment
  const salaryPaymentTransactions = await Promise.all(
    (salaryPayments || []).map(async (payment) => {
      const { data: applications } = await supabase
        .from('salary_payment_applications')
        .select(`
          amount_applied,
          labor_cost_id,
          labor_costs!salary_payment_applications_labor_cost_id_fkey (
            id,
            description,
            cost_type,
            profile:profiles!labor_costs_profile_id_fkey (
              first_name,
              last_name
            )
          )
        `)
        .eq('payment_id', payment.id)

      const appliedLaborCosts = (applications || [])
        .filter((app: any) => app.labor_costs)
        .map((app: any) => ({
          labor_cost_id: app.labor_costs.id,
          description: app.labor_costs.description,
          cost_type: app.labor_costs.cost_type,
          employee_name: app.labor_costs.profile
            ? `${app.labor_costs.profile.first_name} ${app.labor_costs.profile.last_name}`
            : null,
          amount_applied: app.amount_applied,
        }))

      const uniqueEmployeeNames = [...new Set(
        appliedLaborCosts
          .map((lc) => lc.employee_name)
          .filter(Boolean)
      )]
      const employeeNames = uniqueEmployeeNames.length > 0
        ? uniqueEmployeeNames.join(', ')
        : 'Staff'

      return {
        id: `salary-${payment.id}`,
        type: 'salary' as const,
        date: payment.payment_date,
        amount: -payment.total_amount, // Negative for outgoing
        description: `Salary Payment to ${employeeNames}`,
        reference: payment.payment_number || payment.reference_number,
        notes: payment.notes,
        created_at: payment.created_at,
        details: {
          applied_labor_costs: appliedLaborCosts,
        },
      }
    })
  )

  // Get user profiles for employee names
  const userIds = (incomeReports || []).map((r: any) => r.user_id).filter(Boolean)
  let profileMap: Record<string, string> = {}

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', userIds)

    profileMap = (profiles || []).reduce((acc: any, p: any) => {
      acc[p.user_id] = `${p.first_name} ${p.last_name}`
      return acc
    }, {})
  }

  // Transform income reports to transactions
  const incomeTransactions = (incomeReports || [])
    .map((report: any) => {
      const employeeName = profileMap[report.user_id] || 'Unknown'

      // Determine amount based on account type
      // Note: cash_tips are excluded from cash accounts as they are just recorded, not deposited
      let amount = 0
      const accountNameLower = account.account_name?.toLowerCase() || ''

      if (accountNameLower.includes('cash')) {
        amount = Number(report.cash_sales)
      } else if (accountNameLower.includes('pos') || accountNameLower.includes('card')) {
        amount = Number(report.card_sales) + Number(report.card_tips)
      } else {
        // Default: total everything (excluding cash tips)
        amount = Number(report.cash_sales) +
                 Number(report.card_sales) + Number(report.card_tips)
      }

      return {
        id: `income-${report.id}`,
        type: 'income' as const,
        date: report.business_date,
        amount: amount, // Positive for incoming
        description: `Income Report - ${employeeName}`,
        reference: null,
        notes: null,
        created_at: report.approved_at || report.business_date,
        details: {
          employee: employeeName,
          cash_sales: report.cash_sales,
          cash_tips: report.cash_tips,
          card_sales: report.card_sales,
          card_tips: report.card_tips,
        },
      }
    })
    .filter((t) => t.amount > 0) // Only include transactions with non-zero amounts

  // Combine and sort by date
  const allTransactions = [...paymentTransactions, ...salaryPaymentTransactions, ...incomeTransactions].sort((a, b) => {
    const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime()
    if (dateCompare !== 0) return dateCompare
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  console.log('Final transactions:', {
    payments: paymentTransactions.length,
    salaryPayments: salaryPaymentTransactions.length,
    income: incomeTransactions.length,
    total: allTransactions.length,
    accountName: account.account_name
  })

  return { data: allTransactions as BankAccountTransaction[] }
}
