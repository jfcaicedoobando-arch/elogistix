/**
 * Copy centralizado de la landing pública. Mantener TODO el texto en español
 * mexicano y revisable desde un solo archivo.
 */
export const HERO = {
  eyebrow: "Hecho en México 🇲🇽 · Gratis para siempre",
  h1: "El sistema operativo de tu agencia de carga",
  sub: "Cotiza, embarca, factura y cobra desde un solo lugar. Libre Carga reemplaza tus hojas de Excel, tus carpetas compartidas y tu pizarrón de embarques.",
  primaryCta: "Crear cuenta gratis",
  secondaryCta: "Ver demo",
} as const;

export const PROOF =
  "Pensado para forwarders en CDMX, Manzanillo, Veracruz, Monterrey, Guadalajara, Tijuana y todo el país.";

export const KPIS = [
  { value: "−70%", label: "tiempo en cotizar" },
  { value: "100%", label: "trazabilidad de embarques" },
  { value: "0", label: "hojas de Excel" },
] as const;

export const MODULOS = [
  {
    icon: "FileText",
    title: "Cotizaciones",
    desc: "Arma cotizaciones profesionales en minutos con conceptos predefinidos, márgenes claros y PDF listo para enviar.",
    bullets: ["Multi-moneda MXN/USD", "Versiones y revisiones", "PDF con tu marca"],
  },
  {
    icon: "Ship",
    title: "Embarques",
    desc: "Marítimo (FCL/LCL), aéreo y terrestre. Timeline automático con eventos, documentos y contenedores.",
    bullets: ["7 estados de operación", "BL Master / House", "Contenedores y bultos"],
  },
  {
    icon: "Receipt",
    title: "Proformas y Facturación",
    desc: "Genera proformas, consolídalas y emite tus facturas con IVA dinámico. Compatible con tu flujo de CFDI.",
    bullets: ["IVA por concepto", "Consolidación multi-embarque", "Estatus de cobro en vivo"],
  },
  {
    icon: "Wallet",
    title: "CxC, CxP y Tesorería",
    desc: "Controla lo que te deben y lo que debes. Conciliación bancaria, flujo proyectado y reportes ejecutivos.",
    bullets: ["Pagos parciales", "Conciliación bancaria", "Flujo proyectado a 90 días"],
  },
  {
    icon: "Users",
    title: "Portal del Cliente",
    desc: "Tus clientes ven sus embarques, descargan sus facturas y revisan sus saldos sin llamarte por WhatsApp.",
    bullets: ["Tracking 24/7", "Facturas descargables", "Notificaciones en tiempo real"],
  },
  {
    icon: "Target",
    title: "CRM y Comisiones",
    desc: "Pipeline de ventas, leads, oportunidades y cálculo automático de comisiones a vendedoras.",
    bullets: ["Pipeline visual", "Actividades y tareas", "Liquidación mensual"],
  },
] as const;

export const PASOS = [
  { n: "01", title: "Cotiza", desc: "Captura la solicitud y arma la cotización con tus conceptos y márgenes. Envía el PDF en minutos." },
  { n: "02", title: "Opera", desc: "Convierte la cotización en embarque. El timeline, los documentos y los contenedores se generan solos." },
  { n: "03", title: "Cobra", desc: "Emite proforma, factura y registra el pago. Conciliación bancaria y reportes en automático." },
] as const;

export const MEXICO = [
  { title: "IVA dinámico", desc: "Tasa configurable por organización, nunca hardcoded. Tu contador lo amará." },
  { title: "Tipo de cambio diario", desc: "MXN ↔ USD ↔ EUR actualizado todos los días desde Frankfurter.app." },
  { title: "Puertos UN/LOCODE", desc: "Catálogo completo con prioridad a puertos mexicanos: MZLO, VRACR, ATM, MEX, etc." },
  { title: "Fechas DD/MM/YYYY", desc: "Formato mexicano en toda la app. Sin sorpresas para tu equipo." },
  { title: "Multi-tenant seguro", desc: "Cada agencia es un tenant aislado por organización. Tus datos nunca se mezclan." },
  { title: "Español mexicano", desc: "Interfaz, mensajes de error y documentos en es-MX. Sin traducciones raras." },
] as const;

