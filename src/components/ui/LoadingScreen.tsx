export function FullPageSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );
}

export function SplashScreen() {
  return (
    <div className="min-h-screen bg-vibrant-mesh flex items-center justify-center">
      <img
        src="/images/loading-logo.png"
        alt="Loading"
        className="w-20 h-20 object-contain animate-pulse-glow"
        loading="eager"
      />
    </div>
  );
}
