import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sortLocationsWithHQFirst<T extends { name: string }>(locations: T[]): T[] {
  return [...locations].sort((a, b) => {
    if (a.name === 'Memento Group HQ') return -1
    if (b.name === 'Memento Group HQ') return 1
    return a.name.localeCompare(b.name)
  })
}

export function formatCurrency(amount: number, decimals: number = 2): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
