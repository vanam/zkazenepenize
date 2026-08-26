import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { IncomeProvider } from './state/IncomeProvider.jsx'
import { SettingsProvider } from './state/SettingsProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <IncomeProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </IncomeProvider>
    </BrowserRouter>
  </StrictMode>,
)
