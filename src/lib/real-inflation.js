import { parseRealEstateCsv, parseYearlyCsv } from './utils.js'

export const REAL_INFLATION_ASSET_KEYS = ['btc', 'gold', 'sp500', 'realEstate']

export const DEFAULT_REAL_INFLATION_WEIGHTS = { btc: 25, gold: 25, sp500: 25, realEstate: 25 }

export const REAL_INFLATION_WEIGHTS_KEY = 'zkazenepenize.real-inflation-weights.v1'

export function clampRealInflationWeight(value) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function loadRealInflationWeights() {
  const weights = { ...DEFAULT_REAL_INFLATION_WEIGHTS }
  try {
    const raw = localStorage.getItem(REAL_INFLATION_WEIGHTS_KEY)
    if (!raw) return weights
    const stored = JSON.parse(raw)
    if (!stored || typeof stored !== 'object') return weights
    for (const key of REAL_INFLATION_ASSET_KEYS) {
      const value = Number(stored[key])
      if (Number.isFinite(value)) weights[key] = clampRealInflationWeight(value)
    }
  } catch {
    // Fall through to defaults when storage is unavailable.
  }
  return weights
}

export function yearlyChanges(prices) {
  const changes = new Map()
  const sorted = [...prices].sort((a, b) => a.year - b.year)
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]
    const current = sorted[i]
    if (current.year !== prev.year + 1) continue
    if (prev.close > 0) changes.set(current.year, ((current.close - prev.close) / prev.close) * 100)
  }
  return changes
}

// Fixed national series: flats in Czechia, consistent with the default
// filters of the "Příjem v nemovitostech" calculator.
export function parseRealEstateNationalFlats(csvText) {
  const byYear = new Map()
  for (const row of parseRealEstateCsv(csvText)) {
    if (row.okres !== '' || row.obyvatel !== 'Celkem' || row.stat !== 'Česko' || row.kraj !== '' || row.druh !== 'Byty [Kč/m2]') {
      continue
    }
    byYear.set(row.year, row.price)
  }
  return [...byYear.entries()].map(([year, close]) => ({ year, close }))
}

function changesByAssetFromSources({ btcCsv, xauCsv, sp500Csv, realEstateCsv }) {
  return {
    btc: yearlyChanges(parseYearlyCsv(btcCsv)),
    gold: yearlyChanges(parseYearlyCsv(xauCsv)),
    sp500: yearlyChanges(parseYearlyCsv(sp500Csv)),
    realEstate: yearlyChanges(parseRealEstateNationalFlats(realEstateCsv)),
  }
}

// Weighted average of yearly asset changes for the given weights.
// A year is included when at least one asset with weight > 0 has data;
// the average is renormalized over the available assets.
export function computeRealInflationByYear(sources, weights) {
  const changes = changesByAssetFromSources(sources)
  const years = new Set()
  for (const assetChanges of Object.values(changes)) {
    for (const year of assetChanges.keys()) years.add(year)
  }
  const byYear = new Map()
  for (const year of [...years].sort((a, b) => a - b)) {
    let weightedSum = 0
    let activeWeight = 0
    for (const key of REAL_INFLATION_ASSET_KEYS) {
      const change = changes[key].get(year) ?? null
      const weight = weights[key] ?? 0
      if (change !== null && weight > 0) {
        weightedSum += change * weight
        activeWeight += weight
      }
    }
    if (activeWeight > 0) byYear.set(year, weightedSum / activeWeight)
  }
  return byYear
}
