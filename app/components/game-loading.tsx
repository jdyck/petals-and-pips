export default function GameLoading({ error = false, onRetry }: { error?: boolean; onRetry?: () => void }) {
  return <div className="game-loading" role="status" aria-live="polite">
    <div className="game-loading-content">
      <p className="brand-name">Pips &amp; Petals</p>
      {!error && <span className="loading-spinner" aria-hidden="true" />}
      <p>{error ? "The flower background couldn’t load." : "Getting your game ready…"}</p>
      {error && <button className="header-button" type="button" onClick={onRetry}>Try again</button>}
    </div>
  </div>;
}
