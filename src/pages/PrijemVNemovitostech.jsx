import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyCalculator from '../components/EmptyCalculator.jsx'
import cen0402Csv from '../data/CEN0402-transformed.csv?raw'
import { useIncome } from '../state/income-context.js'
import { useSettings } from '../state/settings-context.js'
import { formatCzk, formatNumber, formatSignedPercentage, formatYearCount, getChangeClassName, mergeIncomeYears, parseRealEstateCsv } from '../lib/utils.js'

const REAL_ESTATE_ROWS = parseRealEstateCsv(cen0402Csv)

const OBYVATEL_ORDER = ['Celkem', 'do 1 999 obyv.', '2 000 - 9 999 obyv.', '10 000 - 49 999 obyv.', '50 000 obyv. a více']
const DRUH_ORDER = ['Byty [Kč/m2]', 'Rodinné domy [Kč/m2]']

function uniqueValues(rows, key) {
  const seen = new Set()
  for (const row of rows) {
    if (!seen.has(row[key])) seen.add(row[key])
  }
  return [...seen]
}

function sortedByOrder(values, order) {
  return [...values].sort((a, b) => {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b, 'cs')
  })
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'cs'))
}

const OBYVATEL_OPTIONS = sortedByOrder(uniqueValues(REAL_ESTATE_ROWS, 'obyvatel'), OBYVATEL_ORDER)
const KRAJ_OPTIONS = [''].concat(uniqueSorted(uniqueValues(REAL_ESTATE_ROWS, 'kraj').filter((k) => k !== '')))
const DRUH_OPTIONS = sortedByOrder(uniqueValues(REAL_ESTATE_ROWS, 'druh'), DRUH_ORDER)

const COUNTRY = 'Česko'
const DEFAULT_FILTERS = { obyvatel: 'Celkem', kraj: '', druh: 'Byty [Kč/m2]' }
const FILTERS_STORAGE_KEY = 'zkazenepenize.realestate-filters.v1'

function pickDefault(options, value) {
  return options.includes(value) ? value : options[0] ?? ''
}

function loadStoredFilters() {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw)
    if (!stored || typeof stored !== 'object') return null
    return stored
  } catch {
    return null
  }
}

