export const forbiddenBackendAccess = (): never => {
  throw new Error("Network/backend access forbidden in isolated UX workflow fixture");
};
export const supabase = new Proxy({}, { get: forbiddenBackendAccess });

export function prohibitNetwork() {
  window.fetch = forbiddenBackendAccess;
  XMLHttpRequest.prototype.open = forbiddenBackendAccess;
  window.WebSocket = new Proxy(WebSocket, { construct: forbiddenBackendAccess });
  navigator.sendBeacon = forbiddenBackendAccess;
}
