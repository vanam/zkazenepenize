import { useState } from 'react'
import { SettingsContext } from './settings-context.js'

const STORAGE_KEY = 'zkazenepenize.settings.v1'

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const stored = JSON.parse(raw)
    return stored && typeof stored === 'object' ? stored : {}
  } catch {
    return {}
  }
}

export function SettingsProvider({ children }) {
  const [stored, setStored] = useState(loadStored)

  function update(patch) {
    const next = { ...stored, ...patch }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Keep the setting for this session when browser storage is unavailable.
    }
    setStored(next)
  }

  function toggleHideAxisLabels() {
    update({ hideAxisLabels: !stored.hideAxisLabels })
  }

  function toggleShowBenchmark() {
    update({ showBenchmark: !stored.showBenchmark })
  }

  function toggleUseRealInflation() {
    update({ useRealInflation: !stored.useRealInflation })
  }

  const value = {
    hideAxisLabels: !!stored.hideAxisLabels,
    showBenchmark: !!stored.showBenchmark,
    useRealInflation: !!stored.useRealInflation,
    toggleHideAxisLabels,
    toggleShowBenchmark,
    toggleUseRealInflation,
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
