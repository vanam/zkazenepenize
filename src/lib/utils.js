export const YEAR_MIN = 1993
export const YEAR_MAX = new Date().getFullYear()

const numberFmt = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 })
const czkFmt = new Intl.NumberFormat('cs-CZ', {
  style: 'currency',
  currency: 'CZK',
  maximumFractionDigits: 0,
})

export function formatNumber(value) {
  return numberFmt.format(value)
}

export function formatCzk(value) {
  return czkFmt.format(value)
}

export function formatSignedPercentage(value) {
  if (!Number.isFinite(value)) return '—'
  return `${value >= 0 ? '+' : '−'}${formatNumber(Math.abs(value))} %`
}

export function formatYearCount(count) {
  if (count === 1) return '1 rok'
  if (count >= 2 && count <= 4) return `${count} roky`
  return `${count} let`
}

export function getChangeClassName(value) {
  if (!Number.isFinite(value) || value === 0) return 'change-neutral'
  return value > 0 ? 'change-positive' : 'change-negative'
}

export function getInflationCardClassName(value) {
  if (!Number.isFinite(value) || value === 0) return 'inflation-neutral'
  return value > 0 ? 'inflation-adverse' : 'inflation-favorable'
}

export function mergeIncomeYears(rows, benchmarkRows = []) {
  const incomeByYear = new Map(rows.map((row) => [row.year, row.incomeCzk]))
  const benchmarkByYear = new Map(benchmarkRows.map((row) => [row.year, row.incomeCzk]))
  const years = new Set([...incomeByYear.keys(), ...benchmarkByYear.keys()])

  return [...years]
    .sort((a, b) => a - b)
    .map((year) => ({
      year,
      incomeCzk: incomeByYear.get(year) ?? null,
      benchmarkCzk: benchmarkByYear.get(year) ?? null,
    }))
}

export function parseNumberCs(raw) {
  if (typeof raw === 'number') return raw
  let s = String(raw).trim().replace(/\s/g, '')
  s = s.replace(/(czk|kč)$/i, '').trim()
  if (!s) return NaN
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    s = s.replace(',', '.')
  }
  return Number(s)
}

export function detectDelimiter(line) {
  let commas = 0
  let semis = 0
  let quoted = false
  const input = String(line ?? '')
  for (let i = 0; i < input.length; i += 1) {
    if (input[i] === '"') {
      if (quoted && input[i + 1] === '"') {
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (!quoted && input[i] === ',') {
      commas += 1
    } else if (!quoted && input[i] === ';') {
      semis += 1
    }
  }
  return semis > commas ? ';' : ','
}

export function splitLine(line, delimiter) {
  const cells = []
  let cell = ''
  let quoted = false
  const input = String(line ?? '')

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (char === delimiter && !quoted) {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += char
    }
  }
  cells.push(cell.trim())
  return cells
}

export function parseIncomeCsv(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)
  let first = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== '') {
      first = i
      break
    }
  }
  if (first === -1) {
    return { rows: [], errors: ['Soubor je prázdný.'] }
  }

  const delimiter = detectDelimiter(lines[first])
  const headerCells = splitLine(lines[first], delimiter).map((h) => h.toLowerCase())
  const findCol = (re) => headerCells.findIndex((h) => re.test(h))
  let yearIdx = findCol(/rok|year/)
  if (yearIdx === -1) yearIdx = 0
  let incomeIdx = findCol(/prijem|income|hodnota|cisty|czk/)
  if (incomeIdx === -1 || incomeIdx === yearIdx) {
    incomeIdx = yearIdx === 0 ? 1 : 0
  }

  const headerYearCell = splitLine(lines[first], delimiter)[yearIdx] ?? ''
  const hasHeader = !/^\d{3,4}$/.test(headerYearCell.trim())
  const dataStart = hasHeader ? first + 1 : first

  const rows = []
  const errors = []
  const seenYears = new Set()
  for (let i = dataStart; i < lines.length; i += 1) {
    if (lines[i].trim() === '') continue
    const cells = splitLine(lines[i], delimiter)
    const lineNo = i + 1

    const yearRaw = cells[yearIdx] ?? ''
    const incomeRaw = cells[incomeIdx] ?? ''
    const year = Math.trunc(parseNumberCs(yearRaw))
    if (!/^\d{4}$/.test(yearRaw.trim()) || !Number.isFinite(year) || year < YEAR_MIN || year > YEAR_MAX) {
      errors.push(`Řádek ${lineNo}: rok musí být mezi ${YEAR_MIN} a ${YEAR_MAX}.`)
      continue
    }
    const incomeCzk = parseNumberCs(incomeRaw)
    if (!Number.isFinite(incomeCzk) || incomeCzk <= 0) {
      errors.push(`Řádek ${lineNo}: příjem v CZK není platné kladné číslo.`)
      continue
    }
    if (seenYears.has(year)) {
      errors.push(`Řádek ${lineNo}: rok ${year} je v souboru zadaný vícekrát.`)
      continue
    }
    seenYears.add(year)
    rows.push({ year, incomeCzk })
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push('V souboru nebyl nalezen žádný řádek s daty.')
  }
  rows.sort((a, b) => a.year - b.year)
  return { rows, errors }
}

