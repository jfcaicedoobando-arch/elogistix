/**
 * `/costeo/solicitudes` ahora vive como pestaña dentro de `/costeo/tarifas`.
 * Redirige preservando el querystring (id, estado, p) para que los enlaces
 * de notificaciones sigan abriendo la solicitud correspondiente.
 */
import { Navigate, useLocation } from "react-router";

export default function SolicitudesPricing() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set("tab", "bandeja");
  return <Navigate to={`/costeo/tarifas?${params.toString()}`} replace />;
}
