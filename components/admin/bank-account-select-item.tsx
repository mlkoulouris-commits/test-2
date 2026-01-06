import { Badge } from '@/components/ui/badge'
import { BankAccount } from '@/lib/actions/bank-accounts'

interface BankAccountSelectItemProps {
  account: BankAccount
  showBalance?: boolean
}

export const BankAccountSelectItem = ({ 
  account, 
  showBalance = false 
}: BankAccountSelectItemProps) => {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="font-medium">{account.account_name}</span>
      
      {account.location?.name && (
        <Badge variant="outline" className="text-xs">
          {account.location.name}
        </Badge>
      )}
      
      <Badge 
        variant="secondary" 
        className={`text-xs ${
          account.account_type === 'cash' 
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
            : account.account_type === 'pos'
            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        }`}
      >
        {account.account_type === 'pos' 
          ? 'POS' 
          : account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)
        }
      </Badge>
      
      {showBalance && (
        <span className={`text-xs ${account.current_balance < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
          {account.current_balance.toFixed(2)} {account.currency}
        </span>
      )}
    </div>
  )
}

