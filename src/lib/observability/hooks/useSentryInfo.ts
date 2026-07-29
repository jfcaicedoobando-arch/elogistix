/**
 * Hook que expone la configuración runtime del SDK de Sentry.
 * Extraído de `SentryDiagnostico.tsx` para mantener complejidad <15.
 *
 * 13.331.8 — el SDK se carga con `import()` diferido desde `main.tsx`, así que
 * el cliente puede no existir todavía en el primer render. Antes leíamos el
 * estado una sola vez con `useMemo([])` y la pantalla de diagnóstico se
 * quedaba congelada en "NO está inicializado" (falso negativo). Ahora se
 * reintenta con un poll acotado hasta que aparece el cliente.
 */
import { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";

export type SentryStatus = "active" | "disabled_dev" | "missing_dsn" | "pending";

export interface SentryRuntimeInfo {
  active: boolean;
  status: SentryStatus;
  /** DSN presente en el bundle (variable de entorno de build). */
  dsnConfigured: boolean;
  dsn: string | undefined;
  release: string | undefined;
  environment: string | undefined;
  tracesSampleRate: number | undefined;
}

/** Intervalo y tope del poll: cubre la carga diferida sin girar indefinidamente. */
const POLL_MS = 300;
const MAX_ATTEMPTS = 20; // ~6 s

const DSN_CONFIGURED = Boolean(
  (import.meta.env.VITE_SENTRY_DSN as string | undefined) ?? "",
);
const IS_DEV = import.meta.env.MODE === "development";

function readSnapshot(attempt: number): SentryRuntimeInfo {
  const client = Sentry.getClient();
  const options = client?.getOptions();
  let status: SentryStatus;
  if (client) status = "active";
  else if (IS_DEV) status = "disabled_dev";
  else if (!DSN_CONFIGURED) status = "missing_dsn";
  else status = attempt >= MAX_ATTEMPTS ? "missing_dsn" : "pending";

  return {
    active: Boolean(client),
    status,
    dsnConfigured: DSN_CONFIGURED,
    dsn: options?.dsn,
    release: options?.release,
    environment: options?.environment,
    tracesSampleRate: options?.tracesSampleRate,
  };
}

export function useSentryInfo(): SentryRuntimeInfo {
  const [info, setInfo] = useState<SentryRuntimeInfo>(() => readSnapshot(0));

  useEffect(() => {
    if (info.active) return;
    let attempt = 0;
    const id = setInterval(() => {
      attempt += 1;
      const next = readSnapshot(attempt);
      setInfo(next);
      if (next.active || attempt >= MAX_ATTEMPTS) clearInterval(id);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [info.active]);

  return info;
}

export function maskDsn(dsn: string | undefined): string {
  if (!dsn) return "—";
  try {
    const url = new URL(dsn);
    const key = url.username;
    const masked = key.length > 8 ? `${key.slice(0, 4)}…${key.slice(-4)}` : "••••";
    return `${url.protocol}//${masked}@${url.host}${url.pathname}`;
  } catch {
    return "(DSN inválido)";
  }
}
