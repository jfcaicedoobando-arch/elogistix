/**
 * Red de seguridad de arranque.
 *
 * Si el montaje raíz de React falla ANTES del primer render (por ejemplo un
 * proveedor de contexto que lanza durante su inicialización), el `div#root`
 * queda vacío y el usuario ve una pantalla en blanco sin explicación.
 *
 * Este módulo pinta una pantalla de recuperación en es-MX con DOM plano (sin
 * React, que es justamente lo que falló) usando únicamente tokens semánticos
 * del design system.
 */

const CONTENEDOR_CLASSES =
  "min-h-screen flex items-center justify-center bg-background text-foreground p-6";
const TARJETA_CLASSES =
  "max-w-md w-full rounded-lg border border-border bg-card p-6 text-center shadow-sm";
const BOTON_CLASSES =
  "mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm " +
  "font-medium text-primary-foreground hover:opacity-90";

/** Texto técnico corto y seguro para mostrar como pista de soporte. */
function pista(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Error desconocido durante el arranque.";
}

/**
 * Pinta la pantalla de recuperación dentro del contenedor indicado.
 * Devuelve `false` si no encontró contenedor (nada que pintar).
 */
export function renderBootstrapFallback(
  error: unknown,
  contenedor: HTMLElement | null = document.getElementById("root"),
): boolean {
  if (!contenedor) return false;

  contenedor.className = CONTENEDOR_CLASSES;
  contenedor.replaceChildren();

  const tarjeta = document.createElement("div");
  tarjeta.className = TARJETA_CLASSES;

  const titulo = document.createElement("h1");
  titulo.className = "text-lg font-semibold";
  titulo.textContent = "No pudimos iniciar la aplicación";

  const detalle = document.createElement("p");
  detalle.className = "mt-2 text-sm text-muted-foreground";
  detalle.textContent =
    "Ocurrió un error al cargar. Vuelve a intentar; si continúa, avísale a soporte con el detalle de abajo.";

  const tecnico = document.createElement("p");
  tecnico.className = "mt-3 break-words text-xs text-muted-foreground";
  tecnico.textContent = pista(error);

  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = BOTON_CLASSES;
  boton.textContent = "Recargar";
  boton.addEventListener("click", () => window.location.reload());

  tarjeta.append(titulo, detalle, tecnico, boton);
  contenedor.append(tarjeta);
  return true;
}
