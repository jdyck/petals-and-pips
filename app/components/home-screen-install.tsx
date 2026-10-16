"use client";

import { useEffect, useState } from "react";

export default function HomeScreenInstall() {
  const [showInstall, setShowInstall] = useState(false);
  const [open, setOpen] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const iosNavigator = navigator as Navigator & { standalone?: boolean };
    // iPadOS Safari can report a desktop Mac user agent.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const updateInstall = () => setShowInstall(isIOS && !iosNavigator.standalone && !displayMode.matches);
    updateInstall();
    displayMode.addEventListener("change", updateInstall);

    let cancelled = false;
    if (process.env.NODE_ENV === "production" && window.isSecureContext && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
        .then(async (registration) => {
          // Wait for this installation, even if an older worker is already active.
          const worker = registration.installing || registration.waiting || registration.active;
          if (!worker) throw new Error("Offline setup did not start.");
          if (worker.state !== "activated") {
            await new Promise<void>((resolve, reject) => {
              const checkState = () => {
                if (worker.state === "activated" || worker.state === "redundant") {
                  worker.removeEventListener("statechange", checkState);
                  if (worker.state === "activated") resolve();
                  else reject(new Error("Offline setup failed."));
                }
              };
              worker.addEventListener("statechange", checkState);
              checkState();
            });
          }
          if (!cancelled) setOfflineReady(true);
        })
        .catch(() => { if (!cancelled) setOfflineUnavailable(true); });
    } else {
      setOfflineUnavailable(true);
    }
    return () => {
      cancelled = true;
      displayMode.removeEventListener("change", updateInstall);
    };
  }, []);

  if (!showInstall) return null;

  return <>
    <button className="header-button" type="button" onClick={() => setOpen(true)}>Install</button>
    {open && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close install instructions">×</button>
        <h2 id="install-title">Add to Home Screen</h2>
        <p>Open this game in Safari, then:</p>
        <ol>
          <li>Tap the <strong>Share</strong> button (the square with an upward arrow).</li>
          <li>Choose <strong>Add to Home Screen</strong> in the share menu.</li>
          <li>Tap <strong>Add</strong>, then open <strong>Petals &amp; Pips</strong> from your Home Screen.</li>
        </ol>
        <p className="rules-note" role="status">{offlineReady
          ? "Ready for offline play. Open the Home Screen app once while online to finish setting it up."
          : offlineUnavailable
            ? "Home Screen installation is available. Offline setup needs the production game opened over HTTPS with an internet connection."
            : "Preparing offline play… Keep this page open until it is ready."}</p>
        <button className="rules-done" type="button" onClick={() => setOpen(false)}>Got it</button>
      </section>
    </div>}
  </>;
}
