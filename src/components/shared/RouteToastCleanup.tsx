import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { dismissAllToasts } from "@/lib/ui/appFeedback";

/**
 * Q-08 — Limpia los toasts de error al cambiar de ruta.
 *
 * Los banners de "No pudimos cargar la información" quedaban colgados sobre
 * pantallas que sí habían cargado bien, haciendo creer que la nueva vista
 * estaba rota. Al navegar descartamos los toasts vivos: el error pertenece
 * a la pantalla que lo originó.
 */
export function RouteToastCleanup() {
  const { pathname } = useLocation();

  useEffect(() => {
    return () => {
      dismissAllToasts();
    };
  }, [pathname]);

  return null;
}