export const PORTAL = {
  title: "Tus clientes dejan de llamarte para preguntar dónde va su contenedor",
  desc: "El Portal del Cliente les da acceso self-service a sus embarques, facturas y estado de cuenta. Tú ahorras horas de soporte; ellos confían más en tu operación.",
  bullets: [
    "Login independiente con su correo",
    "Tracking visual con timeline en vivo",
    "Descarga de facturas y proformas en PDF",
    "Estado de cuenta y saldos al día",
    "Notificaciones cuando hay novedades",
  ],
} as const;

export const SEGURIDAD = [
  { title: "Aislamiento por tenant", desc: "Row Level Security en cada tabla. Una agencia jamás ve los datos de otra." },
  { title: "Roles granulares", desc: "Admin, operador, vendedora, viewer y cliente. Cada quien ve solo lo que le toca." },
  { title: "Bitácora de actividad", desc: "Quién hizo qué y cuándo. Auditoría completa de todas las operaciones." },
  { title: "Respaldos automáticos", desc: "Tu información vive en infraestructura cloud con respaldos diarios." },
] as const;

export const PRECIO = {
  badge: "Lanzamiento en México",
  price: "Gratis",
  unit: "para siempre, sin tarjeta",
  bullets: [
    "Usuarios ilimitados",
    "Embarques, cotizaciones y facturas sin límite",
    "Portal del Cliente incluido",
    "CRM y comisiones incluidos",
    "Soporte por WhatsApp y correo",
    "Sin compromisos, cancela cuando quieras",
  ],
  note: "Apoyamos a las agencias mexicanas con acceso gratuito durante el lanzamiento. Si en el futuro lanzamos planes pagados, los usuarios actuales conservan los beneficios.",
} as const;

export const FAQ = [
  {
    q: "¿Es realmente gratis?",
    a: "Sí. Durante el lanzamiento en México, Libre Carga es gratis sin límite de usuarios ni de embarques. No pedimos tarjeta de crédito para registrarte.",
  },
  {
    q: "¿Mis datos están aislados de otras agencias?",
    a: "Sí. Cada agencia es una organización (tenant) independiente. Usamos Row Level Security a nivel base de datos, lo que significa que tus datos jamás son visibles para otra agencia.",
  },
  {
    q: "¿Puedo migrar mis embarques actuales?",
    a: "Sí. Te ayudamos a importar tu catálogo de clientes, proveedores y embarques en curso desde Excel. Escríbenos para coordinar la migración.",
  },
  {
    q: "¿Funciona en móvil?",
    a: "Sí. La interfaz es responsive y funciona en celular, tablet y computadora. El Portal del Cliente también está optimizado para móvil.",
  },
  {
    q: "¿Qué soporte ofrecen?",
    a: "Atención por WhatsApp y correo de lunes a viernes. Si tienes alguna duda durante la implementación, te acompañamos sin costo.",
  },
  {
    q: "¿Es compatible con CFDI 4.0?",
    a: "Generamos los datos fiscales necesarios para que tu PAC emita el CFDI 4.0. El flujo actual cubre proformas y captura de folios fiscales emitidos.",
  },
] as const;

export const CTA_FINAL = {
  title: "Lleva tu agencia al siguiente nivel hoy mismo",
  desc: "Sin tarjeta, sin instalaciones, sin contratos. En 2 minutos estás operando.",
};

export const FOOTER = {
  tagline: "El sistema operativo de las agencias de carga mexicanas.",
  copyright: `© ${new Date().getFullYear()} Libre Carga. Todos los derechos reservados.`,
  contact: "contacto@librecarga.com",
};