export default function PrijemVNemovitostech() {
  const { rows, hasData, fileName, clear, benchmark } = useIncome()
  const { hideAxisLabels, showBenchmark } = useSettings()
  const benchmarkVisible = showBenchmark && benchmark.hasData
  const [filters, setFilters] = useState(() => {
    const stored = loadStoredFilters()
    const storedKraj = stored?.kraj ?? DEFAULT_FILTERS.kraj
    return {
      obyvatel: pickDefault(OBYVATEL_OPTIONS, stored?.obyvatel ?? DEFAULT_FILTERS.obyvatel),
      kraj: KRAJ_OPTIONS.includes(storedKraj) ? storedKraj : KRAJ_OPTIONS[0] ?? '',
      druh: pickDefault(DRUH_OPTIONS, stored?.druh ?? DEFAULT_FILTERS.druh),
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // Keep filters for this session when storage is unavailable.
    }
  }, [filters])

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }))

  const priceByYear = useMemo(() => {
    const map = new Map()
    for (const r of REAL_ESTATE_ROWS) {
      if (r.okres !== '') continue
      if (r.obyvatel !== filters.obyvatel || r.stat !== COUNTRY || r.kraj !== filters.kraj || r.druh !== filters.druh) {
        continue
      }
      map.set(r.year, r.price)
    }
    return map
  }, [filters])
  const comparisonRows = useMemo(
    () => mergeIncomeYears(rows, benchmarkVisible ? benchmark.rows : []),
    [rows, benchmark.rows, benchmarkVisible],
  )

  const chartData = useMemo(
    () =>
      comparisonRows.map((row) => {
        const price = priceByYear.get(row.year) ?? null
        const benchmarkCzk = row.benchmarkCzk
        return {
          rok: row.year,
          czk: row.incomeCzk,
          price,
          m2: price && row.incomeCzk !== null ? row.incomeCzk / price : null,
          benchmarkCzk,
          benchmarkM2: price && benchmarkCzk !== null ? benchmarkCzk / price : null,
          na: !price,
        }
      }),
    [comparisonRows, priceByYear],
  )

  if (!hasData) {
    return (
      <EmptyCalculator title="Příjem v nemovitostech">
        Zjistěte, kolik metrů čtverečních bydlení představoval váš příjem v jednotlivých letech.
      </EmptyCalculator>
    )
  }

  const priced = chartData.filter((d) => !d.na && (d.czk !== null || d.benchmarkCzk !== null))
  const userData = priced.filter((d) => d.czk !== null)
  const first = userData[0] ?? null
  const last = userData[userData.length - 1] ?? null
  const changePct =
    first && last && first.m2 > 0 && last.rok !== first.rok ? ((last.m2 - first.m2) / first.m2) * 100 : null

  return (
    <div className="calc-page">
      <div className="page-eyebrow"><span>Dostupnost bydlení</span></div>
      <h1>Příjem v nemovitostech</h1>
      <p className="lead">
        Kolik metrů čtverečních nemovitosti jste si mohli za čistý roční příjem koupit? Výpočet dělí příjem
        průměrnou kupní cenou za m² podle zvolených filtrů.
      </p>

      <p className="data-source">
        Příjem ze souboru <strong>{fileName}</strong> ({formatYearCount(rows.length)}) ·{' '}
        <button type="button" className="link-btn" onClick={clear}>
          vymazat data
        </button>
        {' · '}Zdroj cen nemovitostí:{' '}
        <a href="https://data.csu.gov.cz/datastat/info/SADA/CEN0402" target="_blank" rel="noreferrer">
          ČSÚ – CEN0402
        </a>{' '}
        (průměrná kupní cena za m²).
      </p>

      <section className="panel filter-panel">
        <h2>Filtry</h2>
        <div className="filters">
          <label className="filter-field">
            <span>Počet obyvatel obce</span>
            <select value={filters.obyvatel} onChange={setFilter('obyvatel')}>
              {OBYVATEL_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Kraj</span>
            <select value={filters.kraj} onChange={setFilter('kraj')}>
              {KRAJ_OPTIONS.map((v) => (
                <option key={v || 'all'} value={v}>
                  {v === '' ? 'Celé Česko' : v}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Druh nemovitosti</span>
            <select value={filters.druh} onChange={setFilter('druh')}>
              {DRUH_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="stat-row">
        {first && (
          <div className="stat-card">
            <span className="stat-label">Rok {first.rok}</span>
            <strong>{formatNumber(first.m2)} m²</strong>
            <span className="stat-sub">cena {formatCzk(first.price)}/m² · příjem {formatCzk(first.czk)}</span>
          </div>
        )}
        {last && (
          <div className="stat-card">
            <span className="stat-label">Rok {last.rok}</span>
            <strong>{formatNumber(last.m2)} m²</strong>
            <span className="stat-sub">cena {formatCzk(last.price)}/m² · příjem {formatCzk(last.czk)}</span>
          </div>
        )}
        {changePct !== null && (
          <div className={`stat-card ${getChangeClassName(changePct)}`}>
            <span className="stat-label">Změna kupní síly v m²</span>
            <strong>{formatSignedPercentage(changePct)}</strong>
            <span className="stat-sub">mezi roky {first.rok} a {last.rok}</span>
          </div>
        )}
      </div>

      <section className="panel chart-panel">
        <h2>Kolik m² jste si mohli za roční příjem koupit</h2>
        {priced.length === 0 ? (
          <p className="chart-notice">
            Pro tuto kombinaci filtrů nejsou k dispozici žádná data. Zkuste jiný kraj, druh nemovitosti nebo počet
            obyvatel obce. Celostátní údaje podle velikosti obce tabulka neobsahuje.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rok" tickFormatter={(v) => String(v)} />
              <YAxis tickFormatter={(v) => hideAxisLabels ? "" : formatNumber(v)} width={90} label={{ value: 'm²', angle: -90, position: 'insideLeft' }} />
              <Tooltip content={<RealEstateTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="m2" name="Kupní síla v m²" stroke="#b45309" strokeWidth={2.5} dot={{ r: 4 }} />
              {benchmarkVisible && <Line type="monotone" dataKey="benchmarkM2" name="Benchmark v m²" stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 3" dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="panel">
        <h2>Podrobnosti</h2>
        <p className="chart-note">
          Příjem přepočtený kupní cenou za m², pod hodnotou v m² je cena pro daný rok a filtry a změna oproti předchozímu záznamu.
        </p>
        {priced.length === 0 ? (
          <p className="chart-notice">Žádná data pro zvolené filtry.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rok</th>
                  <th className="num">Čistý roční příjem</th>
                  <th className="num">Příjem v m²</th>
                  {benchmarkVisible && <th className="num">Benchmark – čistý příjem</th>}
                  {benchmarkVisible && <th className="num">Benchmark v m²</th>}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = chartData.filter((row) => row.czk !== null)
                  return filtered.map((row, idx) => {
                    const prev = idx > 0 ? filtered[idx - 1] : null
                    const hasCzkChange = prev && Number.isFinite(prev.czk) && prev.czk > 0 && Number.isFinite(row.czk)
                    const czkDiff = hasCzkChange ? row.czk - prev.czk : null
                    const czkPct = hasCzkChange ? (czkDiff / prev.czk) * 100 : null
                    const hasM2Change = prev && !prev.na && !row.na && Number.isFinite(prev.m2) && Number.isFinite(row.m2) && prev.m2 > 0
                    const m2Diff = hasM2Change ? row.m2 - prev.m2 : null
                    const m2Pct = hasM2Change ? (m2Diff / prev.m2) * 100 : null
                    const hasBenchCzkChange = prev && Number.isFinite(prev.benchmarkCzk) && prev.benchmarkCzk > 0 && Number.isFinite(row.benchmarkCzk)
                    const benchCzkDiff = hasBenchCzkChange ? row.benchmarkCzk - prev.benchmarkCzk : null
                    const benchCzkPct = hasBenchCzkChange ? (benchCzkDiff / prev.benchmarkCzk) * 100 : null
                    const hasBenchM2Change = prev && !prev.na && !row.na && Number.isFinite(prev.benchmarkM2) && Number.isFinite(row.benchmarkM2) && prev.benchmarkM2 > 0
                    const benchM2Diff = hasBenchM2Change ? row.benchmarkM2 - prev.benchmarkM2 : null
                    const benchM2Pct = hasBenchM2Change ? (benchM2Diff / prev.benchmarkM2) * 100 : null
                    return (
                      <tr key={row.rok}>
                        <td>{row.rok}</td>
                        <td className="num">
                          <div>{formatCzk(row.czk)}</div>
                          {hasCzkChange && (
                            <div className={`change-detail ${getChangeClassName(czkPct)}`}>
                              {czkDiff >= 0 ? '+' : '−'}{formatCzk(Math.abs(czkDiff))} ({formatSignedPercentage(czkPct)})
                            </div>
                          )}
                        </td>
                        <td className="num strong">
                          <div>{row.na ? 'N/A' : `${formatNumber(row.m2)} m²`}</div>
                          {!row.na && <div className="change-detail">cena {formatCzk(row.price)}/m²</div>}
                          {hasM2Change && (
                            <div className={`change-detail ${getChangeClassName(m2Pct)}`}>
                              {m2Diff >= 0 ? '+' : '−'}{formatNumber(Math.abs(m2Diff))} m² ({formatSignedPercentage(m2Pct)})
                            </div>
                          )}
                        </td>
                        {benchmarkVisible && (
                          <td className="num">
                            <div>{row.benchmarkCzk !== null ? formatCzk(row.benchmarkCzk) : 'N/A'}</div>
                            {hasBenchCzkChange && (
                              <div className={`change-detail ${getChangeClassName(benchCzkPct)}`}>
                                {benchCzkDiff >= 0 ? '+' : '−'}{formatCzk(Math.abs(benchCzkDiff))} ({formatSignedPercentage(benchCzkPct)})
                              </div>
                            )}
                          </td>
                        )}
                        {benchmarkVisible && (
                          <td className="num">
                            <div>{row.benchmarkM2 !== null ? `${formatNumber(row.benchmarkM2)} m²` : 'N/A'}</div>
                            {!row.na && row.benchmarkM2 !== null && (
                              <div className="change-detail">cena {formatCzk(row.price)}/m²</div>
                            )}
                            {hasBenchM2Change && (
                              <div className={`change-detail ${getChangeClassName(benchM2Pct)}`}>
                                {benchM2Diff >= 0 ? '+' : '−'}{formatNumber(Math.abs(benchM2Diff))} m² ({formatSignedPercentage(benchM2Pct)})
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function RealEstateTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  if (row.na) {
    return (
      <div className="chart-tooltip">
        <strong>{row.rok}</strong>
        {row.czk !== null && <span>Příjem: {formatCzk(row.czk)}</span>}
        {row.benchmarkCzk !== null && <span>Benchmark: {formatCzk(row.benchmarkCzk)}</span>}
        <span>Cena: N/A</span>
        {row.czk !== null && <span style={{ color: '#b45309' }}>Příjem v nemovitostech: N/A</span>}
      </div>
    )
  }
  return (
    <div className="chart-tooltip">
      <strong>{row.rok}</strong>
      {row.czk !== null && <span>Příjem: {formatCzk(row.czk)}</span>}
      {row.benchmarkCzk !== null && <span>Benchmark: {formatCzk(row.benchmarkCzk)}</span>}
      <span>Cena: {formatCzk(row.price)} /m²</span>
      {row.m2 !== null && <span style={{ color: '#b45309' }}>Příjem v nemovitostech: {formatNumber(row.m2)} m²</span>}
      {row.benchmarkM2 !== null && <span style={{ color: '#7c3aed' }}>Benchmark v nemovitostech: {formatNumber(row.benchmarkM2)} m²</span>}
    </div>
  )
}
