-- Check sample barsy_orders data to see grouping possibilities
SELECT 
  id,
  order_date,
  barsy_article_id,
  article_name,
  amount,
  actual_price,
  barsy_user_id,
  user_name,
  pos_id,
  stream_id,
  barsy_id,
  raw_data->>'account_id' as account_id,
  raw_data->>'table_id' as table_id,
  raw_data->>'order_group_id' as order_group_id
FROM barsy_orders
ORDER BY order_date DESC
LIMIT 5;

-- Check distinct account_ids
SELECT 
  COUNT(DISTINCT raw_data->>'account_id') as unique_accounts,
  COUNT(*) as total_orders,
  MIN(order_date) as earliest_order,
  MAX(order_date) as latest_order
FROM barsy_orders
WHERE raw_data->>'account_id' IS NOT NULL;
