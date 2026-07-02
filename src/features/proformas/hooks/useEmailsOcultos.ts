/**
 * Emails "ocultos" del modal Enviar proforma, por cliente y por navegador.
 *
 * Persiste en localStorage vía el wrapper `browserStorage`. La lista de
 * ocultos se filtra desde `useDestinatariosSugeridos` para que no vuelvan
 * a aparecer como chip "Reciente" ni en el `<datalist>` de autocompletado.
 *
 * Es una preferencia de UI local — no borra registros históricos de
 * `proforma_envios` ni `contactos_cliente`.
 */
import { useCallback, useEffect, useState } from "react";
import { safeLocalStorage } from "@/lib/browserStorage";

const PREFIX = "lc:proformas:emails-ocultos:";

function keyFor(clienteId: string): string {
  return `${PREFIX}${clienteId}`;
}

function read(clienteId: string): string[] {
  const raw = safeLocalStorage.getItem(keyFor(clienteId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string").map((v) => v.toLowerCase());
  } catch {
    return [];
  }
}

function write(clienteId: string, list: string[]): void {
  const dedup = Array.from(new Set(list.map((v) => v.trim().toLowerCase()).filter(Boolean)));
  safeLocalStorage.setItem(keyFor(clienteId), JSON.stringify(dedup));
}

export interface UseEmailsOcultos {
  ocultos: string[];
  isOculto: (email: string) => boolean;
  ocultar: (email: string) => void;
  restaurar: (email: string) => void;
  restaurarTodos: () => void;
  restaurarVarios: (emails: string[]) => void;
}

export function useEmailsOcultos(clienteId: string | null | undefined): UseEmailsOcultos {
  const [ocultos, setOcultos] = useState<string[]>([]);

  useEffect(() => {
    if (!clienteId) {
      setOcultos([]);
      return;
    }
    setOcultos(read(clienteId));
  }, [clienteId]);

  const persist = useCallback(
    (updater: (prev: string[]) => string[]) => {
      setOcultos((prev) => {
        const next = Array.from(
          new Set(updater(prev).map((v) => v.trim().toLowerCase()).filter(Boolean)),
        );
        if (clienteId) write(clienteId, next);
        return next;
      });
    },
    [clienteId],
  );

  const ocultar = useCallback(
    (email: string) => {
      const e = email.trim().toLowerCase();
      if (!e || !clienteId) return;
      persist((prev) => [...prev, e]);
    },
    [clienteId, persist],
  );

  const restaurar = useCallback(
    (email: string) => {
      const e = email.trim().toLowerCase();
      persist((prev) => prev.filter((x) => x !== e));
    },
    [persist],
  );

  const restaurarVarios = useCallback(
    (emails: string[]) => {
      const set = new Set(emails.map((v) => v.trim().toLowerCase()));
      persist((prev) => prev.filter((x) => !set.has(x)));
    },
    [persist],
  );

  const restaurarTodos = useCallback(() => {
    persist(() => []);
  }, [persist]);

  const isOculto = useCallback(
    (email: string) => ocultos.includes(email.trim().toLowerCase()),
    [ocultos],
  );

  return { ocultos, isOculto, ocultar, restaurar, restaurarTodos, restaurarVarios };
}
