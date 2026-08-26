import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import btcCsv from '../data/btc_v_y.csv?raw'
import xauCsv from '../data/xauusd_y.csv?raw'
import spyCsv from '../data/spy_us_y.csv?raw'
import cen0402Csv from '../data/CEN0402-transformed.csv?raw'
import { useSettings } from '../state/settings-context.js'
import {
  formatNumber,
  formatSignedPercentage,
  getChangeClassName,
  parseYearlyCsv,
} from '../lib/utils.js'
import {
  DEFAULT_REAL_INFLATION_WEIGHTS,
  REAL_INFLATION_WEIGHTS_KEY,
  clampRealInflationWeight,
  loadRealInflationWeights,
  parseRealEstateNationalFlats,
  yearlyChanges,
} from '../lib/real-inflation.js'

const ASSETS = [
  { key: 'btc', name: 'Bitcoin', short: 'BTC', color: '#f7931a', source: 'Stooq – BTC.V, cena na konci roku v USD' },
  { key: 'gold', name: 'Zlato', short: 'XAU', color: '#ca8a04', source: 'Stooq – XAUUSD, cena na konci roku v USD/oz' },
  { key: 'sp500', name: 'S&P 500', short: 'SPY', color: '#16a34a', source: 'Stooq – SPY.US, cena fondu na konci roku v USD' },
  { key: 'realEstate', name: 'Nemovitosti', short: 'm²', color: '#0e7490', source: 'ČSÚ CEN0402 – byty, Česko, průměrná kupní cena za m²' },
]

const SCALE_STORAGE_KEY = 'zkazenepenize.real-inflation-scale.v1'
const INFLATION_COLOR = '#b94828'

// Symmetric log transform (base 10): linear near zero, logarithmic for large
// |values|. Handles negative and zero changes, unlike a plain log scale.
function symlog(value) {
  return Math.sign(value) * Math.log10(1 + Math.abs(value))
}

function invSymlog(transformed) {
  return Math.sign(transformed) * (10 ** Math.abs(transformed) - 1)
}

const SYMLOG_TICKS = [-10000, -5000, -2500, -1000, -500, -250, -100, -50, -25, -10, -5, 0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]

function loadStoredScale() {
  try {
    return localStorage.getItem(SCALE_STORAGE_KEY) !== 'linear'
  } catch {
    return true
  }
}

