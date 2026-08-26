import { createContext, useContext } from 'react'

export const IncomeContext = createContext(null)

export function useIncome() {
  const ctx = useContext(IncomeContext)
  if (!ctx) throw new Error('useIncome musí být použit uvnitř IncomeProvider')
  return ctx
}