export function parseAverageWageCsv(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)
  const first = lines.findIndex((line) => line.trim() !== '')
  if (first === -1) return []

  const delimiter = detectDelimiter(lines[first])
  const header = splitLine(lines[first], delimiter)
  const column = (name) => header.indexOf(name)
  const quarterIdx = column('Čtvrtletí')
  const regionIdx = column('ČR, regiony, kraje-Region')
  const countyIdx = column('ČR, regiony, kraje-Kraj')
  const valueIdx = column('Hodnota')

  if ([quarterIdx, regionIdx, countyIdx, valueIdx].includes(-1)) {
    throw new Error('Soubor průměrných mezd nemá očekávané sloupce.')
  }

  const rows = []
  for (let i = first + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '') continue
    const cells = splitLine(lines[i], delimiter)
    const quarterMatch = (cells[quarterIdx] ?? '').match(/^(\d+)\.\s*čtvrtletí\s+(\d{4})$/)
    const grossMonthly = parseNumberCs(cells[valueIdx] ?? '')
    if (!quarterMatch || !Number.isFinite(grossMonthly) || grossMonthly <= 0) continue
    rows.push({
      quarter: Number(quarterMatch[1]),
      year: Number(quarterMatch[2]),
      region: cells[regionIdx] ?? '',
      county: cells[countyIdx] ?? '',
      grossMonthly,
    })
  }
  return rows
}

export function buildAverageWageIncome(wageRows, county, multiplier, currentYear = YEAR_MAX) {
  const selectedByYear = new Map()
  for (const row of wageRows) {
    const matchesGeography = county ? row.county === county : row.county === '' && row.region === ''
    if (!matchesGeography) continue
    if (row.year !== currentYear && row.quarter !== 4) continue

    const selected = selectedByYear.get(row.year)
    if (!selected || (row.year === currentYear && row.quarter > selected.quarter)) {
      selectedByYear.set(row.year, row)
    }
  }

  return [...selectedByYear.values()]
    .map((row) => ({
      year: row.year,
      incomeCzk: Math.round(row.grossMonthly * 0.75 * 12 * multiplier),
    }))
    .sort((a, b) => a.year - b.year)
}

export function buildIncomeCsv(rows) {
  const lines = ['rok,prijem']
  for (const row of [...rows].sort((a, b) => a.year - b.year)) {
    lines.push(`${row.year},${row.incomeCzk}`)
  }
  return `${lines.join('\n')}\n`
}

export function encodeUrlData(text) {
  const bytes = new TextEncoder().encode(String(text ?? ''))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeUrlData(encoded) {
  const b64 = String(encoded ?? '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function parseYearlyCsv(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)
  let first = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== '') {
      first = i
      break
    }
  }
  if (first === -1) return []

  const delimiter = detectDelimiter(lines[first])
  const headerCells = splitLine(lines[first], delimiter).map((h) => h.toLowerCase())
  const dateIdx = Math.max(headerCells.findIndex((h) => /date|rok|year/.test(h)), 0)
  let closeIdx = headerCells.findIndex((h) => /^close$|uzavreni/.test(h))
  if (closeIdx === -1) closeIdx = 4

  const rows = []
  for (let i = first + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '') continue
    const cells = splitLine(lines[i], delimiter)
    const yearMatch = (cells[dateIdx] ?? '').match(/(\d{4})/)
    if (!yearMatch) continue
    const close = parseNumberCs(cells[closeIdx])
    if (!Number.isFinite(close) || close <= 0) continue
    rows.push({ year: Number(yearMatch[1]), close })
  }
  return rows.sort((a, b) => a.year - b.year)
}

