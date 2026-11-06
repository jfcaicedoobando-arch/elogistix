const ROLES = new Set(["coordinador_logistico", "gerente_operaciones", "admin_org", "admin", "super_admin"]);

export const puedeCotizarYGuardar = (rol: string | null | undefined) => !!rol && ROLES.has(rol);

export const rutaCotizacionTarifa = (tarifaId: string, clienteId: string) =>
  `/cotizaciones/nueva?tarifa=${encodeURIComponent(tarifaId)}&cliente=${encodeURIComponent(clienteId)}`;

