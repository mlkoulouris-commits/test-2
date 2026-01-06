import { Badge } from '@/components/ui/badge'

interface StatusBadgeProps {
  status: string
  variant?: 'default' | 'destructive' | 'secondary' | 'outline'
  className?: string
  labels?: Record<string, string>
}

export const StatusBadge = ({ status, variant, className, labels = {} }: StatusBadgeProps) => {
  const getVariant = () => {
    if (variant) return variant
    
    switch (status) {
      case 'approved':
      case 'paid':
        return 'default'
      case 'rejected':
      case 'voided':
      case 'overdue':
        return 'destructive'
      case 'pending':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getClassName = () => {
    const baseClass = className || ''
    switch (status) {
      case 'approved':
        return `bg-green-600 hover:bg-green-700 ${baseClass}`
      case 'paid':
        return `bg-green-600 hover:bg-green-700 ${baseClass}`
      case 'partially_paid':
        return `bg-gray-500 hover:bg-gray-600 ${baseClass}`
      default:
        return baseClass
    }
  }

  const displayLabel = labels[status] || status

  return (
    <Badge variant={getVariant()} className={getClassName()}>
      {displayLabel}
    </Badge>
  )
}

