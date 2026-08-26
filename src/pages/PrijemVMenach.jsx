import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyCalculator from '../components/EmptyCalculator.jsx'
import kurzyCsv from '../data/kurzy-men.csv?raw'
import { useIncome } from '../state/income-context.js'
import { useSettings } from '../state/settings-context.js'
import { formatCzk, formatNumber, formatSignedPercentage, formatYearCount, getChangeClassName, mergeIncomeYears, parseRatesCsv } from '../lib/utils.js'

export default function PrijemVMenach() {
  const rates = useMemo(() => parseRatesCsv(kurzyCsv), [])
  const { rows, hasData, fileName, clear, benchmark } = useIncome()
  const { hideAxisLabels, showBenchmark } = useSettings()
  const benchmarkVisible = showBenchmark && benchmark.hasData

  const ratesByYear = useMemo(() => Object.fromEntries(rates.map((r) => [r.year, r])), [rates])
  const comparisonRows = useMemo(
    () => mergeIncomeYears(rows, benchmarkVisible ? benchmark.rows : []),
    [rows, benchmark.rows, benchmarkVisible],
  )

  const chartData = useMemo(
    () =>
      comparisonRows.map((row) => {
        const rate = ratesByYear[row.year]
        const benchmarkCzk = row.benchmarkCzk
        return {
          rok: row.year,
          czk: row.incomeCzk,
          eur: rate && row.incomeCzk !== null ? row.incomeCzk / rate.eur : null,
          usd: rate && row.incomeCzk !== null ? row.incomeCzk / rate.usd : null,
          benchmarkCzk,
          benchmarkEur: rate && benchmarkCzk !== null ? benchmarkCzk / rate.eur : null,
          benchmarkUsd: rate && benchmarkCzk !== null ? benchmarkCzk / rate.usd : null,
          kurzEur: rate?.eur ?? null,
          kurzUsd: rate?.usd ?? null,
          na: !rate,
        }
      }),
    [comparisonRows, ratesByYear],
  )

  const withData = chartData.filter((d) => !d.na && (d.czk !== null || d.benchmarkCzk !== null))
  const userData = withData.filter((d) => d.czk !== null)
  const first = userData[0] ?? null
  const last = userData[userData.length - 1] ?? null
  const eurChangePct =
    first && last && first.eur > 0 && last.rok !== first.rok ? ((last.eur - first.eur) / first.eur) * 100 : null
  const usdChangePct =
    first && last && first.usd > 0 && last.rok !== first.rok ? ((last.usd - first.usd) / first.usd) * 100 : null

  if (!hasData) {
    return (
      <EmptyCalculator title="Příjem v EUR a USD">
        Přepočítejte svůj příjem podle průměrných ročních kurzů eura a amerického dolaru.
      </EmptyCalculator>
    )
  }

  return (
    <div className="calc-page">
      <div className="page-eyebrow"><span>Měnové srovnání</span></div>
      <h1>Příjem v EUR a USD</h1>
      <p className="lead">
        Přepočet vašeho čistého ročního příjmu na eura (EUR) a americké dolary (USD) podle jednotných kurzů vyhlašovaných ČNB.
      </p>

      <p className="data-source">
        Zobrazená data: <strong>{fileName}</strong> ({formatYearCount(rows.length)}) ·{' '}
        <button type="button" className="link-btn" onClick={clear}>
          vymazat data
        </button>
        {' · '}Zdroj kurzů:{' '}
        <a href="https://www.kurzy.cz/kurzy-men/jednotny-kurz/" target="_blank" rel="noreferrer">
          Kurzy.cz – jednotný kurz
        </a>
      </p>

      <div className="stat-row">
        {first && (
          <div className="stat-card">
            <span className="stat-label">Rok {first.rok}</span>
            <strong>{formatNumber(first.eur)} EUR</strong>
            <span className="stat-sub">{formatNumber(first.usd)} USD</span>
          </div>
        )}
        {last && (
          <div className="stat-card">
            <span className="stat-label">Rok {last.rok}</span>
            <strong>{formatNumber(last.eur)} EUR</strong>
            <span className="stat-sub">{formatNumber(last.usd)} USD</span>
          </div>
        )}
        {eurChangePct !== null && usdChangePct !== null && (
          <div className="stat-card stat-card-changes">
            <span className="stat-label">Změna příjmu</span>
            <div className="currency-change-grid">
              <div>
                <span>EUR</span>
                <strong className={getChangeClassName(eurChangePct)}>
                  {formatSignedPercentage(eurChangePct)}
                </strong>
              </div>
              <div>
                <span>USD</span>
                <strong className={getChangeClassName(usdChangePct)}>
                  {formatSignedPercentage(usdChangePct)}
                </strong>
              </div>
            </div>
            <span className="stat-sub">mezi roky {first.rok} a {last.rok}</span>
          </div>
        )}
      </div>

      <section className="panel chart-panel">
        <h2>Příjem v EUR a USD podle roku</h2>
        {withData.length === 0 ? (
          <p className="chart-notice">Pro zadané roky nejsou k dispozici průměrné kurzy EUR a USD.</p>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rok" tickFormatter={(v) => String(v)} />
              <YAxis yAxisId="eur" tickFormatter={(v) => hideAxisLabels ? "" : formatNumber(v)} width={90} label={{ value: 'EUR', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="usd" orientation="right" tickFormatter={(v) => hideAxisLabels ? "" : formatNumber(v)} width={90} label={{ value: 'USD', angle: 90, position: 'insideRight' }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Line yAxisId="eur" type="monotone" dataKey="eur" name="EUR" stroke="#b45309" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line yAxisId="usd" type="monotone" dataKey="usd" name="USD" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 4 }} />
              {benchmarkVisible && (
                <>
                  <Line yAxisId="eur" type="monotone" dataKey="benchmarkEur" name="Benchmark EUR" stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                  <Line yAxisId="usd" type="monotone" dataKey="benchmarkUsd" name="Benchmark USD" stroke="#a855f7" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="panel">
        <h2>Podrobnosti</h2>
        <p className="chart-note">
          Příjem přepočtený kurzem ČNB, pod částkou v cizí měně je kurz pro daný rok a změna oproti předchozímu záznamu.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rok</th>
                <th className="num">Čistý roční příjem</th>
                <th className="num">Příjem v EUR</th>
                <th className="num">Příjem v USD</th>
                {benchmarkVisible && <th className="num">Benchmark – čistý příjem</th>}
                {benchmarkVisible && <th className="num">Benchmark v EUR</th>}
                {benchmarkVisible && <th className="num">Benchmark v USD</th>}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filtered = chartData.filter((row) => row.czk !== null)
                return filtered.map((row, idx) => {
                  const prev = idx > 0 ? filtered[idx - 1] : null
                  const czkPrev = prev?.czk ?? null
                  const hasCzkChange = Number.isFinite(czkPrev) && czkPrev > 0 && Number.isFinite(row.czk)
                  const czkDiff = hasCzkChange ? row.czk - czkPrev : null
                  const czkPct = hasCzkChange ? (czkDiff / czkPrev) * 100 : null

                  const hasEurChange = prev && !prev.na && !row.na && Number.isFinite(prev.eur) && Number.isFinite(row.eur) && prev.eur > 0
                  const eurDiff = hasEurChange ? row.eur - prev.eur : null
                  const eurPct = hasEurChange ? (eurDiff / prev.eur) * 100 : null

                  const hasUsdChange = prev && !prev.na && !row.na && Number.isFinite(prev.usd) && Number.isFinite(row.usd) && prev.usd > 0
                  const usdDiff = hasUsdChange ? row.usd - prev.usd : null
                  const usdPct = hasUsdChange ? (usdDiff / prev.usd) * 100 : null

                  const benchPrev = idx > 0 ? filtered[idx - 1] : null
                  const hasBenchCzkChange = benchPrev && Number.isFinite(benchPrev.benchmarkCzk) && benchPrev.benchmarkCzk > 0 && Number.isFinite(row.benchmarkCzk)
                  const benchCzkDiff = hasBenchCzkChange ? row.benchmarkCzk - benchPrev.benchmarkCzk : null
                  const benchCzkPct = hasBenchCzkChange ? (benchCzkDiff / benchPrev.benchmarkCzk) * 100 : null
                  const hasBenchEurChange = benchPrev && !benchPrev.na && !row.na && Number.isFinite(benchPrev.benchmarkEur) && Number.isFinite(row.benchmarkEur) && benchPrev.benchmarkEur > 0
                  const benchEurDiff = hasBenchEurChange ? row.benchmarkEur - benchPrev.benchmarkEur : null
                  const benchEurPct = hasBenchEurChange ? (benchEurDiff / benchPrev.benchmarkEur) * 100 : null
                  const hasBenchUsdChange = benchPrev && !benchPrev.na && !row.na && Number.isFinite(benchPrev.benchmarkUsd) && Number.isFinite(row.benchmarkUsd) && benchPrev.benchmarkUsd > 0
                  const benchUsdDiff = hasBenchUsdChange ? row.benchmarkUsd - benchPrev.benchmarkUsd : null
                  const benchUsdPct = hasBenchUsdChange ? (benchUsdDiff / benchPrev.benchmarkUsd) * 100 : null

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
                        <div>{row.na ? 'N/A' : `${formatNumber(row.eur)} EUR`}</div>
                        {!row.na && (
                          <div className="change-detail">kurz {formatNumber(row.kurzEur)} CZK/EUR</div>
                        )}
                        {hasEurChange && (
                          <div className={`change-detail ${getChangeClassName(eurPct)}`}>
                            {eurDiff >= 0 ? '+' : '−'}{formatNumber(Math.abs(eurDiff))} EUR ({formatSignedPercentage(eurPct)})
                          </div>
                        )}
                      </td>
                      <td className="num strong">
                        <div>{row.na ? 'N/A' : `${formatNumber(row.usd)} USD`}</div>
                        {!row.na && (
                          <div className="change-detail">kurz {formatNumber(row.kurzUsd)} CZK/USD</div>
                        )}
                        {hasUsdChange && (
                          <div className={`change-detail ${getChangeClassName(usdPct)}`}>
                            {usdDiff >= 0 ? '+' : '−'}{formatNumber(Math.abs(usdDiff))} USD ({formatSignedPercentage(usdPct)})
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
                          <div>{row.benchmarkEur !== null ? `${formatNumber(row.benchmarkEur)} EUR` : 'N/A'}</div>
                          {row.benchmarkEur !== null && !row.na && (
                            <div className="change-detail">kurz {formatNumber(row.kurzEur)} CZK/EUR</div>
                          )}
                          {hasBenchEurChange && (
                            <div className={`change-detail ${getChangeClassName(benchEurPct)}`}>
                              {benchEurDiff >= 0 ? '+' : '−'}{formatNumber(Math.abs(benchEurDiff))} EUR ({formatSignedPercentage(benchEurPct)})
                            </div>
                          )}
                        </td>
                      )}
                      {benchmarkVisible && (
                        <td className="num">
                          <div>{row.benchmarkUsd !== null ? `${formatNumber(row.benchmarkUsd)} USD` : 'N/A'}</div>
                          {row.benchmarkUsd !== null && !row.na && (
                            <div className="change-detail">kurz {formatNumber(row.kurzUsd)} CZK/USD</div>
                          )}
                          {hasBenchUsdChange && (
                            <div className={`change-detail ${getChangeClassName(benchUsdPct)}`}>
                              {benchUsdDiff >= 0 ? '+' : '−'}{formatNumber(Math.abs(benchUsdDiff))} USD ({formatSignedPercentage(benchUsdPct)})
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

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>{row.rok}</strong>
      {row.czk !== null && <span>Příjem: {formatCzk(row.czk)}</span>}
      {row.benchmarkCzk !== null && <span>Benchmark: {formatCzk(row.benchmarkCzk)}</span>}
      {payload.map((p) => (
        <span key={p.dataKey} style={{ color: p.stroke }}>
          {p.name}: {row.na ? 'N/A' : formatNumber(p.value)}
        </span>
      ))}
    </div>
  )
}
