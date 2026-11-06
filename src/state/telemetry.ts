import { apiRequest } from './cloudStore';

let lastSent = 0;
/** Fixed event names avoid sending save data, URLs, stack traces or entered text. */
export function reportClientEvent(category: 'runtime' | 'network', event: string) {
  if (typeof navigator === 'undefined' || !navigator.onLine || Date.now() - lastSent < 60000)
    return;
  lastSent = Date.now();
  void apiRequest('/feedback', 'POST', {
    category,
    message: `client-event:${event.slice(0, 80)}`,
  }).catch(() => {});
}
