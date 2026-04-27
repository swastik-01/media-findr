// ─── Premium Custom Logo ──────────────────────────────────
const BrandLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="brandGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(187, 72%, 38%)" />
        <stop offset="100%" stopColor="hsl(200, 80%, 45%)" />
      </linearGradient>
      <linearGradient id="brandGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="hsl(200, 80%, 65%)" />
        <stop offset="100%" stopColor="hsl(187, 72%, 48%)" />
      </linearGradient>
    </defs>
    {/* Outer dynamic ring */}
    <circle cx="20" cy="20" r="18" stroke="url(#brandGrad1)" strokeWidth="3" strokeDasharray="25 15" strokeLinecap="round" className="animate-[spin_10s_linear_infinite]" />
    {/* Camera Body */}
    <rect x="8" y="12" width="24" height="18" rx="4" fill="url(#brandGrad1)" />
    {/* Flash/Accent */}
    <circle cx="30" cy="10" r="4" fill="url(#brandGrad2)" />
    {/* Search Lens */}
    <circle cx="20" cy="21" r="5" fill="white" />
    <path d="M24 25 L29 30" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export default BrandLogo;
