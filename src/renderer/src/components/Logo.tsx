// Setu means "bridge": three nested arches, like a bridge seen from the river and a doorway at once.
// Equal gaps between the arches. Colours follow the chosen accent.
export default function Logo({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="76 100 360 330" fill="none" aria-label="Setu logo">
      <defs>
        <linearGradient id="setu-o" x1="96" y1="400" x2="416" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--blue)" />
        </linearGradient>
        <linearGradient id="setu-m" x1="176" y1="370" x2="336" y2="190" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent)" stopOpacity="0.75" />
          <stop offset="1" stopColor="var(--blue)" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="setu-hl" x1="0" y1="110" x2="0" y2="230" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M96 372V272A160 160 0 0 1 416 272V372H360V272A104 104 0 0 0 152 272V372Z" fill="url(#setu-o)" />
      <path d="M96 372V272A160 160 0 0 1 416 272V372H360V272A104 104 0 0 0 152 272V372Z" fill="url(#setu-hl)" />
      <path d="M176 372V272A80 80 0 0 1 336 272V372H296V272A40 40 0 0 0 216 272V372Z" fill="url(#setu-m)" />
      <path d="M240 372V272A16 16 0 0 1 272 272V372Z" fill="#fff" />
      <path d="M96 408H416" stroke="#fff" strokeOpacity="0.2" strokeWidth="10" strokeLinecap="round" />
    </svg>
  )
}
