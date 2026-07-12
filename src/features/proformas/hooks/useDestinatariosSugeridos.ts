/**
 * Memoria de destinatarios por cliente para el modal "Enviar proforma".
 *
 * Fuentes combinadas (dedup case-insensitive):
 *  - `proforma_envios.destinatarios` y `.cc` de las últimas 20 proformas del cliente.
 *  - `contactos_cliente.email` (no borrados) del cliente.
 *
 * También expone el `ultimo` envío para prefill inicial de "Para" y "CC".
 */
import { useQuery } from "@tanstack/react-query";
import {
import { queryKeys } from "@/lib/query";
  fetchEnviosDestinatariosPorCliente,
  fetchContactosEmailPorCliente,
} from "@/features/proformas/services";


const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface DestinatarioEntry {
  email?: unknown;
}

/** Extrae emails de un valor `jsonb` que puede ser `[{email}]` o `["email"]`. */
function extraerEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      out.push(item);
    } else if (item && typeof item === "object") {
      const email = (item as DestinatarioEntry).email;
      if (typeof email === "string") out.push(email);
    }
  }
  return out;
}

function normalizar(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const e = raw.trim().toLowerCase();
    if (!e || !EMAIL_RX.test(e) || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

export interface DestinatariosSugeridos {
  sugerencias: string[];
  ultimo: { to: string[]; cc: string[] } | null;
}

async function fetchSugerencias(clienteId: string): Promise<DestinatariosSugeridos> {
  const [envios, contactos] = await Promise.all([
    fetchEnviosDestinatariosPorCliente(clienteId),
    fetchContactosEmailPorCliente(clienteId),
  ]);



  const acumulado: string[] = [];
  for (const env of envios) {
    acumulado.push(...extraerEmails(env.destinatarios));
    acumulado.push(...extraerEmails(env.cc));
  }
  for (const c of contactos) {
    if (c.email) acumulado.push(c.email);
  }
  const sugerencias = normalizar(acumulado);

  const ultimoEnvio = envios[0];
  const ultimo = ultimoEnvio
    ? {
        to: normalizar(extraerEmails(ultimoEnvio.destinatarios)),
        cc: normalizar(extraerEmails(ultimoEnvio.cc)),
      }
    : null;

  return { sugerencias, ultimo };
}

export function useDestinatariosSugeridos(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.proformas.destinatariosSugeridos(clienteId),
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: () => fetchSugerencias(clienteId!),
  });
}