export function parseRatesCsv(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)
  let first = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== '') {
      first = i
      break
    }
  }
  if (first === -1) return []

  const delimiter = detectDelimiter(lines[first])
  const headerCells = splitLine(lines[first], delimiter).map((h) => h.toLowerCase())
  const yearIdx = Math.max(headerCells.findIndex((h) => /rok|year/.test(h)), 0)
  const eurIdx = Math.max(headerCells.findIndex((h) => /^eur$/.test(h)), 1)
  const usdIdx = Math.max(headerCells.findIndex((h) => /^usd$/.test(h)), 2)

  const rates = []
  for (let i = first + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '') continue
    const cells = splitLine(lines[i], delimiter)
    const year = Math.trunc(parseNumberCs(cells[yearIdx]))
    const eur = parseNumberCs(cells[eurIdx])
    const usd = parseNumberCs(cells[usdIdx])
    if (!Number.isFinite(year) || !Number.isFinite(eur) || eur <= 0 || !Number.isFinite(usd) || usd <= 0) {
      continue
    }
    rates.push({ year, eur, usd })
  }
  return rates.sort((a, b) => a.year - b.year)
}

export function parseInflationCsv(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)
  let first = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== '') {
      first = i
      break
    }
  }
  if (first === -1) return []

  const delimiter = detectDelimiter(lines[first])
  const headerCells = splitLine(lines[first], delimiter).map((h) => h.toLowerCase())
  const yearIdx = Math.max(headerCells.findIndex((h) => /rok|year/.test(h)), 0)
  let rateIdx = headerCells.findIndex((h) => /inflac|míra|rate/.test(h))
  if (rateIdx === -1 || rateIdx === yearIdx) {
    rateIdx = yearIdx + 1
  }

  const rows = []
  for (let i = first + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '') continue
    const cells = splitLine(lines[i], delimiter)
    const yearRaw = cells[yearIdx] ?? ''
    const rate = parseNumberCs(cells[rateIdx])
    if (!/^\d{4}$/.test(yearRaw.trim()) || !Number.isFinite(rate)) {
      continue
    }
    rows.push({ year: Number(yearRaw), rate })
  }
  return rows.sort((a, b) => a.year - b.year)
}

export function parseRealEstateCsv(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)
  let first = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== '') {
      first = i
      break
    }
  }
  const rows = []
  if (first === -1) return rows

  const delimiter = detectDelimiter(lines[first])
  const header = splitLine(lines[first], delimiter).map((h) => h.toLowerCase())
  const findCol = (name, fallback) => {
    const i = header.indexOf(name)
    return i === -1 ? fallback : i
  }

  const obyvatelIdx = findCol('počet obyvatel obce', 2)
  const statIdx = findCol('území-stát', 4)
  const krajIdx = findCol('území-kraj', 6)
  const okresIdx = findCol('území-okres', 8)
  const druhIdx = findCol('druh nemovitosti', 10)
  let yearIdx = header.findIndex((h) => /rok|year|období/.test(h))
  if (yearIdx === -1) {
    for (let i = first + 1; i < lines.length; i += 1) {
      const cells = splitLine(lines[i], delimiter)
      yearIdx = cells.findIndex((c) => /^\d{4}$/.test(c))
      break
    }
  }
  if (yearIdx === -1) yearIdx = 12
  const priceIdx = findCol('hodnota', 14)

  for (let i = first + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '') continue
    const cells = splitLine(lines[i], delimiter)
    const yearRaw = cells[yearIdx] ?? ''
    const price = parseNumberCs(cells[priceIdx])
    if (!/^\d{4}$/.test(yearRaw.trim()) || !Number.isFinite(price) || price <= 0) continue
    rows.push({
      year: Number(yearRaw),
      obyvatel: cells[obyvatelIdx] ?? '',
      stat: cells[statIdx] ?? '',
      kraj: (cells[krajIdx] ?? '').trim(),
      okres: (cells[okresIdx] ?? '').trim(),
      druh: cells[druhIdx] ?? '',
      price,
    })
  }
  return rows.sort((a, b) => a.year - b.year)
}
