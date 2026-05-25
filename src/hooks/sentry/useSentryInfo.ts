/**
 * Hook que expone la configuración runtime del SDK de Sentry.
 * Extraído de `pages/dashboard/SentryDiagnostico.tsx` para mantener complejidad <15.
 */
import { useMemo } from "react";
import * as Sentry from "@sentry/react";

export interface SentryRuntimeInfo {
  active: boolean;
  dsn: string | undefined;
  release: string | undefined;
  environment: string | undefined;
  tracesSampleRate: number | undefined;
}

export function useSentryInfo(): SentryRuntimeInfo {
  return useMemo(() => {
    const client = Sentry.getClient();
    const options = client?.getOptions();
    return {
      active: Boolean(client),
      dsn: options?.dsn,
      release: options?.release,
      environment: options?.environment,
      tracesSampleRate: options?.tracesSampleRate,
    };
  }, []);
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
