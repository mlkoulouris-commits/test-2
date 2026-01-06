const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkData() {
  // Check orders with account_id
  const { data: orders, error: ordersError } = await supabase
    .from('barsy_orders')
    .select('raw_data, location_id')
    .not('raw_data->account_id', 'is', null)
    .limit(5)
  
  console.log('Orders with account_id:', orders?.length || 0)
  if (orders && orders.length > 0) {
    console.log('Sample order account_id:', orders[0].raw_data?.account_id)
    console.log('Sample order location_id:', orders[0].location_id)
  }
  
  // Check if barsy_accounts exists
  const { data: accounts, error: accountsError } = await supabase
    .from('barsy_accounts')
    .select('barsy_account_id, raw_data, location_id')
    .limit(5)
  
  if (accountsError) {
    console.log('Error fetching accounts:', accountsError.message)
  } else {
    console.log('\nAccounts found:', accounts?.length || 0)
    if (accounts && accounts.length > 0) {
      console.log('Sample account_id:', accounts[0].barsy_account_id)
      console.log('Sample payment_name:', accounts[0].raw_data?.payment_name)
      console.log('Sample paymethod_name:', accounts[0].raw_data?.paymethod_name)
      console.log('Available keys in raw_data:', Object.keys(accounts[0].raw_data || {}))
    }
  }
}

checkData()
