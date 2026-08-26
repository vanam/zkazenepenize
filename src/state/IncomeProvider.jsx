import { useMemo, useState } from 'react'
import { buildIncomeCsv, decodeUrlData, parseIncomeCsv } from '../lib/utils.js'
import { IncomeContext } from './income-context.js'

const STORAGE_KEY = 'zkazenepenize.income.v1'
const BENCHMARK_STORAGE_KEY = 'zkazenepenize.benchmark.v1'

const SHARED_NAME = 'Sdílený odkaz'
const SHARED_BENCHMARK_NAME = 'Sdílený benchmark'
const STORAGE_ERROR = 'Data jsou načtená, ale prohlížeč je nemohl trvale uložit.'

function store(storageKey, next) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

function readUrlCsv(paramName) {
  try {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get(paramName)
    if (!encoded) return null
    const text = decodeUrlData(encoded)
    const result = parseIncomeCsv(text)
    if (result.errors.length > 0 || result.rows.length === 0) return null
    params.delete(paramName)
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
    return text
  } catch {
    return null
  }
}

function loadStored(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const stored = JSON.parse(raw)
    return stored && typeof stored.text === 'string' ? stored : null
  } catch {
    return null
  }
}

function initialStored(storageKey, paramName, sharedName) {
  const sharedText = readUrlCsv(paramName)
  if (sharedText) {
    const next = { fileName: sharedName, uploadedAt: new Date().toISOString(), text: sharedText }
    store(storageKey, next)
    return next
  }
  return loadStored(storageKey)
}

function useIncomeDataset(storageKey, paramName, sharedName) {
  const [stored, setStored] = useState(() => initialStored(storageKey, paramName, sharedName))
  const [errors, setErrors] = useState([])
  const [warnings, setWarnings] = useState([])

  const parsed = useMemo(() => (stored ? parseIncomeCsv(stored.text) : null), [stored])

  async function upload(file) {
    if (!file) return
    const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel'
    if (!isCsv) {
      setErrors(['Podporován je pouze formát CSV (soubor s koncovkou .csv).'])
      return
    }
    try {
      const text = await file.text()
      const result = parseIncomeCsv(text)
      if (result.errors.length > 0 || result.rows.length === 0) {
        setErrors(result.errors)
        return
      }
      const next = { fileName: file.name, uploadedAt: new Date().toISOString(), text }
      setStored(next)
      setWarnings(store(storageKey, next) ? [] : [STORAGE_ERROR])
      setErrors([])
    } catch {
      setErrors(['Soubor se nepodařilo načíst. Zkuste to prosím znovu.'])
    }
  }

  function saveRows(nextRows, fileName = 'Ruční zadání') {
    const text = buildIncomeCsv(nextRows)
    const result = parseIncomeCsv(text)
    if (result.errors.length > 0 || result.rows.length === 0) {
      setErrors(result.errors)
      return false
    }
    const next = { fileName, uploadedAt: new Date().toISOString(), text }
    setStored(next)
    setWarnings(store(storageKey, next) ? [] : [STORAGE_ERROR])
    setErrors([])
    return true
  }

  function clear() {
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // The in-memory data can still be cleared when storage is unavailable.
    }
    setStored(null)
    setErrors([])
    setWarnings([])
  }

  return {
    fileName: stored?.fileName ?? null,
    uploadedAt: stored?.uploadedAt ?? null,
    rows: parsed?.rows ?? [],
    hasData: !!(parsed && parsed.rows.length > 0),
    errors,
    warnings,
    upload,
    saveRows,
    clear,
  }
}

export function IncomeProvider({ children }) {
  const income = useIncomeDataset(STORAGE_KEY, 'data', SHARED_NAME)
  const benchmark = useIncomeDataset(BENCHMARK_STORAGE_KEY, 'benchmark', SHARED_BENCHMARK_NAME)
  const value = { ...income, benchmark }

  return <IncomeContext.Provider value={value}>{children}</IncomeContext.Provider>
}
