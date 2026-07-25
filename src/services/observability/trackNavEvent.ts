/**
 * Sidebar Etapa 3 · 3.0 — Medición de navegación.
 *
 * Analogía: es como poner un contador de pasos en las puertas del menú.
 * NUNCA bloquea la navegación (fire-and-forget + `.catch(() => {})`) y NO
 * captura datos de negocio: sólo url/título del ítem del menú, sección,
 * rol efectivo y organización (esta última la agrega el DEFAULT del BD).
 */
import { supabase } from "@/integrations/supabase/client";

export interface NavTrackEvent {
  source: "sidebar" | "buscador";
  item_url: string;
  item_title: string;
  section_label?: string | null;
  /** Rol efectivo del usuario al momento del click. */
  role?: string | null;
}

/** Rutas donde no queremos trackear (portal cliente, login, marketing, onboarding). */
const BLOCKED_PREFIXES = ["/portal", "/login", "/signup", "/onboarding", "/marketing"];

function shouldSkip(): boolean {
  if (typeof window === "undefined") return true;
  const path = window.location.pathname;
  return BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function trackNavEvent(evento: NavTrackEvent): void {
  try {
    if (shouldSkip()) return;
    // Fire-and-forget: no await, catch silencioso. Jamás propagar error.
    void supabase
      .from("nav_events")
      // SAFE-CAST: la tabla nav_events se agregó en migración 20260725190000 y
      // los tipos generados aún no la incluyen en este proyecto.
      .insert({
        source: evento.source,
        item_url: evento.item_url,
        item_title: evento.item_title,
        section_label: evento.section_label ?? null,
        role: evento.role ?? null,
      } as never)
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // ignorar — el tracking jamás debe romper la navegación
  }
}
