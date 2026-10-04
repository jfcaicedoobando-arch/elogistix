/** Un solo reloj compartido: cambia al iniciar el día de negocio en CDMX. */
import { useSyncExternalStore } from "react";
import { todayLocalISO, todayLocalISOPlus } from "@/lib/date/today";
import { mxLocalToUtcIso } from "@/lib/date/mx";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function programarCambio() {
  clearTimeout(timer);
  const ahora = new Date();
  const manana = mxLocalToUtcIso(`${todayLocalISOPlus(1, ahora)}T00:00:00`);
  const espera = manana ? new Date(manana).getTime() - ahora.getTime() : 60_000;
  timer = setTimeout(actualizarDia, Math.max(1, espera));
}

function actualizarDia() {
  for (const listener of listeners) listener();
  if (listeners.size > 0) programarCambio();
}

function suscribir(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    programarCambio();
    // Las pestañas suspendidas pueden demorar timers; comprobar al regresar.
    window.addEventListener("focus", actualizarDia);
    document.addEventListener("visibilitychange", actualizarDia);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearTimeout(timer);
      window.removeEventListener("focus", actualizarDia);
      document.removeEventListener("visibilitychange", actualizarDia);
    }
  };
}

export function useDiaNegocio(): string {
  return useSyncExternalStore(suscribir, todayLocalISO, todayLocalISO);
}
