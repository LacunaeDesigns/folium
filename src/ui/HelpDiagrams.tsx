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
