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

// Comparativa honesta: sólo capacidades que ya existen en el sistema.
export const ANTES_DESPUES = {
  eyebrow: "Antes y después",
  title: "Así se opera hoy… y así queda con Libre Carga",
  subtitle: "Ninguna agencia pierde embarques por falta de talento. Los pierde por falta de un solo lugar donde vive la información.",
  antesTitle: "Excel, carpetas y WhatsApp",
  despuesTitle: "Un solo expediente por embarque",
  filas: [
    {
      antes: "Un archivo de Excel por embarque, con versiones distintas en cada computadora.",
      despues: "Un expediente único con ruta, contenedores, documentos y costos siempre al día.",
    },
    {
      antes: "El cliente escribe por WhatsApp para preguntar dónde va su contenedor.",
      despues: "El cliente entra a su portal y ve el timeline, sus facturas y su saldo cuando quiera.",
    },
    {
      antes: "La cotización se rearma desde cero cada vez y el margen se calcula a mano.",
      despues: "Conceptos y márgenes precargados: la cotización sale en minutos y se convierte en embarque.",
    },
    {
      antes: "La cobranza vive en otra hoja y nadie sabe con certeza qué falta cobrar.",
      despues: "Proforma, factura y pago en el mismo flujo, con saldos y antigüedad calculados solos.",
    },
    {
      antes: "El tipo de cambio y el IVA se copian a mano, con riesgo de error fiscal.",
      despues: "Tipo de cambio del DOF e IVA configurable por organización, aplicados en automático.",
    },
  ],
} as const;

// Recorrido del producto: maquetas construidas con los mismos tokens de la app.
export const RECORRIDO = {
  eyebrow: "Recorrido",
  title: "Mira cómo se ve por dentro",
  subtitle: "El mismo flujo que usan las agencias todos los días: cotizar, operar y cobrar.",
  pasos: [
    {
      id: "cotizacion",
      tab: "Cotización",
      title: "Cotiza con tus conceptos y tu margen",
      desc: "Capturas la ruta y el equipo; los conceptos, la moneda y el margen se calculan al momento. El PDF sale listo para enviar.",
      docLabel: "Cotización",
      folio: "COT-2026-0184",
      estado: "Enviada",
      campos: [
        { label: "Cliente", value: "Importadora del Bajío" },
        { label: "Ruta", value: "CNSHA → MZLO" },
        { label: "Equipo", value: "1 × 40' HC" },
        { label: "Margen", value: "18.4 %" },
      ],
      bullets: ["Conceptos predefinidos", "Tipo de cambio del DOF", "PDF listo para enviar"],
    },
    {
      id: "embarque",
      tab: "Embarque",
      title: "Convierte la cotización en operación",
      desc: "Un clic y nace el embarque con su timeline, sus documentos y sus contenedores. Todo el equipo ve el mismo avance.",
      docLabel: "Embarque · FCL",
      folio: "LCG-2026-0142",
      estado: "En tránsito",
      campos: [
        { label: "BL Master", value: "MAEU-794821" },
        { label: "Naviera", value: "Maersk" },
        { label: "ETA", value: "08/06/2026" },
        { label: "Contenedores", value: "1 × 40' HC" },
      ],
      bullets: ["Timeline automático", "Documentos por embarque", "Tracking para el cliente"],
    },
    {
      id: "cobro",
      tab: "Cobro",
      title: "Cierra el ciclo con la factura y el pago",
      desc: "Emites proforma, generas la factura con IVA dinámico y registras el pago. Los saldos y la utilidad se actualizan solos.",
      docLabel: "Factura",
      folio: "FAC-2026-0331",
      estado: "Pagada",
      campos: [
        { label: "Subtotal", value: "$48,500.00 MXN" },
        { label: "IVA", value: "$7,760.00 MXN" },
        { label: "Total", value: "$56,260.00 MXN" },
        { label: "Saldo", value: "$0.00 MXN" },
      ],
      bullets: ["Proforma consolidada", "IVA configurable", "Saldos y utilidad al día"],
    },
  ],
} as const;



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
