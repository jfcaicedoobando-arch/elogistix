/**
 * Redirect helper que preserva `?query=...` al saltar de una ruta legacy
 * a la nueva. Usado por los redirects de `/cxp/*` y `/proveedores` → `/compras/*`.
 */
import { Navigate, useLocation } from "react-router-dom";

interface Props {
  to: string;
}

export function RedirectPreserveSearch({ to }: Props) {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: to, search, hash }} replace />;
}
