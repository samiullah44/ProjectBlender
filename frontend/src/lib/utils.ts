import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatGraphDate(dateStr: any) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr as any;
  try {
      const datePart = dateStr.split('T')[0];
      const [year, month, day] = datePart.split('-');
      if (!year || !month || !day) return dateStr.slice(5) || dateStr;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
      return dateStr;
  }
}