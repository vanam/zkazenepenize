import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'

export default function EmptyCalculator({ title, children }) {
  return (
    <div className="calc-page">
      <div className="page-eyebrow"><span>Analýza kupní síly</span></div>
      <h1>{title}</h1>
      <p className="lead">{children}</p>
      <div className="panel empty-state">
        <span className="empty-state-icon"><Icon name="database" size={26} /></span>
        <div>
          <h2>Nejdřív přidejte příjmy</h2>
          <p>Stačí jeden nebo více roků. Data zůstanou ve vašem prohlížeči a použijí se ve všech přehledech.</p>
          <Link to="/#data" className="btn btn-primary">Přidat příjmy <Icon name="arrow" size={17} /></Link>
        </div>
      </div>
    </div>
  )
}
