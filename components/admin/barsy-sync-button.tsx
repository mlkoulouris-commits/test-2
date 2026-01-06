'use client'

import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface BarsySyncButtonProps {
  label: string
  onClick: () => Promise<void>
  disabled?: boolean
  loading?: boolean
  variant?: 'default' | 'outline' | 'secondary'
}

export const BarsySyncButton = ({
  label,
  onClick,
  disabled = false,
  loading = false,
  variant = 'default',
}: BarsySyncButtonProps) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      variant={variant}
      className="w-full"
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {label}
    </Button>
  )
}

