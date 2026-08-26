import { useEffect, useRef, useState } from 'react'
import averageWageCsv from '../data/MZDQ1T5-transform.csv?raw'
import CalculatorCard from '../components/CalculatorCard.jsx'
import Icon from '../components/Icon.jsx'
import { calculators } from '../components/calculators.js'
import inflationCsv from '../data/CEN0101H-transformed.csv?raw'
import { useIncome } from '../state/income-context.js'
import {
  YEAR_MIN,
  YEAR_MAX,
  buildAverageWageIncome,
  buildIncomeCsv,
  encodeUrlData,
  formatNumber,
  formatYearCount,
  getInflationCardClassName,
  parseAverageWageCsv,
  parseInflationCsv,
  parseNumberCs,
} from '../lib/utils.js'

const AVERAGE_WAGE_ROWS = parseAverageWageCsv(averageWageCsv)
const INFLATION_ROWS = parseInflationCsv(inflationCsv)
const INFLATION_START_YEAR = INFLATION_ROWS[0]?.year
const INFLATION_END_YEAR = INFLATION_ROWS.at(-1)?.year
const CUMULATIVE_INFLATION = INFLATION_ROWS
  .slice(1)
  .reduce((factor, row) => factor * (1 + row.rate / 100), 1)
const COUNTY_OPTIONS = [...new Set(AVERAGE_WAGE_ROWS.map((row) => row.county).filter(Boolean))].sort((a, b) =>
  a.localeCompare(b, 'cs'),
)
const INCOME_MULTIPLIERS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]

function emptyRow() {
  return { year: '', incomeCzk: '' }
}

function rowsToDraft(rows) {
  if (rows.length === 0) return [emptyRow(), emptyRow()]
  return rows.map((r) => ({ year: String(r.year), incomeCzk: String(r.incomeCzk) }))
}

function formatStoredDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'long' }).format(date)
}

function validateDraft(draft) {
  const errors = []
  const seenYears = new Set()
  const rows = []
  draft.forEach((row, i) => {
    if (String(row.year).trim() === '' && String(row.incomeCzk).trim() === '') return
    const label = `Řádek ${i + 1}`
    const yearRaw = String(row.year).trim()
    const incomeRaw = String(row.incomeCzk).trim()
    if (!/^\d{4}$/.test(yearRaw) || Number(yearRaw) < YEAR_MIN || Number(yearRaw) > YEAR_MAX) {
      errors.push(`${label}: rok musí být mezi ${YEAR_MIN} a ${YEAR_MAX}.`)
      return
    }
    const incomeCzk = parseNumberCs(incomeRaw)
    if (!incomeRaw || !Number.isFinite(incomeCzk) || incomeCzk <= 0) {
      errors.push(`${label}: příjem v CZK musí být kladné číslo.`)
      return
    }
    const year = Number(yearRaw)
    if (seenYears.has(year)) {
      errors.push(`${label}: rok ${year} je zadaný vícekrát.`)
      return
    }
    seenYears.add(year)
    rows.push({ year, incomeCzk })
  })
  if (rows.length === 0 && errors.length === 0) {
    errors.push('Zadejte alespoň jeden rok s příjmem.')
  }
  return { rows, errors }
}

