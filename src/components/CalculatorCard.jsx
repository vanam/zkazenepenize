import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'

export default function CalculatorCard({ calculator, hasData }) {
  const ready = calculator.alwaysReady || hasData
  return (
    <Link to={calculator.to} className={`calc-card accent-${calculator.accent}`}>
      <span className="calc-card-icon"><Icon name={calculator.icon} size={22} /></span>
      <span className="calc-card-status">
        <span className={ready ? 'status-dot ready' : 'status-dot'} />
        {ready ? 'Připraveno' : 'Čeká na data'}
      </span>
      <h3>{calculator.title}</h3>
      <p>{calculator.description}</p>
      <span className="card-link">Prozkoumat <Icon name="arrow" size={17} /></span>
    </Link>
  )
}
