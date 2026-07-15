import React from 'react'

interface FlowStep {
  label: string
  color?: string
}

/** Small left-to-right flow illustration: colored boxes joined by arrows. Used for
 *  Help-panel topics that are fundamentally "A happens, then B, then C." */
export function FlowDiagram({ steps }: { steps: FlowStep[] }) {
  return (
    <div className="help-flow-diagram">
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          {i > 0 && <span className="help-flow-arrow">→</span>}
          <div className="help-flow-step" style={step.color ? { background: step.color } : undefined}>
            {step.label}
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

/** Two small cards joined by a connecting line, illustrating Lines & connections. */
export function LinesDiagram() {
  return (
    <svg className="help-lines-diagram" viewBox="0 0 220 80" width="220" height="80">
      <rect x="8" y="24" width="60" height="32" rx="6" fill="var(--card-green)" />
      <rect x="152" y="24" width="60" height="32" rx="6" fill="var(--card-blue)" />
      <line x1="68" y1="40" x2="152" y2="40" stroke="var(--accent)" strokeWidth="2" />
      <circle cx="68" cy="40" r="3" fill="var(--accent)" />
      <circle cx="152" cy="40" r="3" fill="var(--accent)" />
    </svg>
  )
}
