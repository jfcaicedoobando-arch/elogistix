/**
 * Sidebar Etapa 3 · 3.B — Recientes en GlobalSearch.
 *
 * Rastrea las últimas 8 páginas del sidebar visitadas por el usuario.
 * Sólo considera URLs que existen en el mapa aplanado del sidebar
 * (`SIDEBAR_URL_TITLE_MAP`), así detalles como `/facturacion/:id` o rutas
 * del portal jamás contaminan la lista.
 *
 * Persiste en `localStorage["nav:recent:v1"]` con parseo defensivo.
 * Se debe montar UNA sola vez a nivel `Layout`.
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { SIDEBAR_URL_TITLE_MAP } from "@/components/layout/sidebarItems";

const STORAGE_KEY = "nav:recent:v1";
const MAX_RECENTS = 8;

export interface RecentPage {
  url: string;
  title: string;
}

function readInitial(): RecentPage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: RecentPage[] = [];
    for (const it of parsed) {
      if (
        it &&
        typeof it === "object" &&
        typeof (it as RecentPage).url === "string" &&
        typeof (it as RecentPage).title === "string"
      ) {
        out.push({ url: (it as RecentPage).url, title: (it as RecentPage).title });
      }
      if (out.length >= MAX_RECENTS) break;
    }
    return out;
  } catch {
    return [];
  }
}

export interface UseRecentPagesApi {
  recents: RecentPage[];
}

export function useRecentPages(): UseRecentPagesApi {
  const location = useLocation();
  const [recents, setRecents] = useState<RecentPage[]>(readInitial);

  useEffect(() => {
    const url = location.pathname + (location.search ?? "");
    // Buscamos primero por match exacto (incluye query string, ej. /proformas?estado=aceptada)
    // y luego por pathname puro para el resto.
    const title = SIDEBAR_URL_TITLE_MAP[url] ?? SIDEBAR_URL_TITLE_MAP[location.pathname];
    if (!title) return;
    const canonicalUrl = SIDEBAR_URL_TITLE_MAP[url] ? url : location.pathname;

    setRecents((prev) => {
      const filtered = prev.filter((r) => r.url !== canonicalUrl);
      const next = [{ url: canonicalUrl, title }, ...filtered].slice(0, MAX_RECENTS);
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
      } catch {
        // ignorar
      }
      return next;
    });
  }, [location.pathname, location.search]);

  return { recents };
}
