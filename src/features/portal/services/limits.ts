// v13.56.3 — Límites defensivos en consultas del portal. Si un cliente acumula
// más de 500 embarques/facturas o 200 eventos/documentos/pagos por embarque,
// habrá que paginar; por ahora un techo evita queries sin tope desde el portal.
export const PORTAL_LIST_MAX = 500;
export const PORTAL_RELATED_MAX = 200;
