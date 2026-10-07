export function AbstractBackground({ variant = 'default' }: { variant?: 'default' | 'subtle' | 'bold' }) {
  const opacity = variant === 'bold' ? '0.12' : variant === 'subtle' ? '0.04' : '0.07';

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Floating gradient blobs */}
      <div
        className="absolute -top-20 -left-10 w-72 h-72 rounded-full blur-3xl animate-drift"
        style={{ background: `radial-gradient(circle, rgba(59, 130, 246, ${opacity}) 0%, transparent 70%)` }}
      />
      <div
        className="absolute top-1/3 -right-20 w-80 h-80 rounded-full blur-3xl animate-drift"
        style={{ background: `radial-gradient(circle, rgba(236, 72, 153, ${opacity}) 0%, transparent 70%)`, animationDelay: '3s' }}
      />
      <div
        className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full blur-3xl animate-drift"
        style={{ background: `radial-gradient(circle, rgba(139, 92, 246, ${opacity}) 0%, transparent 70%)`, animationDelay: '6s' }}
      />

      {/* SVG wave decoration */}
      <svg className="absolute bottom-0 left-0 w-full h-32 opacity-[0.04] dark:opacity-[0.06]" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path d="M0,60 C300,120 900,0 1200,60 L1200,120 L0,120 Z" fill="currentColor" className="text-primary-500" />
      </svg>

      {/* Floating geometric shapes */}
      <svg className="absolute top-10 right-1/4 w-20 h-20 opacity-[0.05] dark:opacity-[0.08] animate-float-shape" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" fill="none" className="text-primary-500" />
        <circle cx="50" cy="50" r="25" stroke="currentColor" strokeWidth="2" fill="none" className="text-primary-500" />
      </svg>
      <svg className="absolute top-1/2 left-10 w-16 h-16 opacity-[0.04] dark:opacity-[0.07] animate-float-shape" style={{ animationDelay: '2s' }} viewBox="0 0 100 100">
        <polygon points="50,10 90,90 10,90" stroke="currentColor" strokeWidth="2" fill="none" className="text-pink-500" />
      </svg>
      <svg className="absolute bottom-20 right-10 w-24 h-24 opacity-[0.03] dark:opacity-[0.06] animate-float-shape" style={{ animationDelay: '4s' }} viewBox="0 0 100 100">
        <rect x="20" y="20" width="60" height="60" rx="12" stroke="currentColor" strokeWidth="2" fill="none" className="text-violet-500" transform="rotate(15 50 50)" />
      </svg>

      {/* Dot grid overlay */}
      {variant === 'bold' && (
        <div className="absolute inset-0 bg-dot-grid opacity-50" />
      )}
    </div>
  );
}
