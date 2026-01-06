export interface IncomeReport {
  id: number
  business_date: string
  cash_sales: number
  cash_tips: number
  card_sales: number
  card_tips: number
  bill_breakdown: {
    under_5_total: number
    count_5: number
    count_10: number
    count_20: number
    count_50: number
    count_100: number
    count_200: number
  }
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  approved_at?: string | null
  approved_by?: string | null
  rejected_reason?: string | null
  approved_by_profile?: {
    user_id: string
    first_name: string
    last_name: string
  } | null
  submission_metadata?: {
    browser?: string
    device?: string
    user_agent?: string
    screen_resolution?: string
    timezone?: string
    language?: string
    platform?: string
    geolocation?: {
      latitude: number
      longitude: number
      accuracy: number
    }
    timestamp?: string
  } | null
  locations: {
    id: number
    name: string
  }
  employee_profile: {
    user_id: string
    first_name: string
    last_name: string
  } | null
}

