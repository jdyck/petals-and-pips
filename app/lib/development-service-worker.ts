/** Remove this app's production worker when switching the same origin to Next dev. */
export async function removeDevelopmentServiceWorker(serviceWorker: ServiceWorkerContainer, origin: string, reload: () => void) {
  const registrations = await serviceWorker.getRegistrations();
  const scriptUrl = new URL("/sw.js", origin).href;
  const ownRegistrations = registrations.filter((registration) =>
    [registration.active, registration.waiting, registration.installing].some((worker) => worker?.scriptURL === scriptUrl),
  );
  const controlledByApp = serviceWorker.controller?.scriptURL === scriptUrl;
  const results = await Promise.all(ownRegistrations.map((registration) => registration.unregister()));
  if (controlledByApp && results.some(Boolean)) reload();
}
