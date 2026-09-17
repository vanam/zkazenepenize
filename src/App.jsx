import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Icon from './components/Icon.jsx'
import { calculators } from './components/calculators.js'
import { useIncome } from './state/income-context.js'
import { useSettings } from './state/settings-context.js'

const Home = lazy(() => import('./pages/Home.jsx'))
const PrijemVBitcoinu = lazy(() => import('./pages/PrijemVBitcoinu.jsx'))
const PrijemVSp500 = lazy(() => import('./pages/PrijemVSp500.jsx'))
const PrijemVCzk = lazy(() => import('./pages/PrijemVCzk.jsx'))
const PrijemVNemovitostech = lazy(() => import('./pages/PrijemVNemovitostech.jsx'))
const PrijemVMenach = lazy(() => import('./pages/PrijemVMenach.jsx'))
const PrijemVeZlate = lazy(() => import('./pages/PrijemVeZlate.jsx'))
const RealnaInflace = lazy(() => import('./pages/RealnaInflace.jsx'))

export default function App() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef(null)
  const { hideAxisLabels, showBenchmark, useRealInflation, toggleHideAxisLabels, toggleShowBenchmark, toggleUseRealInflation } = useSettings()
  const { benchmark } = useIncome()

  useEffect(() => {
    if (!settingsOpen) return
    const handleClickOutside = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [settingsOpen])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      let target = null
      if (location.hash) {
        try {
          target = document.getElementById(decodeURIComponent(location.hash.slice(1)))
        } catch {
          target = null
        }
      }
      if (target) target.scrollIntoView()
      else window.scrollTo({ top: 0, behavior: 'instant' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname, location.hash])

  return (
    <div className="app">
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="Zkažené peníze – domů">
            <span className="brand-mark" aria-hidden="true">ZP</span>
            <span>Zkažené <strong>peníze</strong></span>
          </Link>

          <nav className={menuOpen ? 'site-nav is-open' : 'site-nav'} aria-label="Hlavní navigace" onClick={() => setMenuOpen(false)}>
            <NavLink to="/" end className="home-link"><Icon name="home" size={18} /> Přehled</NavLink>
            {calculators.map((item) => (
              <NavLink key={item.to} to={item.to}>
                <Icon name={item.icon} size={18} />
                {item.short}
              </NavLink>
            ))}
          </nav>

          <div className="header-actions">
            <details ref={settingsRef} className="settings-menu" open={settingsOpen}>
              <summary
                className="icon-button"
                aria-label="Nastavení zobrazení"
                aria-expanded={settingsOpen}
                onClick={(e) => {
                  e.preventDefault()
                  setSettingsOpen((v) => !v)
                }}
              >
                <Icon name="settings" />
              </summary>
              <div className="settings-popover">
                <div className="settings-heading">
                  <strong>Nastavení grafů</strong>
                  <span>Přizpůsobte si zobrazení výsledků.</span>
                </div>
                <label className="switch-row">
                  <span><strong>Skrýt hodnoty osy Y</strong><small>Vhodné pro bezpečné sdílení snímku.</small></span>
                  <input type="checkbox" checked={hideAxisLabels} onChange={toggleHideAxisLabels} />
                </label>
                <label className="switch-row">
                  <span><strong>Zobrazit benchmark</strong><small>Porovná vaše data se srovnávací řadou.</small></span>
                  <input
                    type="checkbox"
                    checked={showBenchmark}
                    disabled={!benchmark.hasData}
                    onChange={toggleShowBenchmark}
                  />
                </label>
                <label className="switch-row">
                  <span><strong>Použít reálnou inflaci</strong><small>V Korunách počítá s vaším košem z Reálné inflace. Pro roky bez dat koše se použije oficiální inflace ČSÚ.</small></span>
                  <input
                    type="checkbox"
                    checked={useRealInflation}
                    onChange={toggleUseRealInflation}
                  />
                </label>
              </div>
            </details>
            <button
              type="button"
              className="icon-button menu-button"
              aria-label={menuOpen ? 'Zavřít navigaci' : 'Otevřít navigaci'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name={menuOpen ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
      </header>

      <main className="container main-content">
        <Suspense fallback={<div className="route-loading" role="status">Načítám přehled…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/kalkulacky/prijem-v-czk" element={<PrijemVCzk />} />
            <Route path="/kalkulacky/prijem-v-menach" element={<PrijemVMenach />} />
            <Route path="/kalkulacky/prijem-v-bitcoinu" element={<PrijemVBitcoinu />} />
            <Route path="/kalkulacky/prijem-v-sp500" element={<PrijemVSp500 />} />
            <Route path="/kalkulacky/prijem-ve-zlate" element={<PrijemVeZlate />} />
            <Route path="/kalkulacky/prijem-v-nemovitostech" element={<PrijemVNemovitostech />} />
            <Route path="/kalkulacky/realna-inflace" element={<RealnaInflace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <Link to="/" className="footer-brand"><span className="brand-mark">ZP</span> Zkažené peníze</Link>
          <p>Čísla bez iluzí. Lepší pohled na hodnotu vašeho příjmu v čase.</p>
          <div className="footer-meta">
            <span className="privacy-note"><Icon name="shield" size={17} /> Data neopustí váš prohlížeč</span>
            <a
              href="https://github.com/vanam/zkazenepenize"
              target="_blank"
              rel="noreferrer"
              className="github-link"
              aria-label="Zdrojový kód na GitHubu"
            >
              <Icon name="github" size={16} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function NotFound() {
  return (
    <section className="not-found">
      <span className="error-code">404</span>
      <h1>Tady už peníze nedohledáme.</h1>
      <p>Odkaz je neplatný nebo se stránka přesunula.</p>
      <Link to="/" className="btn btn-primary">Zpět na přehled <Icon name="arrow" size={17} /></Link>
    </section>
  )
}
