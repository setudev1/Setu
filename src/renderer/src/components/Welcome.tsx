import AnimatedButton from '@/components/ui/animated-button'
import { useState } from 'react'
import Logo from './Logo'
import { CALL_OPTIONS, cleanInput } from '../lib/callme'

// Setu is for people aged 18 and over. Only this yes/no answer is kept, on this computer. No date of birth, no ID.
const AGE_KEY = 'setu.age18'
const UNDER_KEY = 'setu.under18'
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* storage may be unavailable */
  }
}

// Shown once, the first time Setu opens: name, then the 18+ question, then what to call you.
export default function Welcome({ onDone }: { onDone: (name: string, callMe: string) => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 'age' | 'blocked'>(() => (readFlag(UNDER_KEY) ? 'blocked' : 1))
  const [name, setName] = useState('')
  const [pick, setPick] = useState<string | null>(null) // null = nothing chosen yet
  const [other, setOther] = useState('')
  const trimmed = name.trim()

  function finish(callMe: string) {
    onDone(trimmed, callMe.trim())
  }

  function ageYes() {
    writeFlag(AGE_KEY)
    if (trimmed) setStep(3)
    else onDone('', '')
  }

  function ageNo() {
    writeFlag(UNDER_KEY)
    setStep('blocked')
  }

  return (
    <div className="modal-backdrop welcome-backdrop" style={step === 'blocked' ? { background: '#000' } : undefined}>
      <div className="modal welcome" role="dialog" aria-label="Welcome to Setu">
        <div className="welcome-body">
          <Logo size={56} />
          {step === 'blocked' ? (
            <>
              <h2>Setu is for people 18 and over</h2>
              <p className="dim">Thank you for your honesty. Please come back when you are 18. We would love to see you then.</p>
              <div className="welcome-actions">
                <button className="btn" onClick={() => window.close()}>
                  Close Setu
                </button>
              </div>
            </>
          ) : step === 'age' ? (
            <>
              <h2>One quick question</h2>
              <p className="dim">Setu is for people aged 18 and over. Are you 18 or older?</p>
              <div className="welcome-actions">
                <AnimatedButton onClick={ageYes}>Yes, I am 18 or older</AnimatedButton>
                <button className="btn" onClick={ageNo}>
                  No
                </button>
              </div>
              <p className="dim small">We only keep this yes or no on this computer. We never ask for your birth date or ID.</p>
            </>
          ) : step === 1 ? (
            <>
              <h2>Welcome to Setu</h2>
              <p className="dim">What's your name? Setu uses it to talk to you in a friendly way.</p>
              <input
                className="welcome-input"
                autoFocus
                value={name}
                maxLength={40}
                placeholder="Your name"
                aria-label="Your name"
                onChange={(e) => setName(cleanInput(e.target.value, 40))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && trimmed) setStep(readFlag(AGE_KEY) ? 3 : 'age')
                }}
              />
              <div className="welcome-actions">
                <AnimatedButton disabled={!trimmed} onClick={() => setStep(readFlag(AGE_KEY) ? 3 : 'age')}>
                  Next
                </AnimatedButton>
                <button className="btn" onClick={() => (readFlag(AGE_KEY) ? onDone('', '') : setStep('age'))}>
                  Skip
                </button>
              </div>
              <p className="dim small">Your name stays on this computer. You can change it any time in Settings.</p>
            </>
          ) : (
            <>
              <h2>Nice to meet you, {trimmed}</h2>
              <p className="dim">What should Setu call you?</p>
              <div className="swatches welcome-chips" role="group" aria-label="What should Setu call you">
                {CALL_OPTIONS.map((o) => (
                  <button
                    key={o.label}
                    className="swatch"
                    aria-pressed={pick === o.value}
                    onClick={() => setPick(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <input
                className="welcome-input"
                value={other}
                maxLength={24}
                placeholder="Or type your own, like Chief"
                aria-label="Type your own"
                onChange={(e) => {
                  setOther(cleanInput(e.target.value, 24))
                  setPick(null)
                }}
              />
              <div className="welcome-actions">
                <AnimatedButton disabled={pick === null && !other.trim()} onClick={() => finish(other.trim() || (pick ?? ''))}>
                  Done
                </AnimatedButton>
                <button className="btn" onClick={() => setStep(1)}>
                  Back
                </button>
              </div>
              <p className="dim small">Choosing "Just my name" means Setu calls you {trimmed}.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
