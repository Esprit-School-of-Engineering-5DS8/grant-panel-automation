export type Decision = 'FUND' | 'RESERVE' | 'REJECT'

const OPTIONS: { value: Decision; label: string; icon: string }[] = [
  { value: 'FUND', label: 'Fund', icon: 'check_circle' },
  { value: 'RESERVE', label: 'Reserve', icon: 'hourglass_top' },
  { value: 'REJECT', label: 'Reject', icon: 'cancel' },
]

export interface DecisionSelectProps {
  value: Decision
  onChange: (decision: Decision) => void
  className?: string
}

export function DecisionSelect({ value, onChange, className }: DecisionSelectProps) {
  return (
    <div className={`decision-select ${className || ''}`} role="radiogroup" aria-label="Committee recommendation">
      {OPTIONS.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`decision-option tone-${option.value.toLowerCase()} ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          <span className="material-symbols-outlined">{option.icon}</span>
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default DecisionSelect
