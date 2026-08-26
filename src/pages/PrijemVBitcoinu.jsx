import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyCalculator from '../components/EmptyCalculator.jsx'
import btcCsv from '../data/btc_v_y.csv?raw'
import kurzyCsv from '../data/kurzy-men.csv?raw'
import { useIncome } from '../state/income-context.js'
import { useSettings } from '../state/settings-context.js'
import { formatCzk, formatNumber, formatSignedPercentage, formatYearCount, getChangeClassName, mergeIncomeYears, parseRatesCsv, parseYearlyCsv } from '../lib/utils.js'

const btcAmountFmt = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 4 })

export default function PrijemVBitcoinu() {
  const rates = useMemo(() => parseRatesCsv(kurzyCsv), [])
  const btcPrices = useMemo(() => parseYearlyCsv(btcCsv), [])
  const { rows, hasData, fileName, clear, benchmark } = useIncome()
  const { hideAxisLabels, showBenchmark } = useSettings()
  const benchmarkVisible = showBenchmark && benchmark.hasData

  const ratesByYear = useMemo(() => Object.fromEntries(rates.map((r) => [r.year, r])), [rates])
  const priceByYear = useMemo(() => Object.fromEntries(btcPrices.map((p) => [p.year, p.close])), [btcPrices])
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
        if (!rate || !close) return { rok: row.year, czk: row.incomeCzk, benchmarkCzk, benchmarkBtc: null, na: true, btc: null }
        const incomeUsd = row.incomeCzk !== null ? row.incomeCzk / rate.usd : null
        return {
          rok: row.year,
          czk: row.incomeCzk,
          kurzUsd: rate.usd,
          cenaUsd: close,
          cenaCzk: close * rate.usd,
          btc: incomeUsd !== null ? incomeUsd / close : null,
          benchmarkCzk,
          benchmarkBtc: benchmarkCzk !== null ? benchmarkCzk / rate.usd / close : null,
        }
      }),
    [comparisonRows, ratesByYear, priceByYear],
  )

  const withData = chartData.filter((d) => !d.na && (d.czk !== null || d.benchmarkCzk !== null))
  const userData = withData.filter((d) => d.czk !== null)
  const first = userData[0] ?? null
  const last = userData[userData.length - 1] ?? null
  const changePct =
    first && last && first.btc > 0 && last.rok !== first.rok ? ((last.btc - first.btc) / first.btc) * 100 : null

  if (!hasData) {
    return (
      <EmptyCalculator title="Příjem v bitcoinu">
        Zjistěte, kolik bitcoinů jste si mohli za čistý příjem koupit na konci každého roku.
      </EmptyCalculator>
    )
  }

  return (
    <div className="calc-page">
      <div className="page-eyebrow"><span>Alternativní aktivum</span></div>
      <h1>Příjem v bitcoinu</h1>
      <p className="lead">
        Kolik bitcoinů jste si mohli za čistý roční příjem koupit? Výpočet používá cenu BTC na konci prosince
        daného roku a průměrný roční kurz CZK/USD.
      </p>

      <p className="data-source">
        Zobrazená data: <strong>{fileName}</strong> ({formatYearCount(rows.length)}) ·{' '}
        <button type="button" className="link-btn" onClick={clear}>
          vymazat data
        </button>
        {' · '}Zdroj cen BTC:{' '}
        <a href="https://stooq.com/q/d/?s=btc.v" target="_blank" rel="noreferrer">
          Stooq
        </a>
      </p>

      <div className="stat-row">
        {first && (
          <div className="stat-card">
            <span className="stat-label">Rok {first.rok}</span>
            <strong>{btcAmountFmt.format(first.btc)} BTC</strong>
            <span className="stat-sub">cena {formatNumber(first.cenaUsd)} USD</span>
          </div>
        )}
        {last && (
          <div className="stat-card">
            <span className="stat-label">Rok {last.rok}</span>
            <strong>{btcAmountFmt.format(last.btc)} BTC</strong>
            <span className="stat-sub">cena {formatNumber(last.cenaUsd)} USD</span>
          </div>
        )}
        {changePct !== null && (
          <div className={`stat-card ${getChangeClassName(changePct)}`}>
            <span className="stat-label">Změna kupní síly v BTC</span>
            <strong>{formatNumber(changePct)} %</strong>
            <span className="stat-sub">mezi roky {first.rok} a {last.rok}</span>
          </div>
        )}
      </div>

      <section className="panel chart-panel">
        <h2>Kolik BTC jste si mohli za roční příjem koupit</h2>
        {withData.length === 0 ? (
          <p className="chart-notice">Pro zadané roky chybí kurz CZK/USD nebo cena BTC.</p>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rok" tickFormatter={(v) => String(v)} />
              <YAxis scale="log" domain={['dataMin', 'dataMax']} tickFormatter={(v) => hideAxisLabels ? "" : formatNumber(v)} width={90} label={{ value: 'BTC (log)', angle: -90, position: 'insideLeft' }} allowDataOverflow />
              <Tooltip content={<BtcTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="btc" name="BTC" stroke="#f7931a" strokeWidth={2.5} dot={{ r: 4 }} />
              {benchmarkVisible && <Line type="monotone" dataKey="benchmarkBtc" name="Benchmark BTC" stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 3" dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="panel">
        <h2>Podrobnosti</h2>
        <p className="chart-note">
          Cena BTC na konci roku v USD, pod ní přepočet do CZK a kurz ČNB. Pod příjmem v BTC je změna oproti předchozímu záznamu.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rok</th>
                <th className="num">Čistý roční příjem</th>
                <th className="num">Cena BTC</th>
                <th className="num">Příjem v BTC</th>
                {benchmarkVisible && <th className="num">Benchmark – čistý příjem</th>}
                {benchmarkVisible && <th className="num">Benchmark v BTC</th>}
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
                  const hasBtcChange = prev && !prev.na && !row.na && Number.isFinite(prev.btc) && Number.isFinite(row.btc) && prev.btc > 0
                  const btcDiff = hasBtcChange ? row.btc - prev.btc : null
                  const btcPct = hasBtcChange ? (btcDiff / prev.btc) * 100 : null
                  const hasBenchCzkChange = prev && Number.isFinite(prev.benchmarkCzk) && prev.benchmarkCzk > 0 && Number.isFinite(row.benchmarkCzk)
                  const benchCzkDiff = hasBenchCzkChange ? row.benchmarkCzk - prev.benchmarkCzk : null
                  const benchCzkPct = hasBenchCzkChange ? (benchCzkDiff / prev.benchmarkCzk) * 100 : null
                  const hasBenchBtcChange = prev && !prev.na && !row.na && Number.isFinite(prev.benchmarkBtc) && Number.isFinite(row.benchmarkBtc) && prev.benchmarkBtc > 0
                  const benchBtcDiff = hasBenchBtcChange ? row.benchmarkBtc - prev.benchmarkBtc : null
                  const benchBtcPct = hasBenchBtcChange ? (benchBtcDiff / prev.benchmarkBtc) * 100 : null
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
                        <div>{row.na ? 'N/A' : `${btcAmountFmt.format(row.btc)} BTC`}</div>
                        {hasBtcChange && (
                          <div className={`change-detail ${getChangeClassName(btcPct)}`}>
                            {btcDiff >= 0 ? '+' : '−'}{btcAmountFmt.format(Math.abs(btcDiff))} BTC ({formatSignedPercentage(btcPct)})
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
                          <div>{row.benchmarkBtc !== null ? `${btcAmountFmt.format(row.benchmarkBtc)} BTC` : 'N/A'}</div>
                          {hasBenchBtcChange && (
                            <div className={`change-detail ${getChangeClassName(benchBtcPct)}`}>
                              {benchBtcDiff >= 0 ? '+' : '−'}{btcAmountFmt.format(Math.abs(benchBtcDiff))} BTC ({formatSignedPercentage(benchBtcPct)})
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

function BtcTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>{row.rok}</strong>
      {row.czk !== null && <span>Příjem: {formatCzk(row.czk)}</span>}
      {row.benchmarkCzk !== null && <span>Benchmark: {formatCzk(row.benchmarkCzk)}</span>}
      <span>Cena BTC: {row.na ? 'N/A' : `${formatNumber(row.cenaUsd)} USD`}</span>
      {row.czk !== null && (
        <span style={{ color: '#f7931a' }}>Příjem v BTC: {row.na ? 'N/A' : btcAmountFmt.format(row.btc)}</span>
      )}
      {row.benchmarkBtc !== null && (
        <span style={{ color: '#7c3aed' }}>Benchmark v BTC: {btcAmountFmt.format(row.benchmarkBtc)}</span>
      )}
    </div>
  )
}
