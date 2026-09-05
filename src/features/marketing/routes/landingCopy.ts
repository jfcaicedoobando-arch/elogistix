/**
 * Copy centralizado de la landing pública. Mantener TODO el texto en español
 * mexicano y revisable desde un solo archivo.
 */
export const HERO = {
  eyebrow: "Hecho en México · Gratis para siempre",
  h1: "El sistema operativo de tu agencia de carga",
  sub: "Cotiza, embarca, factura y cobra desde un solo lugar. Libre Carga reemplaza tus hojas de Excel, tus carpetas compartidas y tu pizarrón de embarques.",
  primaryCta: "Crear cuenta gratis",
  secondaryCta: "Ver demo en 60 segundos",
} as const;


// Prueba social honesta: reencuadramos "logos" como navieras que rastreamos
// (no partners) y estándares regulatorios/técnicos que sí cumplimos.
export const PROOF_TITLE = "Rastreamos embarques de las principales navieras y cumplimos con los estándares mexicanos";
export const PROOF_NAVIERAS = [
  "Maersk", "MSC", "Hapag-Lloyd", "CMA CGM", "ONE", "COSCO", "Evergreen", "APM Terminals",
] as const;
export const PROOF_ESTANDARES = [
  "SAT · CFDI 4.0", "UN/LOCODE", "Banxico DOF", "Facturapi",
] as const;
export const PROOF_DISCLAIMER = "Libre Carga no es partner oficial de ninguna naviera. Sólo rastreamos sus embarques.";

export const MODULOS = [
  {
    icon: "Ship",
    title: "Embarques",
    desc: "Marítimo (FCL/LCL), aéreo y terrestre. Timeline automático con eventos, documentos, contenedores y bultos. BL Master / House.",
    bullets: ["7 estados de operación", "BL Master / House", "Contenedores y bultos"],
    featured: true,
  },
  {
    icon: "Users",
    title: "Portal del Cliente",
    desc: "Tus clientes ven sus embarques, descargan facturas y revisan sus saldos sin llamarte por WhatsApp. Tracking 24/7.",
    bullets: ["Tracking 24/7", "Facturas descargables", "Notificaciones en vivo"],
    featured: true,
  },
  {
    icon: "FileText",
    title: "Cotizaciones",
    desc: "Cotizaciones profesionales en minutos con conceptos predefinidos y PDF listo para enviar.",
    bullets: [],
    featured: false,
  },
  {
    icon: "Receipt",
    title: "Proformas y CFDI",
    desc: "Genera proformas, consolida embarques y emite con IVA dinámico.",
    bullets: [],
    featured: false,
  },
  {
    icon: "Wallet",
    title: "CxC, CxP y Tesorería",
    desc: "Conciliación bancaria, flujo proyectado y reportes ejecutivos.",
    bullets: [],
    featured: false,
  },
  {
    icon: "Target",
    title: "CRM y Comisiones",
    desc: "Pipeline de ventas y cálculo automático de comisiones a vendedoras.",
    bullets: [],
    featured: false,
  },
] as const;

export const PASOS = [
  { n: "01", title: "Cotiza", desc: "Captura la solicitud y arma la cotización con tus conceptos y márgenes. Envía el PDF en minutos." },
  { n: "02", title: "Opera", desc: "Convierte la cotización en embarque. El timeline, los documentos y los contenedores se generan solos." },
  { n: "03", title: "Cobra", desc: "Emite proforma, factura y registra el pago. Conciliación bancaria y reportes en automático." },
] as const;

export const MEXICO = [
  { icon: "Percent", title: "IVA dinámico", desc: "Tasa configurable por organización, nunca hardcoded. Tu contador lo amará." },
  { icon: "TrendingUp", title: "Tipo de cambio DOF", desc: "USD/MXN (SF43718) y EUR/MXN (SF46410) publicados por Banxico. La fuente legal para CFDI (Art. 20 CFF)." },
  { icon: "Anchor", title: "Puertos UN/LOCODE", desc: "Catálogo con prioridad a puertos mexicanos: MZLO, VRACR, ATM, MEX, etc." },
  { icon: "Calendar", title: "Fechas DD/MM/YYYY", desc: "Formato mexicano en toda la app. Sin sorpresas para tu equipo." },
  { icon: "Lock", title: "Multi-tenant seguro", desc: "Cada agencia es un tenant aislado por organización. Tus datos nunca se mezclan." },
  { icon: "Languages", title: "Español mexicano", desc: "Interfaz, mensajes de error y documentos en es-MX. Sin traducciones raras." },
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
  { title: "Cada agencia, aislada", desc: "Tus datos viven separados a nivel base de datos. Otra agencia jamás puede verlos." },
  { title: "Cada quien ve lo suyo", desc: "Permisos por perfil: dirección, operaciones, ventas, consulta y cliente." },
  { title: "Bitácora de todo", desc: "Queda registrado quién hizo qué y cuándo, para aclarar cualquier duda después." },
  { title: "Respaldos diarios", desc: "Tu información se respalda todos los días en infraestructura en la nube." },
] as const;


export const PRECIO = {
  badge: "Lanzamiento",
  title: "Gratis. Para siempre.",
  subtitle: "Sin tarjeta, sin límites, sin letra chica.",
  price: "$0",
  unit: "MXN / mes",
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
  { q: "¿Es realmente gratis?", a: "Sí. Durante el lanzamiento en México, Libre Carga es gratis sin límite de usuarios ni de embarques. No pedimos tarjeta de crédito para registrarte." },
  { q: "¿Mis datos están aislados de otras agencias?", a: "Sí. Cada agencia es una organización (tenant) independiente. Usamos Row Level Security a nivel base de datos, lo que significa que tus datos jamás son visibles para otra agencia." },
  { q: "¿Puedo migrar mis embarques actuales?", a: "Sí. Te ayudamos a importar tu catálogo de clientes, proveedores y embarques en curso desde Excel. Escríbenos para coordinar la migración." },
  { q: "¿Funciona en móvil?", a: "Sí. La interfaz es responsive y funciona en celular, tablet y computadora. El Portal del Cliente también está optimizado para móvil." },
  { q: "¿Qué soporte ofrecen?", a: "Atención por WhatsApp y correo de lunes a viernes. Si tienes alguna duda durante la implementación, te acompañamos sin costo." },
  { q: "¿Es compatible con CFDI 4.0?", a: "Generamos los datos fiscales necesarios para que tu PAC emita el CFDI 4.0. El flujo actual cubre proformas y captura de folios fiscales emitidos." },
] as const;

export const CTA_FINAL = {
  title: "Lleva tu agencia al siguiente nivel hoy mismo",
  desc: "Sin tarjeta, sin instalaciones, sin contratos. En 2 minutos estás operando.",
};

export const FOOTER = {
  tagline: "El sistema operativo de las agencias de carga mexicanas.",
  copyright: `© ${new Date().getFullYear()} Libre Carga. Todos los derechos reservados.`,
  contact: "contacto@librecarga.com",
  site: "librecarga.com",
};
