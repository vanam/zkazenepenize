import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyCalculator from '../components/EmptyCalculator.jsx'
import inflationCsv from '../data/CEN0101H-transformed.csv?raw'
import btcCsv from '../data/btc_v_y.csv?raw'
import xauCsv from '../data/xauusd_y.csv?raw'
import spyCsv from '../data/spy_us_y.csv?raw'
import cen0402Csv from '../data/CEN0402-transformed.csv?raw'
import { useIncome } from '../state/income-context.js'
import { useSettings } from '../state/settings-context.js'
import { formatCzk, formatNumber, formatSignedPercentage, formatYearCount, getChangeClassName, mergeIncomeYears, parseInflationCsv } from '../lib/utils.js'
import { computeRealInflationByYear, loadRealInflationWeights } from '../lib/real-inflation.js'

const compactFmt = new Intl.NumberFormat('cs-CZ', { notation: 'compact', maximumFractionDigits: 1 })
const inflationDecimalFmt = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 3 })

const fmtRate = (v) => (Number.isFinite(v) ? `${formatNumber(v)} %` : '—')

export default function PrijemVCzk() {
  const { rows, hasData, fileName, clear, benchmark } = useIncome()
  const { hideAxisLabels, showBenchmark, useRealInflation } = useSettings()
  const inflation = useMemo(() => parseInflationCsv(inflationCsv), [])
  const inflationByYear = useMemo(
    () => Object.fromEntries(inflation.map((r) => [r.year, r.rate])),
    [inflation],
  )
  const benchmarkVisible = showBenchmark && benchmark.hasData
  const comparisonRows = useMemo(
    () => mergeIncomeYears(rows, benchmarkVisible ? benchmark.rows : []),
    [rows, benchmark.rows, benchmarkVisible],
  )

  const baseYear = rows.length > 0 ? rows[0].year : null
  const lastComparisonYear = comparisonRows.length > 0 ? comparisonRows[comparisonRows.length - 1].year : null

  // Fresh weights on every render so changes made on the RealnaInflace
  // page apply as soon as the user navigates here.
  const realWeights = loadRealInflationWeights()
  const realInflationSources = useMemo(
    () => ({
      btcCsv,
      xauCsv,
      sp500Csv: spyCsv,
      realEstateCsv: cen0402Csv,
    }),
    [],
  )
  const realInflationByYear = useMemo(
    () => computeRealInflationByYear(realInflationSources, realWeights),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [realInflationSources, realWeights.btc, realWeights.gold, realWeights.sp500, realWeights.realEstate],
  )

  // Effective yearly rate: real basket when enabled and available,
  // otherwise the official ČSÚ rate.
  const effectiveByYear = useMemo(() => {
    const map = new Map()
    if (baseYear === null || lastComparisonYear === null) return map
    for (let year = baseYear; year <= lastComparisonYear; year += 1) {
      if (useRealInflation) {
        const real = realInflationByYear.get(year)
        if (Number.isFinite(real)) {
          map.set(year, { rate: real, source: 'real' })
          continue
        }
      }
      const official = inflationByYear[year]
      if (Number.isFinite(official)) map.set(year, { rate: official, source: 'official' })
    }
    return map
  }, [baseYear, lastComparisonYear, inflationByYear, realInflationByYear, useRealInflation])

  const realData = useMemo(() => {
    if (comparisonRows.length === 0 || baseYear === null) return []
    const factorByYear = {}
    const sourceByYear = {}
    let factor = 1
    for (let year = baseYear; year <= lastComparisonYear; year += 1) {
      if (year > baseYear) {
        const effective = effectiveByYear.get(year)
        if (!effective) break
        factor *= 1 + effective.rate / 100
        sourceByYear[year] = effective.source
      }
      factorByYear[year] = factor
    }
    return comparisonRows.map((row) => {
      const f = factorByYear[row.year]
      const benchmarkCzk = row.benchmarkCzk
      const effective = effectiveByYear.get(row.year)
      return {
        rok: row.year,
        czk: row.incomeCzk,
        real: Number.isFinite(f) && row.incomeCzk !== null ? row.incomeCzk / f : null,
        benchmarkCzk,
        benchmarkReal: Number.isFinite(f) && benchmarkCzk !== null ? benchmarkCzk / f : null,
        cumInflPct: Number.isFinite(f) ? (f - 1) * 100 : null,
        yearlyInflPct: effective?.rate ?? null,
        yearlyInflSource: row.year === baseYear ? null : effective?.source ?? null,
      }
    })
  }, [comparisonRows, baseYear, lastComparisonYear, effectiveByYear])
  const realDataByYear = useMemo(
    () => Object.fromEntries(realData.map((row) => [row.rok, row])),
    [realData],
  )

  if (!hasData) {
    return (
      <EmptyCalculator title="Příjem v korunách">
        Zjistěte, jak se měnil váš čistý roční příjem a co z něj po započtení inflace skutečně zbylo.
      </EmptyCalculator>
    )
  }

  const first = rows[0]
  const last = rows[rows.length - 1]
  const changePct =
    first && last && first.incomeCzk && last.year !== first.year
      ? ((last.incomeCzk - first.incomeCzk) / first.incomeCzk) * 100
      : null

  let realFirst = null
  let realLast = null
  for (let i = 0; i < realData.length; i += 1) {
    if (realData[i].czk !== null && realData[i].real !== null && realFirst === null) realFirst = realData[i]
    if (realData[i].czk !== null && realData[i].real !== null) realLast = realData[i]
  }
  const realChangePct =
    realFirst && realLast && realFirst.real > 0 && realLast.rok !== realFirst.rok
      ? ((realLast.real - realFirst.real) / realFirst.real) * 100
      : null

  const lastRealRow = last ? realDataByYear[last.year] ?? null : null
  const cumRatesForLast = []
  if (lastRealRow && Number.isFinite(lastRealRow.cumInflPct)) {
    for (let y = baseYear + 1; y <= lastRealRow.rok; y += 1) {
      const r = effectiveByYear.get(y)?.rate
      if (!Number.isFinite(r)) break
      cumRatesForLast.push(r)
    }
  }
  const fallbackYears = useRealInflation
    ? realData.filter((row) => row.rok > baseYear && row.yearlyInflSource === 'official').map((row) => row.rok)
    : []
  const formulaRates =
    cumRatesForLast.length <= 4
      ? cumRatesForLast
      : [cumRatesForLast[0], cumRatesForLast[1], null, cumRatesForLast.at(-1)]
  const cumulativeFormula = formulaRates
    .map((rate) => rate === null ? '…' : `(1 + ${inflationDecimalFmt.format(rate / 100)})`)
    .join(' × ')
  const benchmarkPreviousByYear = new Map(
    benchmark.rows.map((row, index) => [row.year, benchmark.rows[index - 1]?.incomeCzk ?? null]),
  )

  return (
    <div className="calc-page">
      <div className="page-eyebrow"><span>Inflace a kupní síla</span></div>
      <h1>Příjem v korunách</h1>
      <p className="lead">
        Porovnejte růst čistého příjmu s inflací a odhalte jeho hodnotu v cenách prvního roku.
      </p>

      <p className="data-source">
        Zobrazená data: <strong>{fileName}</strong> ({formatYearCount(rows.length)}) ·{' '}
        <button type="button" className="link-btn" onClick={clear}>
          vymazat data
        </button>
        {' · '}Zdroj inflace:{' '}
        {useRealInflation ? (
          <>
            váš koš <Link to="/kalkulacky/realna-inflace">Reálná inflace</Link>
            {''} (pro roky bez dat koše ČSÚ – CEN0101H)
          </>
        ) : (
          <a href="https://data.csu.gov.cz/datastat/info/SADA/CEN0101H" target="_blank" rel="noreferrer">
            ČSÚ – CEN0101H
          </a>
        )}
      </p>

      <div className="stat-row">
        <div className="stat-card">
          <span className="stat-label">Rok {first.year}</span>
          <strong>{formatCzk(first.incomeCzk)}</strong>
          <span className="stat-sub">nejstarší rok v datech</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Rok {last.year}</span>
          <strong>{formatCzk(last.incomeCzk)}</strong>
          <span className="stat-sub">nejnovější rok v datech</span>
        </div>
        {changePct !== null && (
          <div className={`stat-card ${getChangeClassName(changePct)}`}>
            <span className="stat-label">Změna příjmu</span>
            <strong>{formatSignedPercentage(changePct)}</strong>
            <span className="stat-sub">mezi roky {first.year} a {last.year}</span>
          </div>
        )}
        {realChangePct !== null && (
          <div className={`stat-card ${getChangeClassName(realChangePct)}`}>
            <span className="stat-label">Změna kupní síly</span>
            <strong>{formatSignedPercentage(realChangePct)}</strong>
            <span className="stat-sub">v cenách roku {baseYear}, mezi {first.year} a {last.year}</span>
          </div>
        )}
      </div>

      <section className="panel chart-panel">
        <h2>Příjem upravený o kumulativní inflaci</h2>
        <p className="chart-note">
          {useRealInflation ? (
            <>
              Nominální příjem přepočtený na ceny roku {baseYear} podle vaší reálné inflace
              (Bitcoin, zlato, S&amp;P 500, nemovitosti).
              {fallbackYears.length > 0 && (
                <> Pro {fallbackYears.length === 1 ? 'rok' : 'roky'} bez dat koše{' '}
                ({fallbackYears.join(', ')}) se používá oficiální inflace ČSÚ.</>
              )}
            </>
          ) : (
            <>Nominální příjem přepočtený podle průměrné roční míry inflace (ČSÚ) na ceny roku {baseYear}.</>
          )}
        </p>
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={realData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="rok" tickFormatter={(v) => String(v)} />
            <YAxis tickFormatter={(v) => hideAxisLabels ? "" : compactFmt.format(v)} width={90} label={{ value: 'CZK', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={<RealTooltip useRealInflation={useRealInflation} />} cursor={{ stroke: '#b45309', strokeWidth: 1, strokeOpacity: 0.4 }} />
            <Legend />
            <Line type="monotone" dataKey="real" name="Příjem upravený o inflaci" stroke="#b45309" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="czk" name="Nominální příjem" stroke="#9ca3af" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} />
            {benchmarkVisible && (
              <>
                <Line type="monotone" dataKey="benchmarkReal" name="Benchmark upravený o inflaci" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="benchmarkCzk" name="Nominální benchmark" stroke="#a855f7" strokeWidth={2} strokeDasharray="6 3" dot={false} />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="panel">
        <h2>Podrobnosti</h2>
        <p className="chart-note">
          Srovnání nominálního příjmu s jeho hodnotou v cenách roku {baseYear}. Pod nominálními hodnotami je
          změna oproti předchozímu záznamu, u přepočteného příjmu roční a kumulativní{' '}
          {useRealInflation ? 'reálná inflace (kde chybí data koše, oficiální inflace ČSÚ)' : 'inflace podle ČSÚ'}.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rok</th>
                <th className="num">Nominální příjem</th>
                <th className="num">Příjem upravený o inflaci</th>
                {benchmarkVisible && <th className="num">Nominální benchmark</th>}
                {benchmarkVisible && <th className="num">Benchmark upravený o inflaci</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const prev = rows[i - 1]
                const realRow = realDataByYear[row.year]
                const realValue = realRow?.real ?? null
                const cumInflPct = realRow?.cumInflPct ?? null
                const yearlyInflPct = realRow?.yearlyInflPct ?? null
                const yearlyInflSource = realRow?.yearlyInflSource ?? null
                const yearlyLabel = useRealInflation && yearlyInflSource === 'real'
                  ? 'roční reálná inflace'
                  : 'roční inflace'
                const yearlySuffix = useRealInflation && yearlyInflSource === 'official' ? ' (ČSÚ)' : ''
                if (!prev) {
                  return (
                    <tr key={row.year}>
                      <td>{row.year}</td>
                      <NominalIncomeCell value={row.incomeCzk} previousValue={null} strong />
                      <td className="num">
                        <div>{realValue !== null ? formatCzk(realValue) : '—'}</div>
                        <div className="change-detail">
                          kumulativní <span className="change-neutral">{formatSignedPercentage(cumInflPct)}</span>
                        </div>
                      </td>
                      {benchmarkVisible && (
                        <NominalIncomeCell
                          value={realRow?.benchmarkCzk}
                          previousValue={benchmarkPreviousByYear.get(row.year)}
                        />
                      )}
                      {benchmarkVisible && <td className="num">{realRow?.benchmarkReal != null ? formatCzk(realRow.benchmarkReal) : 'N/A'}</td>}
                    </tr>
                  )
                }
                return (
                  <tr key={row.year}>
                    <td>{row.year}</td>
                    <NominalIncomeCell value={row.incomeCzk} previousValue={prev.incomeCzk} strong />
                    <td className="num">
                      <div>{realValue !== null ? formatCzk(realValue) : '—'}</div>
                      <div className="change-detail">
                        {yearlyLabel} <span className="change-neutral">{fmtRate(yearlyInflPct)}</span>{yearlySuffix}
                        {' · '}kumulativní <span className="change-neutral">{formatSignedPercentage(cumInflPct)}</span>
                      </div>
                    </td>
                    {benchmarkVisible && (
                      <NominalIncomeCell
                        value={realRow?.benchmarkCzk}
                        previousValue={benchmarkPreviousByYear.get(row.year)}
                      />
                    )}
                    {benchmarkVisible && <td className="num">{realRow?.benchmarkReal != null ? formatCzk(realRow.benchmarkReal) : 'N/A'}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {cumRatesForLast.length > 0 && lastRealRow && (
          <p className="chart-note">
            Roční inflace se násobí, nesčítá. Pro rok {lastRealRow.rok}:{' '}
            <strong>{cumulativeFormula}</strong> − 1 ={' '}
            <strong className="change-neutral">{formatSignedPercentage(lastRealRow.cumInflPct)}</strong>
          </p>
        )}
      </section>
    </div>
  )
}

function NominalIncomeCell({ value, previousValue, strong = false }) {
  if (value == null) return <td className="num">N/A</td>

  const hasChange = Number.isFinite(previousValue) && previousValue > 0
  const difference = hasChange ? value - previousValue : null
  const percentage = hasChange ? (difference / previousValue) * 100 : null

  return (
    <td className={strong ? 'num strong' : 'num'}>
      <div>{formatCzk(value)}</div>
      {hasChange && (
        <div className={`change-detail ${getChangeClassName(percentage)}`}>
          {difference >= 0 ? '+' : '−'}{formatCzk(Math.abs(difference))} ({formatSignedPercentage(percentage)})
        </div>
      )}
    </td>
  )
}

function RealTooltip({ active, payload, useRealInflation }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const yearlyLabel = useRealInflation && row.yearlyInflSource === 'real'
    ? 'Roční reálná inflace'
    : 'Roční míra inflace'
  const yearlySuffix = useRealInflation && row.yearlyInflSource === 'official' ? ' (ČSÚ)' : ''
  return (
    <div className="chart-tooltip">
      <strong>{row.rok}</strong>
      {row.czk !== null && <span>Nominální příjem: {formatCzk(row.czk)}</span>}
      {row.benchmarkCzk !== null && <span>Benchmark nominální: {formatCzk(row.benchmarkCzk)}</span>}
      <span style={{ color: '#b45309' }}>
        Příjem upravený o inflaci: {row.real !== null ? formatCzk(row.real) : '—'}
      </span>
      {row.benchmarkReal !== null && (
        <span style={{ color: '#7c3aed' }}>Benchmark upravený o inflaci: {formatCzk(row.benchmarkReal)}</span>
      )}
      <span>{yearlyLabel}{yearlySuffix}: <b className="change-neutral">{fmtRate(row.yearlyInflPct)}</b></span>
      <span>Kumulativní inflace: <b className="change-neutral">{formatSignedPercentage(row.cumInflPct)}</b></span>
    </div>
  )
}
