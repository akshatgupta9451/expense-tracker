import { categoryService } from '@/services/categoryService'
import { useAsync } from './useAsync'

export function useCategories() {
  const { data, loading, error } = useAsync(() => categoryService.list(), [])
  const categories = data ?? []
  return {
    categories,
    expenseCategories: categories.filter((c) => c.type === 'expense'),
    incomeCategories: categories.filter((c) => c.type === 'income'),
    loading,
    error,
  }
}
