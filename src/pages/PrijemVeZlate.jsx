import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyCalculator from '../components/EmptyCalculator.jsx'
import xauCsv from '../data/xauusd_y.csv?raw'
import kurzyCsv from '../data/kurzy-men.csv?raw'
import { useIncome } from '../state/income-context.js'
import { useSettings } from '../state/settings-context.js'
import { formatCzk, formatNumber, formatSignedPercentage, formatYearCount, getChangeClassName, mergeIncomeYears, parseRatesCsv, parseYearlyCsv } from '../lib/utils.js'

const TROY_OZ_G = 31.1034768

export default function PrijemVeZlate() {
  const rates = useMemo(() => parseRatesCsv(kurzyCsv), [])
  const goldPrices = useMemo(() => parseYearlyCsv(xauCsv), [])
  const { rows, hasData, fileName, clear, benchmark } = useIncome()
  const { hideAxisLabels, showBenchmark } = useSettings()
  const benchmarkVisible = showBenchmark && benchmark.hasData

  const ratesByYear = useMemo(() => Object.fromEntries(rates.map((r) => [r.year, r])), [rates])
  const priceByYear = useMemo(
    () => Object.fromEntries(goldPrices.map((p) => [p.year, p.close])),
    [goldPrices],
  )
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
        if (!rate || !close) return { rok: row.year, czk: row.incomeCzk, benchmarkCzk, benchmarkGrams: null, na: true, grams: null }
        const incomeUsd = row.incomeCzk !== null ? row.incomeCzk / rate.usd : null
        const oz = incomeUsd !== null ? incomeUsd / close : null
        return {
          rok: row.year,
          czk: row.incomeCzk,
          kurzUsd: rate.usd,
          cenaUsd: close,
          cenaCzk: close * rate.usd,
          cenaGramCzk: (close * rate.usd) / TROY_OZ_G,
          oz,
          grams: oz !== null ? oz * TROY_OZ_G : null,
          benchmarkCzk,
          benchmarkGrams: benchmarkCzk !== null ? benchmarkCzk / rate.usd / close * TROY_OZ_G : null,
        }
      }),
    [comparisonRows, ratesByYear, priceByYear],
  )

  const withData = chartData.filter((d) => !d.na && (d.czk !== null || d.benchmarkCzk !== null))
  const userData = withData.filter((d) => d.czk !== null)
  const first = userData[0] ?? null
  const last = userData[userData.length - 1] ?? null
  const changePct =
    first && last && first.grams > 0 && last.rok !== first.rok ? ((last.grams - first.grams) / first.grams) * 100 : null

  if (!hasData) {
    return (
      <EmptyCalculator title="Příjem ve zlatě">
        Přepočítejte čistý příjem na gramy zlata podle ceny na konci každého roku.
      </EmptyCalculator>
    )
  }

  return (
    <div className="calc-page">
      <div className="page-eyebrow"><span>Uchovatel hodnoty</span></div>
      <h1>Příjem ve zlatě</h1>
      <p className="lead">
        Kolik zlata jste si mohli za čistý roční příjem koupit? Výpočet používá cenu trojské unce na konci
        prosince daného roku a průměrný roční kurz CZK/USD.
      </p>

      <p className="data-source">
        Zobrazená data: <strong>{fileName}</strong> ({formatYearCount(rows.length)}) ·{' '}
        <button type="button" className="link-btn" onClick={clear}>
          vymazat data
        </button>
        {' · '}Zdroj cen zlata:{' '}
        <a href="https://stooq.com/q/d/?s=xauusd" target="_blank" rel="noreferrer">
          Stooq
        </a>
      </p>

      <div className="stat-row">
        {first && (
          <div className="stat-card">
            <span className="stat-label">Rok {first.rok}</span>
            <strong>{formatNumber(first.grams)} g</strong>
            <span className="stat-sub">{formatNumber(first.oz)} oz · cena {formatNumber(first.cenaUsd)} USD/oz</span>
          </div>
        )}
        {last && (
          <div className="stat-card">
            <span className="stat-label">Rok {last.rok}</span>
            <strong>{formatNumber(last.grams)} g</strong>
            <span className="stat-sub">{formatNumber(last.oz)} oz · cena {formatNumber(last.cenaUsd)} USD/oz</span>
          </div>
        )}
        {changePct !== null && (
          <div className={`stat-card ${getChangeClassName(changePct)}`}>
            <span className="stat-label">Změna kupní síly ve zlatě</span>
            <strong>{formatNumber(changePct)} %</strong>
            <span className="stat-sub">mezi roky {first.rok} a {last.rok}</span>
          </div>
        )}
      </div>

      <section className="panel chart-panel">
        <h2>Kolik gramů zlata jste si mohli za roční příjem koupit</h2>
        {withData.length === 0 ? (
          <p className="chart-notice">Pro zadané roky chybí kurz CZK/USD nebo cena zlata.</p>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rok" tickFormatter={(v) => String(v)} />
              <YAxis tickFormatter={(v) => hideAxisLabels ? "" : formatNumber(v)} width={90} label={{ value: 'gramy', angle: -90, position: 'insideLeft' }} />
              <Tooltip content={<GoldTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="grams" name="Gramy zlata" stroke="#ca8a04" strokeWidth={2.5} dot={{ r: 4 }} />
              {benchmarkVisible && <Line type="monotone" dataKey="benchmarkGrams" name="Benchmark ve zlatě" stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 3" dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="panel">
        <h2>Podrobnosti</h2>
        <p className="chart-note">
          Cena zlata (XAU) na konci roku v USD/oz, pod ní přepočet do CZK a kurz ČNB; příjem ve zlatě primárně v gramech, pod ním v uncích, cena za gram v Kč a změna oproti předchozímu záznamu.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rok</th>
                <th className="num">Čistý roční příjem</th>
                <th className="num">Cena zlata</th>
                <th className="num">Příjem ve zlatě</th>
                {benchmarkVisible && <th className="num">Benchmark – čistý příjem</th>}
                {benchmarkVisible && <th className="num">Benchmark ve zlatě</th>}
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
                  const hasGramsChange = prev && !prev.na && !row.na && Number.isFinite(prev.grams) && Number.isFinite(row.grams) && prev.grams > 0
                  const gramsDiff = hasGramsChange ? row.grams - prev.grams : null
                  const gramsPct = hasGramsChange ? (gramsDiff / prev.grams) * 100 : null
                  const hasBenchCzkChange = prev && Number.isFinite(prev.benchmarkCzk) && prev.benchmarkCzk > 0 && Number.isFinite(row.benchmarkCzk)
                  const benchCzkDiff = hasBenchCzkChange ? row.benchmarkCzk - prev.benchmarkCzk : null
                  const benchCzkPct = hasBenchCzkChange ? (benchCzkDiff / prev.benchmarkCzk) * 100 : null
                  const hasBenchGramsChange = prev && !prev.na && !row.na && Number.isFinite(prev.benchmarkGrams) && Number.isFinite(row.benchmarkGrams) && prev.benchmarkGrams > 0
                  const benchGramsDiff = hasBenchGramsChange ? row.benchmarkGrams - prev.benchmarkGrams : null
                  const benchGramsPct = hasBenchGramsChange ? (benchGramsDiff / prev.benchmarkGrams) * 100 : null
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
                        <div>{row.na ? 'N/A' : `${formatNumber(row.cenaUsd)} USD/oz`}</div>
                        {!row.na && (
                          <div className="change-detail">
                            ≈ {formatCzk(Math.round(row.cenaCzk))}/oz · kurz {formatNumber(row.kurzUsd)} CZK/USD
                          </div>
                        )}
                      </td>
                      <td className="num strong">
                        <div>{row.na ? 'N/A' : `${formatNumber(row.grams)} g`}</div>
                        {!row.na && <div className="change-detail">{formatNumber(row.oz)} oz · cena {formatCzk(Math.round(row.cenaGramCzk))}/g</div>}
                        {hasGramsChange && (
                          <div className={`change-detail ${getChangeClassName(gramsPct)}`}>
                            {gramsDiff >= 0 ? '+' : '−'}{formatNumber(Math.abs(gramsDiff))} g ({formatSignedPercentage(gramsPct)})
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
                          <div>{row.benchmarkGrams !== null ? `${formatNumber(row.benchmarkGrams)} g` : 'N/A'}</div>
                          {row.benchmarkGrams !== null && !row.na && (
                            <div className="change-detail">
                              {formatNumber(row.benchmarkGrams / TROY_OZ_G)} oz · cena {formatCzk(Math.round(row.cenaGramCzk))}/g
                            </div>
                          )}
                          {hasBenchGramsChange && (
                            <div className={`change-detail ${getChangeClassName(benchGramsPct)}`}>
                              {benchGramsDiff >= 0 ? '+' : '−'}{formatNumber(Math.abs(benchGramsDiff))} g ({formatSignedPercentage(benchGramsPct)})
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

function GoldTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>{row.rok}</strong>
      {row.czk !== null && <span>Příjem: {formatCzk(row.czk)}</span>}
      {row.benchmarkCzk !== null && <span>Benchmark: {formatCzk(row.benchmarkCzk)}</span>}
      <span>Cena zlata: {row.na ? 'N/A' : `${formatNumber(row.cenaUsd)} USD/oz (≈ ${formatCzk(Math.round(row.cenaCzk))}/oz)`}</span>
      {row.czk !== null && (
        <span style={{ color: '#ca8a04' }}>
          Příjem ve zlatě: {row.na ? 'N/A' : `${formatNumber(row.grams)} g (${formatNumber(row.oz)} oz, cena ${formatCzk(Math.round(row.cenaGramCzk))}/g)`}
        </span>
      )}
      {row.benchmarkGrams !== null && (
        <span style={{ color: '#7c3aed' }}>Benchmark ve zlatě: {formatNumber(row.benchmarkGrams)} g</span>
      )}
    </div>
  )
}
