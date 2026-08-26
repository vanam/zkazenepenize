import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyCalculator from '../components/EmptyCalculator.jsx'
import kurzyCsv from '../data/kurzy-men.csv?raw'
import spyCsv from '../data/spy_us_y.csv?raw'
import { useIncome } from '../state/income-context.js'
import { useSettings } from '../state/settings-context.js'
import { formatCzk, formatNumber, formatSignedPercentage, formatYearCount, getChangeClassName, mergeIncomeYears, parseRatesCsv, parseYearlyCsv } from '../lib/utils.js'

const sharesAmountFmt = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 })

export default function PrijemVSp500() {
  const rates = useMemo(() => parseRatesCsv(kurzyCsv), [])
  const sp500Prices = useMemo(() => parseYearlyCsv(spyCsv), [])
  const { rows, hasData, fileName, clear, benchmark } = useIncome()
  const { hideAxisLabels, showBenchmark } = useSettings()
  const benchmarkVisible = showBenchmark && benchmark.hasData

  const ratesByYear = useMemo(() => Object.fromEntries(rates.map((r) => [r.year, r])), [rates])
  const priceByYear = useMemo(() => Object.fromEntries(sp500Prices.map((p) => [p.year, p.close])), [sp500Prices])
  const comparisonRows = useMemo(
    () => mergeIncomeYears(rows, benchmarkVisible ? benchmark.rows : []),
    [rows, benchmark.rows, benchmarkVisible],
  )

  const chartData = useMemo(
    () =>
      comparisonRows.map((row) => {
        const rate = ratesByYear[row.year]
        const close = priceByYear[row.year]
        const benchmarkCzk = row.benchmarkCzk
        if (!rate || !close) return { rok: row.year, czk: row.incomeCzk, benchmarkCzk, benchmarkSpy: null, na: true, spy: null }
        const incomeUsd = row.incomeCzk !== null ? row.incomeCzk / rate.usd : null
        return {
          rok: row.year,
          czk: row.incomeCzk,
          kurzUsd: rate.usd,
          cenaUsd: close,
          cenaCzk: close * rate.usd,
          spy: incomeUsd !== null ? incomeUsd / close : null,
          benchmarkCzk,
          benchmarkSpy: benchmarkCzk !== null ? benchmarkCzk / rate.usd / close : null,
        }
      }),
    [comparisonRows, ratesByYear, priceByYear],
  )

  const withData = chartData.filter((d) => !d.na && (d.czk !== null || d.benchmarkCzk !== null))
  const userData = withData.filter((d) => d.czk !== null)
  const first = userData[0] ?? null
  const last = userData[userData.length - 1] ?? null
  const changePct =
    first && last && first.spy > 0 && last.rok !== first.rok ? ((last.spy - first.spy) / first.spy) * 100 : null

  if (!hasData) {
    return (
      <EmptyCalculator title="Příjem v S&amp;P 500">
        Přepočítejte svůj příjem na podíly indexového fondu SPDR S&amp;P 500 (SPY).
      </EmptyCalculator>
    )
  }

  return (
    <div className="calc-page">
      <div className="page-eyebrow"><span>Akciový trh</span></div>
      <h1>Příjem v S&amp;P 500</h1>
      <p className="lead">
        Kolik podílů fondu SPDR S&amp;P 500 (SPY) jste si mohli za čistý roční příjem koupit? Výpočet používá
        cenu fondu na konci roku a průměrný roční kurz CZK/USD.
      </p>

      <p className="data-source">
        Zobrazená data: <strong>{fileName}</strong> ({formatYearCount(rows.length)}) ·{' '}
        <button type="button" className="link-btn" onClick={clear}>
          vymazat data
        </button>
        {' · '}Zdroj cen ETF SPY:{' '}
        <a href="https://stooq.com/q/d/?s=spy.us" target="_blank" rel="noreferrer">
          Stooq
        </a>
      </p>

      <div className="stat-row">
        {first && (
          <div className="stat-card">
            <span className="stat-label">Rok {first.rok}</span>
            <strong>{sharesAmountFmt.format(first.spy)} podílů fondu SPY</strong>
            <span className="stat-sub">cena {formatNumber(first.cenaUsd)} USD</span>
          </div>
        )}
        {last && (
          <div className="stat-card">
            <span className="stat-label">Rok {last.rok}</span>
            <strong>{sharesAmountFmt.format(last.spy)} podílů fondu SPY</strong>
            <span className="stat-sub">cena {formatNumber(last.cenaUsd)} USD</span>
          </div>
        )}
        {changePct !== null && (
          <div className={`stat-card ${getChangeClassName(changePct)}`}>
            <span className="stat-label">Změna kupní síly v podílech fondu</span>
            <strong>{formatNumber(changePct)} %</strong>
            <span className="stat-sub">mezi roky {first.rok} a {last.rok}</span>
          </div>
        )}
      </div>

      <section className="panel chart-panel">
        <h2>Kolik podílů fondu SPY jste si mohli za roční příjem koupit</h2>
        {withData.length === 0 ? (
          <p className="chart-notice">Pro zadané roky chybí kurz CZK/USD nebo cena fondu SPY.</p>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rok" tickFormatter={(v) => String(v)} />
              <YAxis
                tickFormatter={(v) => hideAxisLabels ? "" : formatNumber(v)}
                width={90}
                label={{ value: 'Podíly fondu SPY', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<Sp500Tooltip />} />
              <Legend />
              <Line type="monotone" dataKey="spy" name="Fond SPY" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 4 }} />
              {benchmarkVisible && <Line type="monotone" dataKey="benchmarkSpy" name="Benchmark SPY" stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 3" dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="panel">
        <h2>Podrobnosti</h2>
        <p className="chart-note">
          Cena fondu SPY na konci roku v USD, pod ní přepočet do CZK a kurz ČNB. Pod příjmem v podílech je změna oproti předchozímu záznamu.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rok</th>
                <th className="num">Čistý roční příjem</th>
                <th className="num">Cena fondu SPY</th>
                <th className="num">Příjem v podílech SPY</th>
                {benchmarkVisible && <th className="num">Benchmark – čistý příjem</th>}
                {benchmarkVisible && <th className="num">Benchmark v podílech SPY</th>}
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
                  const hasSpyChange = prev && !prev.na && !row.na && Number.isFinite(prev.spy) && Number.isFinite(row.spy) && prev.spy > 0
                  const spyDiff = hasSpyChange ? row.spy - prev.spy : null
                  const spyPct = hasSpyChange ? (spyDiff / prev.spy) * 100 : null
                  const hasBenchCzkChange = prev && Number.isFinite(prev.benchmarkCzk) && prev.benchmarkCzk > 0 && Number.isFinite(row.benchmarkCzk)
                  const benchCzkDiff = hasBenchCzkChange ? row.benchmarkCzk - prev.benchmarkCzk : null
                  const benchCzkPct = hasBenchCzkChange ? (benchCzkDiff / prev.benchmarkCzk) * 100 : null
                  const hasBenchSpyChange = prev && !prev.na && !row.na && Number.isFinite(prev.benchmarkSpy) && Number.isFinite(row.benchmarkSpy) && prev.benchmarkSpy > 0
                  const benchSpyDiff = hasBenchSpyChange ? row.benchmarkSpy - prev.benchmarkSpy : null
                  const benchSpyPct = hasBenchSpyChange ? (benchSpyDiff / prev.benchmarkSpy) * 100 : null
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
                      <td className="num">
                        <div>{row.na ? 'N/A' : `${formatNumber(row.cenaUsd)} USD`}</div>
                        {!row.na && (
                          <div className="change-detail">
                            ≈ {formatCzk(Math.round(row.cenaCzk))} · kurz {formatNumber(row.kurzUsd)} CZK/USD
                          </div>
                        )}
                      </td>
                      <td className="num strong">
                        <div>{row.na ? 'N/A' : sharesAmountFmt.format(row.spy)}</div>
                        {hasSpyChange && (
                          <div className={`change-detail ${getChangeClassName(spyPct)}`}>
                            {spyDiff >= 0 ? '+' : '−'}{sharesAmountFmt.format(Math.abs(spyDiff))} ({formatSignedPercentage(spyPct)})
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
                        <td className="num strong">
                          <div>{row.benchmarkSpy !== null ? sharesAmountFmt.format(row.benchmarkSpy) : 'N/A'}</div>
                          {hasBenchSpyChange && (
                            <div className={`change-detail ${getChangeClassName(benchSpyPct)}`}>
                              {benchSpyDiff >= 0 ? '+' : '−'}{sharesAmountFmt.format(Math.abs(benchSpyDiff))} ({formatSignedPercentage(benchSpyPct)})
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
      </section>
    </div>
  )
}

function Sp500Tooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>{row.rok}</strong>
      {row.czk !== null && <span>Příjem: {formatCzk(row.czk)}</span>}
      {row.benchmarkCzk !== null && <span>Benchmark: {formatCzk(row.benchmarkCzk)}</span>}
      <span>Cena fondu SPY: {row.na ? 'N/A' : `${formatNumber(row.cenaUsd)} USD`}</span>
      {row.czk !== null && (
        <span style={{ color: '#16a34a' }}>Příjem v podílech fondu SPY: {row.na ? 'N/A' : sharesAmountFmt.format(row.spy)}</span>
      )}
      {row.benchmarkSpy !== null && (
        <span style={{ color: '#7c3aed' }}>Benchmark v podílech SPY: {sharesAmountFmt.format(row.benchmarkSpy)}</span>
      )}
    </div>
  )
}