export default function RealnaInflace() {
  const { hideAxisLabels } = useSettings()
  const [weights, setWeights] = useState(loadRealInflationWeights)
  const [symlogScale, setSymlogScale] = useState(loadStoredScale)

  useEffect(() => {
    try {
      localStorage.setItem(REAL_INFLATION_WEIGHTS_KEY, JSON.stringify(weights))
    } catch {
      // Keep weights for this session when storage is unavailable.
    }
  }, [weights])

  useEffect(() => {
    try {
      localStorage.setItem(SCALE_STORAGE_KEY, symlogScale ? 'symlog' : 'linear')
    } catch {
      // Keep scale for this session when storage is unavailable.
    }
  }, [symlogScale])

  const btcPrices = useMemo(() => parseYearlyCsv(btcCsv), [])
  const goldPrices = useMemo(() => parseYearlyCsv(xauCsv), [])
  const sp500Prices = useMemo(() => parseYearlyCsv(spyCsv), [])
  const realEstatePrices = useMemo(() => parseRealEstateNationalFlats(cen0402Csv), [])

  const changesByAsset = useMemo(
    () => ({
      btc: yearlyChanges(btcPrices),
      gold: yearlyChanges(goldPrices),
      sp500: yearlyChanges(sp500Prices),
      realEstate: yearlyChanges(realEstatePrices),
    }),
    [btcPrices, goldPrices, sp500Prices, realEstatePrices],
  )

  const totalWeight = ASSETS.reduce((sum, asset) => sum + weights[asset.key], 0)

  const chartData = useMemo(() => {
    const years = new Set()
    for (const changes of Object.values(changesByAsset)) {
      for (const year of changes.keys()) years.add(year)
    }
    return [...years].sort((a, b) => a - b).map((year) => {
      const row = { rok: year }
      let weightedSum = 0
      let activeWeight = 0
      for (const asset of ASSETS) {
        const change = changesByAsset[asset.key].get(year) ?? null
        row[asset.key] = change === null ? null : Math.round(change * 100) / 100
        const weight = weights[asset.key]
        if (change !== null && weight > 0) {
          weightedSum += change * weight
          activeWeight += weight
        }
      }
      row.inflace = activeWeight > 0 ? Math.round((weightedSum / activeWeight) * 100) / 100 : null
      row.activeWeight = activeWeight
      return row
    })
  }, [changesByAsset, weights])

  const visibleKeys = useMemo(
    () => [...ASSETS.filter((asset) => weights[asset.key] > 0).map((asset) => asset.key), 'inflace'],
    [weights],
  )

  const plotData = useMemo(
    () =>
      chartData.map((row) => {
        const plotted = { ...row }
        for (const asset of ASSETS) {
          plotted[`${asset.key}T`] = row[asset.key] === null ? null : symlog(row[asset.key])
        }
        plotted.inflaceT = row.inflace === null ? null : symlog(row.inflace)
        return plotted
      }),
    [chartData],
  )

  const symlogAxis = useMemo(() => {
    let min = Infinity
    let max = -Infinity
    for (const row of chartData) {
      for (const key of visibleKeys) {
        const value = row[key]
        if (value === null || !Number.isFinite(value)) continue
        if (value < min) min = value
        if (value > max) max = value
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = -100
      max = 100
    }
    const snapMin = [...SYMLOG_TICKS].reverse().find((tick) => tick <= min) ?? SYMLOG_TICKS[0]
    const snapMax = SYMLOG_TICKS.find((tick) => tick >= max) ?? SYMLOG_TICKS.at(-1)
    const ticks = SYMLOG_TICKS.filter((tick) => tick >= snapMin && tick <= snapMax)
    return {
      ticks: ticks.map(symlog),
      formatTick: (t) => `${formatNumber(Math.round(invSymlog(t) * 100) / 100)} %`,
      domain: [symlog(snapMin) - 0.08, symlog(snapMax) + 0.08],
    }
  }, [chartData, visibleKeys])
  const withInflation = chartData.filter((row) => row.inflace !== null)
  const last = withInflation.at(-1) ?? null
  const fullCoverage = chartData.filter((row) => ASSETS.every((asset) => row[asset.key] !== null))
  const fullAvg =
    fullCoverage.length > 0
      ? fullCoverage.reduce((sum, row) => sum + row.inflace, 0) / fullCoverage.length
      : null
  const cumulative =
    fullCoverage.length > 0
      ? fullCoverage.reduce((factor, row) => factor * (1 + row.inflace / 100), 1) - 1
      : null

  const setWeight = (key) => (e) => {
    const value = clampRealInflationWeight(Number(e.target.value))
    setWeights((prev) => ({ ...prev, [key]: value }))
  }

  const applyPreset = (preset) => setWeights(preset)

  return (
    <div className="calc-page">
      <div className="page-eyebrow"><span>Vlastní koš aktiv</span></div>
      <h1>Reálná inflace</h1>
      <p className="lead">
        Poskládejte si vlastní inflaci z růstu cen bitcoinu, zlata, akciového indexu S&amp;P 500 a nemovitostí.
        Graf ukazuje meziroční změnu ceny každého aktiva a vážený průměr – vaši reálnou inflaci.
      </p>

      <p className="data-source">
        Zdroje dat: Stooq (BTC.V, XAUUSD, SPY.US – cena na konci roku) · ČSÚ CEN0402
        (byty v Česku, průměrná kupní cena za m²). Změna = meziroční rozdíl ceny v&nbsp;%.
      </p>

      <section className="panel filter-panel">
        <h2>Váhy aktiv</h2>
        <p className="chart-note">
          Každému aktivu nastavte váhu 0–100 %. Aktiva s váhou 0 % se do výpočtu nepočítají.
          Reálná inflace je vážený průměr dostupných aktiv pro daný rok. Volbou „Použít reálnou
          inflaci“ v Nastavení grafů se tento koš použije i v kalkulačce Příjem v korunách.
        </p>
        <div className="weights-grid">
          {ASSETS.map((asset) => {
            const share = totalWeight > 0 ? (weights[asset.key] / totalWeight) * 100 : 0
            return (
              <div key={asset.key} className="weight-card">
                <div className="weight-head">
                  <span className="weight-dot" style={{ background: asset.color }} aria-hidden="true" />
                  <strong>{asset.name}</strong>
                  <span className="weight-value">{weights[asset.key]} %</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={weights[asset.key]}
                  onChange={setWeight(asset.key)}
                  aria-label={`Váha aktiva ${asset.name} v procentech`}
                />
                <div className="weight-foot">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className="field-input weight-input"
                    value={weights[asset.key]}
                    onChange={setWeight(asset.key)}
                    aria-label={`Váha aktiva ${asset.name} – číslo`}
                  />
                  <span>podíl v koši: {formatNumber(share)} %</span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset({ btc: 25, gold: 25, sp500: 25, realEstate: 25 })}>
            Rovnoměrně
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset({ btc: 0, gold: 50, sp500: 0, realEstate: 50 })}>
            Konzervativní koš
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset({ btc: 0, gold: 0, sp500: 50, realEstate: 50 })}>
            Akcie + bydlení
          </button>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => applyPreset(DEFAULT_REAL_INFLATION_WEIGHTS)}>
            Obnovit výchozí
          </button>
        </div>
        {totalWeight === 0 && (
          <p className="share-error" role="alert" style={{ marginTop: 12 }}>
            Všechny váhy jsou nulové – nastavte alespoň jednomu aktivu váhu nad 0 %.
          </p>
        )}
      </section>

      <div className="stat-row">
        {last && (
          <div className={`stat-card ${getChangeClassName(last.inflace)}`}>
            <span className="stat-label">Reálná inflace {last.rok}</span>
            <strong>{formatSignedPercentage(last.inflace)}</strong>
            <span className="stat-sub">vážený průměr dostupných aktiv</span>
          </div>
        )}
        {fullAvg !== null && (
          <div className="stat-card">
            <span className="stat-label">Průměrná roční inflace</span>
            <strong>{formatSignedPercentage(fullAvg)}</strong>
            <span className="stat-sub">
              {fullCoverage[0].rok}–{fullCoverage.at(-1).rok}, roky s daty všech aktiv
            </span>
          </div>
        )}
        {cumulative !== null && (
          <div className="stat-card">
            <span className="stat-label">Kumulativně od roku {fullCoverage[0].rok}</span>
            <strong>{formatSignedPercentage(cumulative * 100)}</strong>
            <span className="stat-sub">složený růst váženého koše</span>
          </div>
        )}
      </div>

      <section className="panel chart-panel">
        <h2>Meziroční změny cen a reálná inflace</h2>
        <div className="mode-tabs" role="group" aria-label="Měřítko osy Y">
          <button
            type="button"
            aria-pressed={symlogScale}
            className={symlogScale ? 'mode-tab active' : 'mode-tab'}
            onClick={() => setSymlogScale(true)}
          >
            Symlog škála
          </button>
          <button
            type="button"
            aria-pressed={!symlogScale}
            className={!symlogScale ? 'mode-tab active' : 'mode-tab'}
            onClick={() => setSymlogScale(false)}
          >
            Lineární
          </button>
        </div>
        {chartData.length === 0 ? (
          <p className="chart-notice">Pro zvolená data nejsou k dispozici žádné meziroční změny.</p>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={symlogScale ? plotData : chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rok" tickFormatter={(v) => String(v)} />
              {symlogScale ? (
                <YAxis
                  ticks={symlogAxis.ticks}
                  domain={symlogAxis.domain}
                  tickFormatter={(v) => (hideAxisLabels ? '' : symlogAxis.formatTick(v))}
                  width={90}
                  label={{ value: 'změna v % (symlog)', angle: -90, position: 'insideLeft' }}
                />
              ) : (
                <YAxis
                  tickFormatter={(v) => (hideAxisLabels ? '' : `${formatNumber(v)} %`)}
                  width={90}
                  label={{ value: 'meziroční změna v %', angle: -90, position: 'insideLeft' }}
                />
              )}
              <Tooltip content={<InflationTooltip />} />
              <Legend />
              <ReferenceLine y={0} stroke="#9aa5a0" strokeDasharray="3 3" />
              {ASSETS.map((asset) => (
                <Line
                  key={asset.key}
                  type="monotone"
                  dataKey={symlogScale ? `${asset.key}T` : asset.key}
                  name={asset.name}
                  stroke={asset.color}
                  strokeWidth={1.8}
                  dot={false}
                  connectNulls
                  hide={weights[asset.key] === 0}
                />
              ))}
              <Line
                type="monotone"
                dataKey={symlogScale ? 'inflaceT' : 'inflace'}
                name="Reálná inflace"
                stroke={INFLATION_COLOR}
                strokeWidth={3}
                dot={{ r: 4 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        <p className="chart-note">
          {symlogScale
            ? 'Osa Y používá symetrickou logaritmickou (symlog) škálu: v okolí nuly je lineární, extrémní výkyvy bitcoinu tlumí logaritmicky, takže jsou čitelné i malé změny ostatních aktiv. '
            : 'Osa Y je lineární – extrémní výkyvy bitcoinu zplošťují ostatní řady; pro čitelnost přepněte na symlog škálu. '}
          S&amp;P 500 (fond SPY) má data od roku 2005, takže jeho meziroční změny začínají rokem 2006. V letech bez dat jednotlivých aktiv se vážený průměr počítá jen z dostupných aktiv.
        </p>
      </section>

      <section className="panel">
        <h2>Podrobnosti</h2>
        <p className="chart-note">
          Meziroční změna ceny každého aktiva v % a výsledná reálná inflace jako vážený průměr
          aktiv s nenulovou váhou a dostupnými daty.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rok</th>
                {ASSETS.map((asset) => (
                  <th key={asset.key} className="num">{asset.name} ({weights[asset.key]} %)</th>
                ))}
                <th className="num">Reálná inflace</th>
              </tr>
            </thead>
            <tbody>
              {[...chartData].reverse().map((row) => (
                <tr key={row.rok}>
                  <td>{row.rok}</td>
                  {ASSETS.map((asset) => (
                    <td key={asset.key} className="num">
                      {row[asset.key] === null ? (
                        <span className="change-detail">N/A</span>
                      ) : (
                        <span className={getChangeClassName(row[asset.key])}>
                          {formatSignedPercentage(row[asset.key])}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="num strong">
                    {row.inflace === null ? (
                      <span className="change-detail">N/A</span>
                    ) : (
                      <span className={getChangeClassName(row.inflace)}>
                        {formatSignedPercentage(row.inflace)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function InflationTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>Rok {row.rok}</strong>
      {ASSETS.map((asset) => (
        <span key={asset.key} style={{ color: asset.color }}>
          {asset.name}: {row[asset.key] === null ? 'N/A' : formatSignedPercentage(row[asset.key])}
        </span>
      ))}
      <span style={{ color: INFLATION_COLOR }}>
        <strong>Reálná inflace: {row.inflace === null ? 'N/A' : formatSignedPercentage(row.inflace)}</strong>
      </span>
    </div>
  )
}
