import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  /** "primary" is filled with the accent colour. "glass" is see-through. */
  variant?: 'primary' | 'glass'
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Button with a light that travels around its edge and a soft sweep on hover.
 * Colours come from the theme, so it follows whichever accent the person picks.
 * The animation stops for people who ask their system for reduced motion.
 */
export default function AnimatedButton({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: Props) {
  return (
    <button type={type} className={`abtn abtn-${variant} abtn-${size} ${className}`.trim()} {...rest}>
      <span className="abtn-label">{children}</span>
    </button>
  )
}

export { AnimatedButton }