export default function Home() {
  const { fileName, uploadedAt, rows, hasData, errors, warnings, upload, saveRows, clear, benchmark } = useIncome()
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const [mode, setMode] = useState('file')
  const [draft, setDraft] = useState(() => rowsToDraft(rows))
  const [formErrors, setFormErrors] = useState([])
  const [shareOpen, setShareOpen] = useState(false)
  const [shareIncome, setShareIncome] = useState(true)
  const [shareBenchmark, setShareBenchmark] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [averageWageCounty, setAverageWageCounty] = useState('')
  const [averageWageMultiplier, setAverageWageMultiplier] = useState(1)

  const dataSignature = hasData ? rows.map((r) => `${r.year}:${r.incomeCzk}`).join('|') : ''
  const benchmarkSignature = benchmark.hasData
    ? benchmark.rows.map((row) => `${row.year}:${row.incomeCzk}`).join('|')
    : ''

  useEffect(() => {
    setDraft(rows.length > 0 ? rowsToDraft(rows) : [emptyRow(), emptyRow()])
    setFormErrors([])
    setShareCopied(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSignature])

  useEffect(() => {
    setShareCopied(false)
  }, [benchmarkSignature])

  async function handleFile(file) {
    await upload(file)
  }

  function handleInputChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    handleFile(file)
  }

  function updateDraft(index, field, value) {
    setDraft((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  function addRow() {
    setDraft((prev) => [...prev, emptyRow()])
  }

  function removeRow(index) {
    setDraft((prev) => prev.filter((_, i) => i !== index))
  }

  function handleFormSave(e) {
    e?.preventDefault?.()
    const result = validateDraft(draft)
    if (result.errors.length > 0) {
      setFormErrors(result.errors)
      return
    }
    saveRows(result.rows)
    setFormErrors([])
  }

  function handleAverageWageImport(e) {
    e.preventDefault()
    const importedRows = buildAverageWageIncome(AVERAGE_WAGE_ROWS, averageWageCounty, averageWageMultiplier)
    const sourceName = averageWageCounty || 'Česká republika'
    saveRows(importedRows, `Průměrná mzda ČSÚ – ${sourceName}`)
  }

  function handleExport() {
    const text = buildIncomeCsv(rows)
    const blob = new Blob([`\uFEFF${text}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName && /\.csv$/i.test(fileName) ? fileName : 'prijem.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function openShare() {
    setShareIncome(hasData)
    setShareBenchmark(benchmark.hasData)
    setShareCopied(false)
    setShareOpen(true)
  }

  const canShareIncome = shareIncome && hasData
  const canShareBenchmark = shareBenchmark && benchmark.hasData
  const shareUrl = (() => {
    if (!canShareIncome && !canShareBenchmark) return ''
    const url = new URL(window.location.origin + window.location.pathname)
    if (canShareIncome) url.searchParams.set('data', encodeUrlData(buildIncomeCsv(rows)))
    if (canShareBenchmark) {
      url.searchParams.set('benchmark', encodeUrlData(buildIncomeCsv(benchmark.rows)))
    }
    return url.toString()
  })()

  async function handleShare() {
    if (!shareUrl) return
    setShareCopied(false)
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
    } catch {
      setShareCopied(false)
    }
  }

  const dateStr = formatStoredDate(uploadedAt)

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> Kalkulačka kupní síly</p>
          <h1>Výplata roste.<br /><em>Ale bohatnete?</em></h1>
          <p className="lead">
            Koruny samy o sobě neřeknou celý příběh. Porovnejte svůj čistý příjem s inflací, bydlením,
            zlatem nebo investicemi a zjistěte, jak se jeho skutečná hodnota měnila.
          </p>
          <div className="hero-actions">
            <a href="#data" className="btn btn-primary">
              {hasData ? 'Upravit má data' : 'Spočítat kupní sílu'} <Icon name="arrow" size={18} />
            </a>
            <a href="#calculators" className="text-link">Prohlédnout kalkulačky</a>
          </div>
          <div className="trust-row">
            <span><Icon name="shield" size={18} /> Bez registrace</span>
            <span><Icon name="database" size={18} /> Data zůstávají v zařízení</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="visual-card">
            <div className="visual-card-head">
              <span>Kumulativní inflace</span>
              <span className="visual-range">{INFLATION_START_YEAR}—{INFLATION_END_YEAR}</span>
            </div>
            <div className={`visual-value ${getInflationCardClassName(CUMULATIVE_INFLATION - 1)}`}>
              <strong>+{formatNumber((CUMULATIVE_INFLATION - 1) * 100)} %</strong>
              <span className="trend-chip">↗ cenová hladina</span>
            </div>
            <svg className="hero-chart" viewBox="0 0 560 220" preserveAspectRatio="none">
              <defs>
                <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#bc4a28" stopOpacity=".28" />
                  <stop offset="1" stopColor="#bc4a28" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="grid-line" d="M0 50H560M0 105H560M0 160H560" />
              <path className="area-path" d="M0 180 C55 174 72 155 110 160 S170 129 210 138 S270 96 320 112 S374 72 420 78 S485 34 560 24 V220 H0Z" />
              <path className="value-path" d="M0 180 C55 174 72 155 110 160 S170 129 210 138 S270 96 320 112 S374 72 420 78 S485 34 560 24" />
              <path className="comparison-path" d="M0 180 C80 162 120 168 170 151 S260 150 310 133 S420 126 560 112" />
              <circle cx="560" cy="24" r="6" />
            </svg>
            <div className="visual-legend"><span><i className="legend-main" /> Nominální příjem </span><span><i /> Příjem upravený o inflaci</span></div>
          </div>
          <div className="floating-note"><Icon name="sparkles" size={18} /><span>Jedna data.<strong>{calculators.length} pohledů.</strong></span></div>
        </div>
      </section>

      <section className="panel data-panel" id="data">
        <div className="section-heading data-heading">
          <div>
            <span className="section-kicker">Krok 1</span>
            <h2>Přidejte svůj čistý roční příjem</h2>
          </div>
          <span className="privacy-pill"><Icon name="shield" size={16} /> Pouze ve vašem prohlížeči</span>
        </div>
        <p className="data-hint">
          Vyberte nejrychlejší způsob. Můžete nahrát CSV, použít odhad podle průměrné mzdy ČSÚ nebo zadat
          jednotlivé roky ručně.
        </p>

        {hasData && (
          <div className="file-status">
            <span className="file-meta">
              <strong>{fileName}</strong> · {formatYearCount(rows.length)} ({rows[0].year}–{rows[rows.length - 1].year})
              {dateStr ? ` · nahráno ${dateStr}` : ''}
            </span>
            <div className="status-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={handleExport}>
                Stáhnout CSV
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={openShare}>
                Sdílet odkaz
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode('form')}>
                Upravit data
              </button>
              <button type="button" className="btn btn-quiet btn-sm" onClick={clear}>
                Vymazat data
              </button>
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="alert alert-error" role="alert">
            <ul>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mode-tabs">
          <button
            type="button"
            aria-pressed={mode === 'file'}
            className={mode === 'file' ? 'mode-tab active' : 'mode-tab'}
            onClick={() => setMode('file')}
          >
            <Icon name="upload" size={17} /> Nahrát CSV
          </button>
          <button
            type="button"
            aria-pressed={mode === 'average-wage'}
            className={mode === 'average-wage' ? 'mode-tab active' : 'mode-tab'}
            onClick={() => setMode('average-wage')}
          >
            <Icon name="sparkles" size={17} /> Odhad podle ČSÚ
          </button>
          <button
            type="button"
            aria-pressed={mode === 'form'}
            className={mode === 'form' ? 'mode-tab active' : 'mode-tab'}
            onClick={() => setMode('form')}
          >
            <Icon name="pen" size={17} /> {hasData ? 'Upravit ručně' : 'Zadat ručně'}
          </button>
        </div>

        {mode === 'file' ? (
          <>
            <label className={dragOver ? 'dropzone dropzone-active' : 'dropzone'}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={handleInputChange}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  handleFile(e.dataTransfer.files?.[0])
                }}
              />
              <span className="dropzone-file" aria-hidden="true"><Icon name="upload" size={24} /></span>
              <span className="dropzone-copy">
                <span className="dropzone-text">Přetáhněte CSV sem nebo <u>vyberte soubor</u></span>
                <span className="dropzone-hint">Rok a čistý roční příjem v CZK · čárka nebo středník</span>
              </span>
            </label>

            {errors.length > 0 && (
              <div className="alert alert-error" role="alert">
                <strong>Soubor nebyl uložen:</strong>
                {hasData && <span> původní data zůstávají zachována.</span>}
                <ul>
                  {errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <details className="format-hint">
              <summary>Očekávaný formát souboru</summary>
              <pre>{`rok,prijem
2019,350000
2020,400000
2021,420000`}</pre>
              <p>Oddělovačem může být čárka nebo středník.</p>
            </details>
          </>
        ) : mode === 'average-wage' ? (
          <form className="average-wage-form" onSubmit={handleAverageWageImport}>
            <p className="data-hint">
              Import vychází z průměrné hrubé měsíční mzdy ČSÚ. Pro ukončené roky používá 4. čtvrtletí,
              pro aktuální rok nejnovější dostupné čtvrtletí. Čistý roční příjem odhaduje jako hrubou
              měsíční mzdu × 75 % × 12 × zvolený násobek.
            </p>
            <div className="filters average-wage-filters">
              <label className="filter-field">
                <span>Kraj</span>
                <select value={averageWageCounty} onChange={(e) => setAverageWageCounty(e.target.value)}>
                  <option value="">Celá Česká republika</option>
                  {COUNTY_OPTIONS.map((county) => (
                    <option key={county} value={county}>
                      {county}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-field">
                <span>Násobek průměrné mzdy</span>
                <select
                  value={averageWageMultiplier}
                  onChange={(e) => setAverageWageMultiplier(Number(e.target.value))}
                >
                  {INCOME_MULTIPLIERS.map((multiplier) => (
                    <option key={multiplier} value={multiplier}>
                      {multiplier}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Importovat příjmy
              </button>
            </div>
          </form>
        ) : (
          <form className="income-form" onSubmit={handleFormSave}>
            <div className="table-wrap">
              <table className="income-table">
                <thead>
                  <tr>
                    <th scope="col" className="col-year">Rok</th>
                    <th scope="col">Čistý roční příjem (CZK)</th>
                    <th scope="col" className="col-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {draft.map((row, i) => (
                    <tr key={i}>
                      <td className="col-year">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={YEAR_MIN}
                          max={YEAR_MAX}
                          placeholder="2021"
                          className="field-input"
                          value={row.year}
                          onChange={(e) => updateDraft(i, 'year', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="např. 350 000"
                          className="field-input"
                          value={row.incomeCzk}
                          onChange={(e) => updateDraft(i, 'incomeCzk', e.target.value)}
                        />
                      </td>
                      <td className="col-actions">
                        <button type="button" className="link-danger" onClick={() => removeRow(i)}>
                          Odebrat
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Uložit data
              </button>
              <button type="button" className="btn btn-secondary" onClick={addRow}>
                + Přidat rok
              </button>
            </div>

            {formErrors.length > 0 && (
              <div className="alert alert-error" role="alert">
                <strong>Data nebyla uložena:</strong>
                <ul>
                  {formErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </form>
        )}
      </section>

      {shareOpen && (
        <section className="share-box unified-share" aria-labelledby="share-heading">
          <div className="share-heading">
            <div>
              <h2 id="share-heading">Sdílet odkaz</h2>
              <p className="share-label">
                Vybraná data jsou zakódovaná přímo v adrese a nikam se neodesílají.
              </p>
            </div>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShareOpen(false)}>
              Zavřít
            </button>
          </div>
          <div className="share-options">
            <label>
              <input
                type="checkbox"
                checked={shareIncome}
                disabled={!hasData}
                onChange={(e) => {
                  setShareIncome(e.target.checked)
                  setShareCopied(false)
                }}
              />
              Moje příjmy
            </label>
            <label>
              <input
                type="checkbox"
                checked={shareBenchmark}
                disabled={!benchmark.hasData}
                onChange={(e) => {
                  setShareBenchmark(e.target.checked)
                  setShareCopied(false)
                }}
              />
              Benchmark
            </label>
          </div>
          {!shareUrl && <p className="share-error" role="alert">Vyberte alespoň jednu datovou řadu.</p>}
          <div className="share-row">
            <input
              className="field-input share-input"
              readOnly
              value={shareUrl}
              aria-label="Odkaz ke sdílení"
              onFocus={(e) => e.target.select()}
            />
            <button type="button" className="btn btn-primary btn-sm" disabled={!shareUrl} onClick={handleShare}>
              {shareCopied ? 'Zkopírováno' : 'Zkopírovat odkaz'}
            </button>
          </div>
        </section>
      )}

      <details className="benchmark-disclosure">
        <summary>
          <span><Icon name="chart" size={20} /><span><strong>Přidat srovnávací benchmark</strong><small>Volitelné · porovnejte příjem s další datovou řadou</small></span></span>
          <span className="summary-action">{benchmark.hasData ? 'Nastaveno' : 'Nastavit'} <Icon name="arrow" size={17} /></span>
        </summary>
        <BenchmarkPanel benchmark={benchmark} onShare={openShare} />
      </details>

      <section className="calculators" id="calculators">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Krok 2</span>
            <h2>Podívejte se na příjem jinak</h2>
          </div>
          <p>Každý pohled používá stejná data, ale odhaluje jinou část příběhu.</p>
        </div>
        <div className="card-grid">
          {calculators.map((calculator) => (
            <CalculatorCard key={calculator.to} calculator={calculator} hasData={hasData} />
          ))}
        </div>
      </section>
    </div>
  )
}

function BenchmarkPanel({ benchmark, onShare }) {
  const { fileName, uploadedAt, rows, hasData, errors, warnings, upload, saveRows, clear } = benchmark
  const [mode, setMode] = useState('file')
  const [draft, setDraft] = useState(() => rowsToDraft(rows))
  const [formErrors, setFormErrors] = useState([])
  const [county, setCounty] = useState('')
  const [multiplier, setMultiplier] = useState(1)
  const dataSignature = hasData ? rows.map((row) => `${row.year}:${row.incomeCzk}`).join('|') : ''

  useEffect(() => {
    setDraft(rows.length > 0 ? rowsToDraft(rows) : [emptyRow(), emptyRow()])
    setFormErrors([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSignature])

  function updateDraft(index, field, value) {
    setDraft((previous) => previous.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  function handleManualSave(e) {
    e.preventDefault()
    const result = validateDraft(draft)
    if (result.errors.length > 0) {
      setFormErrors(result.errors)
      return
    }
    saveRows(result.rows, 'Benchmark – ruční zadání')
    setFormErrors([])
  }

  function handleAverageWageImport(e) {
    e.preventDefault()
    const importedRows = buildAverageWageIncome(AVERAGE_WAGE_ROWS, county, multiplier)
    saveRows(importedRows, `Benchmark ČSÚ – ${county || 'Česká republika'}`)
  }

  const dateStr = formatStoredDate(uploadedAt)

  return (
    <section className="panel data-panel benchmark-panel">
      <h2>Benchmark</h2>
      <p className="data-hint">
        Přidejte srovnávací čistý roční příjem. Benchmark se uloží pouze v tomto prohlížeči a po zapnutí
        volby „Zobrazit benchmark“ se ukáže vedle vašich dat v grafech a tabulkách.
      </p>

      {hasData && (
        <div className="file-status">
          <span className="file-meta">
            <strong>{fileName}</strong> · {formatYearCount(rows.length)} ({rows[0].year}–{rows[rows.length - 1].year})
            {dateStr ? ` · nahráno ${dateStr}` : ''}
          </span>
          <div className="status-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onShare}>
              Sdílet odkaz
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setMode('form')}>
              Upravit benchmark
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={clear}>
              Vymazat benchmark
            </button>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="alert alert-error" role="alert">
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mode-tabs">
        <button
          type="button"
          aria-pressed={mode === 'file'}
          className={mode === 'file' ? 'mode-tab active' : 'mode-tab'}
          onClick={() => setMode('file')}
        >
          Nahrát soubor
        </button>
        <button
          type="button"
          aria-pressed={mode === 'average-wage'}
          className={mode === 'average-wage' ? 'mode-tab active' : 'mode-tab'}
          onClick={() => setMode('average-wage')}
        >
          Průměrná mzda ČSÚ
        </button>
        <button
          type="button"
          aria-pressed={mode === 'form'}
          className={mode === 'form' ? 'mode-tab active' : 'mode-tab'}
          onClick={() => setMode('form')}
        >
          {hasData ? 'Upravit data' : 'Ruční zadání'}
        </button>
      </div>

      {mode === 'file' ? (
        <>
          <label className="dropzone">
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                upload(file)
              }}
            />
            <span className="dropzone-file" aria-hidden="true">CSV</span>
            <span className="dropzone-text">Klikněte pro výběr CSV souboru s benchmarkem</span>
            <span className="dropzone-hint">
              Sloupce: year ({YEAR_MIN}–{YEAR_MAX}) a čistý roční příjem v CZK.
            </span>
          </label>
          {errors.length > 0 && (
            <div className="alert alert-error" role="alert">
              <strong>Benchmark nebyl uložen:</strong>
              {hasData && <span> původní benchmark zůstává zachován.</span>}
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : mode === 'average-wage' ? (
        <form className="average-wage-form" onSubmit={handleAverageWageImport}>
          <p className="data-hint">
            Čistý roční benchmark = průměrná hrubá měsíční mzda × 75 % × 12 × zvolený násobek.
            Pro ukončené roky se použije 4. čtvrtletí, pro aktuální rok nejnovější dostupné čtvrtletí.
          </p>
          <div className="filters average-wage-filters">
            <label className="filter-field">
              <span>Kraj</span>
              <select value={county} onChange={(e) => setCounty(e.target.value)}>
                <option value="">Celá Česká republika</option>
                {COUNTY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span>Násobek průměrné mzdy</span>
              <select value={multiplier} onChange={(e) => setMultiplier(Number(e.target.value))}>
                {INCOME_MULTIPLIERS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Importovat benchmark</button>
          </div>
        </form>
      ) : (
        <form className="income-form" onSubmit={handleManualSave}>
          <div className="table-wrap">
            <table className="income-table">
              <thead>
                <tr>
                  <th scope="col" className="col-year">Rok</th>
                  <th scope="col">Čistý roční příjem benchmarku (CZK)</th>
                  <th scope="col" className="col-actions"></th>
                </tr>
              </thead>
              <tbody>
                {draft.map((row, index) => (
                  <tr key={index}>
                    <td className="col-year">
                      <input
                        type="number"
                        min={YEAR_MIN}
                        max={YEAR_MAX}
                        className="field-input"
                        value={row.year}
                        onChange={(e) => updateDraft(index, 'year', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="field-input"
                        value={row.incomeCzk}
                        onChange={(e) => updateDraft(index, 'incomeCzk', e.target.value)}
                      />
                    </td>
                    <td className="col-actions">
                      <button
                        type="button"
                        className="link-danger"
                        onClick={() => setDraft((previous) => previous.filter((_, i) => i !== index))}
                      >
                        Odebrat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Uložit benchmark</button>
            <button type="button" className="btn btn-secondary" onClick={() => setDraft((previous) => [...previous, emptyRow()])}>
              + Přidat rok
            </button>
          </div>
          {formErrors.length > 0 && (
            <div className="alert alert-error" role="alert">
              <strong>Benchmark nebyl uložen:</strong>
              <ul>
                {formErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </form>
      )}
    </section>
  )
}
