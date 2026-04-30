export type ChangeType = "major" | "minor" | "patch";

export interface ChangelogEntry {
  version: string;
  date: string;
  type: ChangeType;
  title: string;
  description: string;
}

/**
 * Solo las entradas más recientes viven eager para minimizar el bundle del
 * lazy-chunk de Changelog. Las versiones 8.x completas y el histórico v1-v7
 * se cargan bajo demanda.
 */
export const recentChangelog: ChangelogEntry[] = [
  {
    version: "8.99.55",
    date: "2026-04-30",
    type: "patch",
    title: "Sidebar móvil: vuelven a verse los nombres de las secciones",
    description: "En celular el menú lateral mostraba sólo íconos sin textos porque AppSidebar reusaba el estado 'collapsed' del sidebar de escritorio. Ahora se distingue el modo móvil y el drawer abre siempre expandido con logo, organización, etiquetas de grupos y nombres de cada opción.",
  },
  {
    version: "8.99.54",
    date: "2026-04-29",
    type: "patch",
    title: "Auditoría: marcar revisado ahora respeta el rol por organización",
    description: "El upsert a auditoria_revisiones era bloqueado por RLS porque las políticas exigían rol global (user_roles) y muchos usuarios sólo tienen rol dentro de su organización (organization_members). Se agregó la función has_org_role(user_id, org_id, role) y se reemplazaron las políticas de auditoria_revisiones para permitir CRUD a admin/operador de la organización (o super_admin global) y lectura a todos los miembros. Además: el toast de error distingue ahora el caso 'sin permisos' (mensaje claro en español) y se eliminó el warning de React 'Function components cannot be given refs' envolviendo DialogHeader/DialogFooter con forwardRef.",
  },
  {
    version: "8.99.53",
    date: "2026-04-29",
    type: "patch",
    title: "Auditoría: arreglado el botón 'Marcar como revisado'",
    description: "El upsert a auditoria_revisiones fallaba silenciosamente por falta de la unique constraint requerida por ON CONFLICT. Se agrega la constraint (organization_id, embarque_id, regla, detalle_hash) y se loguean errores en consola.",
  },
  {
    version: "8.99.52",
    date: "2026-04-29",
    type: "minor",
    title: "Auditoría: hallazgos revisados se ocultan automáticamente",
    description: "Al marcar revisado el hallazgo desaparece de la tabla, de la vista por regla y deja de contar en KPIs y badge del sidebar. Banda informativa con toggle 'Ver revisados' para alternar. Filtro 'Pendientes' por default.",
  },
  {
    version: "8.99.51",
    date: "2026-04-29",
    type: "patch",
    title: "Auditoría: enlace directo al embarque desde cada hallazgo",
    description: "Cada hallazgo abre el detalle del embarque con la pestaña relevante: Documentos para 'Docs faltantes/pendientes', Tracking para 'Fechas inconsistentes', Facturación para 'Ventas sin facturar'. Expediente clicable y EmbarqueDetalle ahora soporta ?tab=.",
  },
  {
    version: "8.99.50",
    date: "2026-04-29",
    type: "patch",
    title: "Seguridad: revocado acceso anónimo a funciones del backend",
    description: "Se revoca EXECUTE para anon/public sobre todas las funciones del esquema public (incluida auditoria_embarques_org). Authenticated mantiene acceso. Default privileges ajustados para futuras funciones. Avisos del linter: 64 → 33.",
  },
  {
    version: "8.99.49",
    date: "2026-04-29",
    type: "minor",
    title: "Auditoría: marcar hallazgos como revisados con acción tomada",
    description: "Botón 'Marcar revisado' en cada hallazgo de /auditoria con campo obligatorio 'Acción tomada'. Persiste usuario, email, fecha y acción en auditoria_revisiones (con RLS) y registra en bitácora. Nuevo filtro Pendientes/Revisados.",
  },
  {
    version: "8.99.48",
    date: "2026-04-29",
    type: "minor",
    title: "Auditoría: tabla paginada con búsqueda y filtros avanzados",
    description: "Nueva pestaña 'Tabla completa' en /auditoria con búsqueda por expediente, filtros por regla, severidad, cliente y rango de fechas (ETA), paginación 25/50/100 y contador en vivo. La vista 'Por regla' (acordeón) se mantiene como segunda pestaña.",
  },
  {
    version: "8.99.47",
    date: "2026-04-29",
    type: "minor",
    title: "Módulo de Auditoría Operativa",
    description: "Nueva página /auditoria que detecta automáticamente 4 tipos de inconsistencias entre documentos, estados y fechas de embarques: documentos faltantes según etapa (con matriz marítimo/aéreo y FCL), documentos en 'Pendiente' con embarque avanzado (crítico), fechas inconsistentes (ETD/ETA vs estado), y conceptos de venta sin facturar en embarques cerrados (crítico). Una sola RPC SECURITY INVOKER public.auditoria_embarques_org() respeta RLS y devuelve el reporte completo. UI con KPIs por severidad, filtros (severidad/modo), 4 secciones colapsables con tablas y enlace directo al embarque. Badge dinámico en el sidebar (grupo Sistema) que reusa la misma query — cero round-trips extra.",
  },
  {
    version: "8.99.46",
    date: "2026-04-29",
    type: "patch",
    title: "Fix: warning de forwardRef en AppSidebar memoizado",
    description: "Tras envolver AppSidebar con React.memo en v8.99.44, Sidebar de shadcn intentaba pasar un ref al hijo, generando el warning 'Function components cannot be given refs'. AppSidebarBase ahora usa React.forwardRef antes de memo, eliminando el warning sin cambios funcionales.",
  },
  {
    version: "8.99.45",
    date: "2026-04-29",
    type: "minor",
    title: "Cache persistente de catálogos + índice DB para alertas de facturas",
    description: "Tercera oleada de la auditoría de performance. CACHE PERSISTENTE: el QueryClient ahora usa PersistQueryClientProvider con localStorage (clave lc-query-cache-v1, TTL 24h) y una whitelist por queryKey raíz: solo se persisten catálogos estáticos (puertos, navieras, tipos_contenedor, tasa_iva, exchange-rates, configuracion). Resultado: en un refresh, los selects (PortSelect, NavieraSelect, etc.) muestran sus opciones instantáneamente sin esperar a Lovable Cloud — ahorra 200-400 ms del TTI. ÍNDICE DB: nuevo idx_facturas_org_vencimiento (organization_id, fecha_vencimiento) WHERE estado <> 'Pagada' que acelera el RPC sidebar_alert_counts en organizaciones con muchas facturas. LIMPIEZA: eliminado idx_embarques_org_created por ser duplicado exacto de idx_embarques_org_created_at. Verificado que ya existían los índices clave: idx_embarques_org_eta, idx_facturas_org_estado y los GIN trigram para búsquedas.",
  },
  {
    version: "8.99.44",
    date: "2026-04-29",
    type: "minor",
    title: "Performance Front: sidebar memoizado, bundle particionado y preload extendido",
    description: "Segunda auditoría de velocidad enfocada en el shell autenticado. AppSidebar envuelto en React.memo y refactorizado con un sub-componente SidebarGroupBlock memoizado: ahora cambiar de ruta no reconstruye los 6 grupos del menú. Eliminado el import del chunk0 del changelog (~66 KB) en el sidebar, reemplazado por una constante APP_VERSION en src/constants/appVersion.ts. vite.config.ts añade chunks dedicados para icons-vendor (lucide-react), forms-vendor (react-hook-form + zod), utils-vendor (date-fns + clsx + tailwind-merge + cva) y ui-vendor (cmdk + sonner + next-themes), reduciendo la fragmentación de ~99 scripts y mejorando cacheabilidad entre rutas. Breadcrumbs y OrgSwitcher también memoizados. AuthContext extiende el preload idle a Clientes, Proveedores y Pre-Facturación además de Embarques/Cotizaciones/Dashboard. Objetivo: bajar FCP de 8.5 s a <2.5 s en preview.",
  },
  {
    version: "8.99.43",
    date: "2026-04-28",
    type: "minor",
    title: "Performance: -6 round-trips en detalle de embarque, dashboard paralelo y conteos estimados",
    description: "Cuatro oleadas de optimización de velocidad. Backend: las listas paginadas de Embarques, Clientes y Proveedores usan conteo estimado en lugar de exacto, ahorrando 200-800 ms por filtro. Red: index.html anticipa la conexión TLS y DNS al backend con preconnect/dns-prefetch (~150-300 ms menos en el primer request). Bundle: el chunk \"radix-vendor\" se amplía con 9 paquetes adicionales para evitar duplicación entre rutas. Detalle de embarque: nuevo RPC public.get_embarque_full(id) y hook useEmbarqueFull que consolidan 6 consultas (embarque + ventas + costos + documentos + notas + facturas) en 1 sola, ahorrando ~500-1500 ms en redes móviles, sin romper RLS ni mutaciones. Dashboard: las queries summary y details ahora corren en paralelo (HTTP/2) en lugar de en cascada (~40% mejor TTI). Bonus: ModoIcon convertido a forwardRef para eliminar el warning \"Function components cannot be given refs\" en consola.",
  },
  {
    version: "8.99.42",
    date: "2026-04-28",
    type: "minor",
    title: "Pulido visual: avatar con menú, badges agrupados y Sheet+FAB en /cotizaciones y /proveedores",
    description: "Oleada 3 de la auditoría visual UI/UX. Nuevo footer del sidebar con Avatar de iniciales y DropdownMenu (perfil, cambio de tema, cerrar sesión). En /cotizaciones, las columnas Estado y Vigencia se fusionan en una sola con badge primario y línea secundaria de urgencia (rojo si vencida, ámbar si vence en ≤3 días). Mobile UX extendido a /cotizaciones y /proveedores: filtros en Sheet lateral con badge de filtros activos y FAB circular para acción primaria. Contraste mejorado: labels de grupo del sidebar suben a /65 y el muted-foreground en dark mode pasa a 78% lightness. Sombras dark calibradas con halo sutil para despegar las cards del fondo oscuro.",
  },
  {
    version: "8.99.41",
    date: "2026-04-28",
    type: "minor",
    title: "Mobile UX en /embarques y /clientes: filtros en Sheet + FAB",
    description: "En mobile (<md), /embarques ya no apila 7 controles full-width antes de la tabla: ahora muestra solo SearchInput + botón \"Filtros (N)\" que abre un Sheet lateral con los 6 selects y 2 datepickers etiquetados, footer con \"Limpiar\" y \"Aplicar\". La acción primaria \"Nuevo Embarque\" se renderiza como FloatingActionButton circular azul flotante bottom-right, y \"Exportar CSV\" se mueve a un overflow menu (⋮) en el header. Mismo patrón FAB aplicado a /clientes. Desktop md+ permanece intacto. Componente nuevo: FloatingActionButton (md:hidden, fixed bottom-6 right-4, 56x56 rounded-full, ARIA label obligatorio).",
  },
  {
    version: "8.99.40",
    date: "2026-04-28",
    type: "patch",
    title: "KPIs monetarios con notación compacta en detalle de cliente",
    description: "Las tarjetas KPI Facturado, Pendiente y Profit en /clientes/:id usan notación compacta (USD 19.3K, USD 1.2M, USD 845) para evitar el truncamiento tipo 'USD …' que aparecía en grids de 6 columnas en monitores medianos. El valor completo con separadores y dos decimales se conserva como tooltip nativo al pasar el cursor. Nueva utilidad formatCurrencyCompact en src/lib/formatters y nuevo prop opcional valorTooltip en KpiCard.",
  },
  {
    version: "8.99.39",
    date: "2026-04-28",
    type: "patch",
    title: "Títulos H1 estandarizados en páginas de edición",
    description: "Los wizards /embarques/:id/editar y /cotizaciones/:id/editar promueven el identificador legible al H1 (\"Editar embarque ELIMP00185\", \"Editar cotización COT-2026-0059\") en lugar del genérico \"Editar Embarque/Cotización\" con el folio relegado al subtitle. Alinea la jerarquía con los breadcrumbs introducidos en v8.99.38. Las páginas de detalle ya usaban el mismo identificador en H1 y breadcrumb, por lo que no requirieron cambios.",
  },
  {
    version: "8.99.38",
    date: "2026-04-28",
    type: "patch",
    title: "Breadcrumbs con nombres legibles en páginas de detalle",
    description: "Las rutas de detalle (clientes, embarques, cotizaciones, proveedores, organizaciones, portal) ya no muestran el UUID crudo en el breadcrumb del header. Cada página registra su nombre legible (cliente.nombre, embarque.expediente, cotizacion.folio…) en un BreadcrumbContext global, de modo que el breadcrumb muestra 'Clientes › Indimex Trading' en lugar de 'Clientes › 87bdcbf1-4476-…'. Si la página aún está cargando, se conserva el fallback truncado para no romper el layout.",
  },
  {
    version: "8.99.37",
    date: "2026-04-27",
    type: "patch",
    title: "Logo del sidebar más grande y estético",
    description: "El logo de Libre Carga en el header del sidebar pasa de 32px (h-8) a 40px (h-10) en modo expandido y 36px (h-9) en modo colapsado, ganando presencia de marca sin alterar la altura del header (h-16, simétrico con el topbar). Acabado refinado: padding interno p-1 (más respiración del PNG), esquinas rounded-xl (más suaves) y shadow-card sutil (token de marca) para profundidad sobre el fondo navy del sidebar. El texto 'Libre Carga' sube de text-sm a text-base con tracking-tight y leading-tight para acompañar visualmente el logo más grande.",
  },
  {
    version: "8.99.36",
    date: "2026-04-27",
    type: "patch",
    title: "Simetría header sidebar y topbar",
    description: "Se alinea la altura del SidebarHeader (menú lateral) con la barra superior de la página a exactamente 64px (h-16), eliminando el escalón visual de ~4px que generaba el padding p-4 + logo h-9. Ahora la línea horizontal inferior de ambos headers es continua y simétrica, tanto en modo expandido como colapsado. Logo reducido de h-9 a h-8 para respirar correctamente dentro de los 64px.",
  },
  {
    version: "8.99.35",
    date: "2026-04-27",
    type: "patch",
    title: "Sidebar: fix scroll horizontal, indicador 'rail' en item activo y tooltips en collapsed",
    description: "Mejoras de navegación del menú lateral: (1) Fix scrollbar horizontal — SidebarContent usaba overflow-auto (ambos ejes); cambia a overflow-y-auto overflow-x-hidden para eliminar la barra horizontal indeseada que aparecía cuando algún hijo (org name larga, email del usuario, badge de alertas) generaba mínimo overflow lateral. (2) Rail vertical en item activo — los items del menú activos ahora muestran una pseudobarra vertical de 3px en color sidebar-primary pegada al borde izquierdo (before:absolute), visible tanto en modo expanded como collapsed (ancho 3rem) — mejora drásticamente la escaneabilidad cuando el sidebar está en icon-only y el cambio de fondo del cuadrito de 32px se perdía visualmente. (3) Items con badge — el span del título y el Badge de alertas se separan correctamente con flex-1 truncate + shrink-0, eliminando la causa raíz del overflow en 'Principal'. (4) Tooltip en logout collapsed — el botón 'Cerrar sesión' ahora se envuelve en Tooltip side='right' cuando el sidebar está colapsado, igual que los items de menú, para que el icono LogOut sin etiqueta sea descubrible. (5) SidebarTrigger con atajo visible — tooltip añadido al botón del header indicando 'Colapsar / expandir menú · ⌘B' (el atajo Cmd/Ctrl+B ya estaba implementado pero era invisible para el usuario). (6) Header del sidebar en collapsed — el contenedor del logo cambia a justify-center sin gap, eliminando el padding asimétrico cuando el texto está oculto; padding del header/footer reducido a p-2 en collapsible=icon mode. Resultado: navegación más limpia y profesional, sin scrollbar horizontal molesto, item activo visible de un vistazo en cualquier modo, atajos descubribles. Cero cambios funcionales; tsc -p tsconfig.app.json pasa limpio.",
  },
  {
    version: "8.99.34",
    date: "2026-04-27",
    type: "minor",
    title: "Auditoría UI/UX Fase I: Polish visual integral — sistema de elevación, ritmo y tipografía",
    description: "Novena fase de la auditoría UI/UX integral, enfocada en cohesión visual, jerarquía de elevación y micro-refinamientos sistémicos a nivel de componentes core. (1) Sistema de elevación de 3 niveles — index.css incorpora tres tokens semánticos (--shadow-card para superficies informativas, --shadow-raised para elementos interactivos en hover, --shadow-overlay para popovers/dialogs/dropdowns/menús de select), todos con tinte azul-marino de marca (en vez de neutro puro) y variantes calibradas para tema oscuro (mayor opacidad, menor intensidad para no 'quemar' sobre el background azul oscuro). tailwind.config.ts expone los tokens como shadow-card/raised/overlay para usar como utility class. (2) Card refinada — la sombra plana shadow-sm migra a shadow-card (sutil con tinte de marca); CardHeader baja de p-6 a p-6 pb-3 (menos espacio header↔contenido); CardTitle baja de text-2xl a text-lg font-semibold leading-tight (audit confirmó que 100% de los usos lo sobrescribían a text-sm/base/lg, era el default equivocado). (3) Button con micro-feedback — variant default recibe shadow-sm + hover:shadow; transición de transition-colors a transition-all duration-150; active:scale-[0.98] para feedback táctil al click; outline gana hover:border-accent/40 para affordance visual. (4) Inputs/Textarea/Select unificados — focus ring suave (ring-2 ring-ring/40 sin offset duro) en vez del anillo agresivo previo; hover:border-ring/40 para affordance; shadow-sm sutil + transition-colors. SelectContent eleva de shadow-md a shadow-overlay para coherencia con popovers. (5) Dialog refinado — overlay migra de bg-black/80 (hard) a bg-foreground/40 backdrop-blur-sm (efecto vidrio profesional); content usa shadow-overlay y rounded-xl (radio mayor para dialogs). (6) Popover y DropdownMenu — heredan shadow-overlay para jerarquía de elevación consistente con dialogs. (7) Table header tipo Stripe — TableHeader pasa de bg-background a bg-muted/40 backdrop-blur-sm (sutil separación visual del body sin perder el sticky scroll). (8) Layout y header sticky — header sube de h-14 px-4 a h-16 px-6 (alineado con main p-6, mismo gutter izquierdo que el contenido); ahora es sticky top-0 z-30 con backdrop-blur y bg-card/85 — efecto vidrio al hacer scroll que mantiene el branding presente sin estorbar; main añade max-w-screen-2xl mx-auto para evitar que las páginas se estiren infinitamente en monitores 4K (mejor lectura, más densidad). (9) Tipografía body — letter-spacing -0.011em + ss01 alternate (más densidad estilo Linear/Vercel/Stripe); h1-h4 con letter-spacing -0.018em (títulos más 'tight'); -webkit-font-smoothing antialiased para renderizado nítido en macOS. (10) Tweaks de tema — light: background pasa de 210 33% 98% a 210 30% 99% (más blanco, más limpio), border baja a 214 28% 92% (menos 'boxy'), muted-foreground sube a 215 18% 42% (mejor contraste WCAG AA); dark: card sube de 220 38% 11% a 220 35% 13% (mejor jerarquía vs background 220 40% 7%), border sube a 217 30% 22% (más visible). (11) Tokens de radio extendidos — --radius-sm (0.375rem) y --radius-lg (0.75rem) expuestos en CSS y mapeados a Tailwind como rounded-xl (jerarquía: chips y filas usan sm, inputs y buttons usan md, cards usan lg, dialogs usan xl). Resultado: cero cambios funcionales, ningún color de marca alterado, tsc -p tsconfig.app.json pasa limpio. La app gana sensación de profundidad estilo Linear/Notion, jerarquía visual clara entre superficies (card → raised → overlay), tipografía premium con letter-spacing negativo sutil, header con efecto vidrio, contenedor centrado en monitores anchos, y micro-feedback táctil en todos los botones — todo sin tocar una sola línea de lógica de negocio.",
  },
  {
    version: "8.99.33",
    date: "2026-04-27",
    type: "minor",
    title: "Auditoría UI/UX Fase H: PageHeader unificado en páginas de listado y dashboards",
    description: "Octava fase de la auditoría UI/UX integral, enfocada en consistencia tipográfica de page headers. El audit detectó que ~25 páginas duplicaban el patrón <div flex><div><h1 text-2xl font-bold/><p text-sm text-muted-foreground/></div><actions/></div> con divergencias: algunas usaban tracking-tight, otras no; algunas text-foreground (redundante porque ya es default), otras no; spacing label↔descripción inconsistente (mt-1 vs sin mt); layouts mezclando flex flex-col gap-3 sm:flex-row con flex items-center justify-between. (1) PageHeader nuevo — src/components/shared/PageHeader.tsx encapsula el patrón con tipografía estándar (text-2xl font-bold tracking-tight), descripción opcional (text-sm text-muted-foreground mt-1), icono opcional a la izquierda del título, slot de acciones a la derecha y layout responsive (apilado en mobile, lado a lado en md+). (2) Migración de 12 páginas — Embarques, Clientes, Proveedores, Cotizaciones, Facturacion (Pre-Facturación), Changelog, Reportes (Rentabilidad), Operaciones, Dashboard, AdminUsuarios, AdminOrganizaciones, admin-org/Usuarios, Bitacora, PortalEmbarques, PortalCotizaciones y PortalFacturas reemplazan sus bloques inline por <PageHeader title=... description=... actions=.../>. Resultado: tipografía 100% consistente entre listados internos, dashboards y portal del cliente; ~150 LOC eliminadas por des-duplicación; tsc -p tsconfig.app.json pasa limpio.",
  },
  {
    version: "8.99.32",
    date: "2026-04-27",
    type: "minor",
    title: "Auditoría UI/UX Fase G: Tokens estandarizados para tamaños de Dialog",
    description: "Séptima fase de la auditoría UI/UX integral, enfocada en consistencia de modales (DialogContent). El audit detectó tres problemas sistémicos: (a) tamaños de DialogContent diversos sin sistema (sm:max-w-md, max-w-lg, max-w-3xl, max-w-4xl, default sin clase) que generan modales del mismo propósito (CRUD de cliente vs CRUD de proveedor) con anchos visualmente distintos; (b) dos diálogos sin tamaño explícito (AdminOrganizaciones · Nueva Organización, TabPortalCliente · Invitar Cliente) que heredaban el max-w-lg default — demasiado ancho para 2 inputs cortos, generando un modal vacío con mucho espacio; (c) overflow inconsistente: algunos formularios largos tenían max-h-[85vh] overflow-y-auto, otros max-h-[90vh], otros nada (riesgo de modal cortado en viewports pequeños). (1) dialogTokens nuevo — src/lib/ui/dialogTokens.ts centraliza el sistema de tamaños con 7 niveles documentados: sm (~24rem, alerts/notas), md (~28rem, CRUD pocos campos · default recomendado), lg (~32rem, formularios cortos como cliente/contacto), xl (~36rem), 2xl (~42rem, formularios medianos), 3xl (~48rem, previews/proforma), 4xl (~56rem, wizards inline). Cada token mapea a sm:max-w-* con cada uno de los criterios de uso documentado en JSDoc. Constante adicional 'scrollableDialog' aplica max-h-[85vh] overflow-y-auto de forma consistente. (2) Migración de 13 diálogos — NuevoUsuarioDialog, EditarProveedorDialog, NuevoProveedorDialog, DialogMarcarFacturada, AgregarMiembroOrgDialog (md); DialogContacto, DialogEditarCliente, NuevoClienteDialog, DialogConvertirProspecto (lg); DialogGenerarProforma (3xl); DialogDuplicarEmbarque (4xl); AdminOrganizaciones · Nueva Organización (md, antes default lg); TabPortalCliente · Invitar Cliente (md, antes default lg). Los 4 diálogos con scroll (NuevoProveedor, NuevoCliente, DialogGenerarProforma, DialogDuplicarEmbarque) ahora componen el tamaño con scrollableDialog vía cn(). (3) Beneficio sistémico — todos los modales del sistema ahora consumen tokens del mismo módulo, eliminando la deriva de strings literales y permitiendo cambios globales (ej. ajustar el ancho 'lg' a 32.5rem) editando un solo archivo. La documentación inline guía a futuros desarrolladores sobre qué tamaño usar según contenido. Resultado: 1 nuevo módulo de tokens (dialogTokens.ts), 13 diálogos normalizados, 0 cambios funcionales; tsc -p tsconfig.app.json pasa limpio.",
  },
  {
    version: "8.99.31",
    date: "2026-04-27",
    type: "minor",
    title: "Auditoría UI/UX Fase F: EmptyStateInline unificado y mejor empty/loading en DataTable",
    description: "Sexta fase de la auditoría UI/UX integral, enfocada en estados vacíos (empty states) y de carga consistentes. El audit detectó dos problemas sistémicos: (a) el patrón <div className='text-center py-8'><Icon className='h-8 w-8 mx-auto text-muted-foreground/40 mb-2'/><p className='text-sm text-muted-foreground'>...</p></div> aparecía duplicado literalmente en 7+ componentes (PortalProximosArribosCard, PortalEmbarquesRecientesCard, PortalEmbarqueDocumentos, PortalEmbarqueTimeline, HistorialProformas, HistorialFacturas, TabTracking) con micro-divergencias en padding (py-8 vs py-12) y opacidad de icono (40 vs 30), generando jitter visual al navegar entre cards; (b) el empty state interno de DataTable usaba un Inbox enorme (h-10 w-10) con un único <p> de texto sin jerarquía, mientras los empty states de los componentes externos usaban iconos más pequeños (h-8 w-8) — dos lenguajes visuales para la misma función. (1) EmptyStateInline nuevo — src/components/empty/EmptyStateInline.tsx encapsula el patrón compacto con dos modos: empty (icono Lucide opcional con opacity-40 strokeWidth=1.5, mensaje, hint opcional) y loading (Loader2 con animate-spin). Padding por defecto py-8, override vía className. Esto distingue claramente el componente del EmptyState 'grande' (página completa con CTAs) y elimina la necesidad de copiar el bloque en cada card. (2) DataTable mejorado — el empty state interno ahora: usa el mismo styling visual (h-8 w-8 opacity-40 strokeWidth=1.5) que EmptyStateInline para consistencia cromática; padding sube a py-12 (más respiración visual cuando una tabla queda vacía); el mensaje principal pasa a font-medium para distinguirse del hint; nuevas props emptyHint (texto secundario opcional, ej. 'Prueba con otro filtro o crea uno nuevo') y emptyState (slot ReactNode arbitrario que reemplaza al empty por defecto, útil para CTAs como 'Crear primer embarque'). (3) Migración de 7 consumidores — PortalProximosArribosCard, PortalEmbarquesRecientesCard, PortalEmbarqueDocumentos, PortalEmbarqueTimeline, HistorialProformas, HistorialFacturas y TabTracking reemplazan sus bloques inline de 4-5 líneas por un solo <EmptyStateInline icon={X} message='...' />. TabTracking además unifica el estado de carga 'Cargando eventos...' (antes era un Loader2 inline ad-hoc) usando <EmptyStateInline loading message='Cargando eventos...' />, ganando consistencia con el resto de spinners del sistema. Resultado: 1 componente nuevo (EmptyStateInline), DataTable extendido con 2 props, 7 archivos migrados, ~30 LOC eliminadas por des-duplicación, lenguaje visual 100% consistente para empty/loading states en cards; tsc --noEmit pasa limpio.",
  },
  {
    version: "8.99.30",
    date: "2026-04-27",
    type: "minor",
    title: "Auditoría UI/UX Fase E: WizardSection y FormField unificados en wizards de cotización y embarque",
    description: "Quinta fase de la auditoría UI/UX integral, enfocada en consistencia de formularios. El audit detectó cinco inconsistencias entre los dos wizards (Cotización y Embarque): (a) tipografía de CardTitle divergente — Cotización usaba text-lg, Embarque usaba el default (text-2xl), generando dos jerarquías visuales para el mismo nivel de información; (b) spacing label↔input inconsistente — Embarque usaba <div className='space-y-2'> mientras Cotización usaba <div> plano, produciendo distancias visualmente distintas en el mismo formulario cuando el usuario navegaba entre pasos; (c) constantes MODOS/TIPOS/INCOTERMS duplicadas en SeccionDatosGeneralesCotizacion (ya existían en src/constants/wizardConstants.ts), riesgo de divergencia en futuras ampliaciones; (d) radios nativos <input type='radio'> en SeccionDestinatario y en el toggle FCL/LCL del wizard de cotización, mientras el resto del sistema usa shadcn/ui — diferentes estilos de focus, sin soporte de keyboard navigation consistente; (e) ausencia de marca visual del campo requerido (asterisco) — sólo Embarque la usaba inline en el label, Cotización no la mostraba en absoluto. (1) WizardSection nuevo — src/components/shared/WizardSection.tsx encapsula el patrón Card+CardHeader+CardTitle con tipografía estandarizada (text-base font-semibold), header compacto (pb-3), soporte para descripción opcional, slot de actions y modo grid responsive de 1/2/3 columnas con gap-4 consistente. (2) FormField nuevo — src/components/shared/FormField.tsx encapsula el patrón Label+control+error con space-y-2 fijo, marca asterisco rojo cuando required, soporta hint inline (texto auxiliar gris junto al label), span 1/2/full para grids, y renderiza el mensaje de error con role='alert' en text-xs text-destructive. (3) Migración de cotización — SeccionDatosGeneralesCotizacion, SeccionDestinatario y SeccionRutaCotizacion se reescriben usando WizardSection + FormField; las constantes locales se eliminan en favor de las centralizadas; los radios nativos de Destinatario migran a RadioGroup/RadioGroupItem de shadcn. (4) CotizacionWizardLayout — el toggle FCL/LCL del paso de Mercancía migra de <input type='radio'> a RadioGroup, y la Card que envolvía la sección Mercancía pasa a WizardSection para mantener la misma cabecera tipográfica que el resto. (5) Embarque — StepDatosGenerales, StepDatosRuta y StepDocumentos actualizan sus CardTitle a text-base font-semibold con CardHeader pb-3, igualando la tipografía de Cotización; las leyendas auxiliares ('X de Y adjuntos') pasan a text-xs. Resultado: 7 archivos modificados (2 nuevos componentes compartidos + 5 secciones unificadas), tipografía y spacing 100% consistentes entre los dos wizards principales del sistema, eliminación de duplicación de constantes y de patrones radio nativos, tsc --noEmit pasa limpio.",
  },
  {
    version: "8.99.29",
    date: "2026-04-27",
    type: "minor",
    title: "Auditoría UI/UX Fase D: Iconografía Lucide para modos de transporte y columna de acciones sticky",
    description: "Cuarta fase de la auditoría UI/UX integral, enfocada en iconografía consistente y ergonomía de tablas anchas. (1) Reemplazo de emojis por iconos Lucide — los modos de transporte (Marítimo, Aéreo, Terrestre, Multimodal) usaban emojis 🚢 ✈️ 🚛 🔄, que renderizan distinto en cada SO/navegador (Apple Color Emoji vs Segoe UI Emoji vs Noto), rompen la armonía visual con el resto de iconos Lucide del sistema y no respetan currentColor para temas. Se crea el componente reutilizable src/components/shared/ModoIcon.tsx que renderiza Anchor/Plane/Truck/Shuffle (fallback Package) con tinte cromático por modo (azul/cielo/ámbar/púrpura) y soporte opcional para modo 'circle' (badge circular para headers de detalle, ej. EmbarqueDetalleHeader, PortalEmbarqueDetalle, ProximosArribosCard, TrackingPublico). (2) Refactor de 9 consumidores — embarqueColumns, EmbarquesFiltros, EmbarqueDetalleHeader, TabResumen, EmbarquesActivosTable, ProximosArribosCard, PortalEmbarqueDetalle, PortalProximosArribosCard, PortalEmbarquesRecientesCard y TrackingPublico ahora importan ModoIcon en lugar de getModoIcon (que devolvía string emoji). DetailRow se extiende para aceptar ReactNode. (3) Columna de acciones sticky-right — en la tabla de Embarques (con 13 columnas) la columna '…' (acciones) quedaba al final y obligaba a hacer scroll horizontal completo para acceder a Editar/Duplicar/Eliminar. DataTable se extiende con la prop stickyRight (símil de sticky-left para Expediente) que ancla la columna a la derecha con sombra sutil, manteniendo siempre visible el menú contextual durante el scroll. La columna se ensancha de w-10 a w-12 para mejor target táctil. Resultado: 11 archivos modificados (1 nuevo componente + 10 refactores), iconografía 100% Lucide en flujos de embarque, tsc --noEmit pasa limpio.",
  },
  {
    version: "8.99.28",
    date: "2026-04-27",
    type: "minor",
    title: "Auditoría UI/UX Fase C: KpiCard unificado con tipografía adaptativa y tabular-nums",
    description: "Tercera fase de la auditoría UI/UX integral, enfocada en consistencia de tarjetas de métricas (KPIs). El audit visual detectó tres problemas sistémicos: (a) los valores monetarios largos como 'USD 92,789.80' se truncaban con '…' en cards estrechas (lg:grid-cols-6 del detalle de cliente, dashboard de Reportes en viewport <1280px); (b) los números no usaban tabular-nums, generando desalineación entre cards adyacentes (el '1' es más angosto que el '0' en fuentes proporcionales, así que '1,234' y '8,000' se ven desfasados); (c) tres componentes diferentes (KpiCard, ReportesKpiCards, ClienteSummaryCards) renderizaban el mismo patrón con CSS duplicado y divergencias sutiles (text-2xl vs text-xl vs text-lg, sin tipografía adaptativa). (1) KpiCard · tipografía adaptativa — el componente unificado src/components/operaciones/KpiCard.tsx ahora calcula el tamaño según la longitud del valor: ≤8 chars (ej. '1,234', '85%') usa text-3xl para máximo impacto visual; 9-13 chars (ej. 'USD 12,500') text-2xl; 14+ chars (ej. 'USD 1,234,567.89') text-xl, garantizando que ningún valor termine con '…'. Se añade tabular-nums (números monoespaciados) para alineación numérica perfecta entre cards adyacentes; truncate + tooltip nativo (atributo title) como red de seguridad para casos extremos; leading-tight para densidad vertical compacta; subtítulos suben de text-[10px] (ilegible) a text-xs y reciben truncate + title. El icono recibe shrink-0 para nunca colapsar. (2) ReportesKpiCards refactorizado — eliminó la duplicación del patrón Card+icon+text y ahora delega en KpiCard, heredando automáticamente todas las mejoras (4 cards: Clientes, Revenue, Profit, Margen). 36 LOC → 26 LOC. (3) ClienteSummaryCards refactorizado — mismo patrón, eliminó la prop interna 'small' (innecesaria con tipografía adaptativa) y delega en KpiCard. Las 6 cards del detalle de cliente (Embarques, Cotizaciones, Contactos, Facturado, Pendiente, Profit) ahora se ven uniformes en lg:grid-cols-6 sin overflow visible. 42 LOC → 33 LOC. (4) DashboardStatusCards · arribos del mes — los 4 contadores inline (Total, Ya llegaron, En camino, Profit USD) reciben tabular-nums para alinearse correctamente; las labels suben de text-[10px] a text-[11px]; el valor de Profit recibe atributo title para mostrar el monto completo en hover si se trunca. Resultado: 4 archivos modificados (1 core + 3 consumidores), 0 cambios de tipos, 18 LOC neto eliminadas por des-duplicación; tsc --noEmit pasa limpio. Esta fase establece KpiCard como el único componente autorizado para renderizar KPIs cuantitativos en el sistema.",
  },
  {
    version: "8.99.27",
    date: "2026-04-27",
    type: "minor",
    title: "Auditoría UI/UX Fase B: Jerarquía de acciones en headers de detalle",
    description: "Segunda fase de la auditoría UI/UX integral, enfocada en la jerarquía de acciones de los headers de detalle. Antes, el header del detalle de embarque exponía hasta 6 botones del mismo peso visual ('Avanzar a X', 'Editar', 'Duplicar', 'Compartir', 'Imprimir', 'Eliminar'), todos lado a lado, con el botón rojo de Eliminar a un click de distancia del workflow primario — un riesgo serio de error operativo. (1) EmbarqueDetalleHeader · patrón 1 primaria + secundarias en menú — la acción primaria es el avance de estado del workflow ('Avanzar a En Tránsito') y, cuando ya no hay siguiente estado, Editar pasa a primaria; Compartir queda como secundaria visible (alta frecuencia, no destructiva); Editar (en wizard avance), Duplicar e Imprimir se agrupan en un menú '…' (DropdownMenu); Eliminar vive en el mismo menú pero separado por DropdownMenuSeparator y con clase text-destructive focus:bg-destructive/10, alineado al patrón de menús destructivos de shadcn/ui. Resultado: la zona del header pasa de 6 botones a 3 elementos visibles (1 primario + Compartir + '…'), reduciendo la carga visual ~50% y eliminando la proximidad peligrosa entre 'Avanzar' y 'Eliminar'. (2) ProveedorDetalle · misma normalización — antes mostraba 'Eliminar' (destructive rojo) a la izquierda de 'Editar' (outline), invirtiendo la jerarquía esperada; ahora Editar es la acción primaria visible y Eliminar se mueve a un menú '…' con estilo destructivo, visible solo para isAdmin. (3) Patrón documentado para reusar — esta fase establece el estándar de header de detalle del sistema: 1 botón primary (workflow / acción más importante) + 0-2 secundarias visibles (alta frecuencia, no destructivas) + DropdownMenu '…' con resto, con destructivas siempre debajo de un Separator. ClienteDetalle y CotizacionDetalle se evalúan pero no requieren cambios (no exponen destructivas en el header). Resultado: 2 archivos modificados (EmbarqueDetalleHeader.tsx, ProveedorDetalle.tsx); tsc --noEmit pasa limpio.",
  },
  {
    version: "8.99.26",
    date: "2026-04-27",
    type: "minor",
    title: "Auditoría UI/UX Fase A: Header con breadcrumbs y sidebar tema-aware",
    description: "Primera fase de la auditoría UI/UX integral, enfocada en navegación global. (1) Breadcrumbs dinámicos — se reemplaza el rótulo estático 'PLATAFORMA DE OPERACIONES' (texto en mayúsculas que no aportaba contexto) por un componente Breadcrumbs (src/components/layout/Breadcrumbs.tsx) que deriva la ruta actual y muestra una jerarquía navegable: 'Embarques › ELIMP00185', 'Clientes › Indimex Trading', etc. Cada segmento es un <Link> excepto el último (página actual), e identifica segmentos dinámicos largos (uuids/expedientes) truncándolos a 14 caracteres. Mejora orientación contextual y permite volver atrás en niveles intermedios sin usar el botón del navegador. (2) Header más esbelto — la altura del header pasó de h-16 a h-14, sin shadow-sm (border-b es suficiente), con un divisor vertical sutil entre el SidebarTrigger y los breadcrumbs para reforzar agrupación visual. (3) Sidebar tema-aware — antes el sidebar era SIEMPRE azul-marino sólido, incluso en modo claro, generando una sensación de 'tema sin terminar' (dos áreas con tono opuesto). Los tokens --sidebar-* del modo claro se recalibran a fondo blanco con borde sutil, foreground oscuro alineado con la marca, y estado activo en azul-marino sólido (--sidebar-accent), respetando la armonía cromática general. En modo oscuro nada cambia. El logo recibe ring-1 ring-sidebar-border en light para destacarse del fondo blanco; en dark se elimina el ring. (4) Versión dinámica — el footer del sidebar mostraba 'v6.4.0 · Libre Carga' hardcodeado mientras el changelog real iba en v8.99.25 (información engañosa). Ahora lee la versión más reciente directamente de chunk0[0].version del changelog (APP_VERSION constante), garantizando sincronía automática con cada release. Tipografía a text-[11px] tabular-nums para alineación numérica. (5) Labels de grupo del sidebar — text-xs/60% → text-[11px]/50% para mayor sutileza visual y jerarquía clara entre encabezado de grupo y items. Resultado: 4 archivos modificados (Layout, AppSidebar, index.css, +1 nuevo Breadcrumbs.tsx); tsc --noEmit pasa limpio.",
  },
  {
    version: "8.95.0",
    date: "2026-04-26",
    type: "minor",
    title: "Severidad uniforme y estilo único de feedback en el wizard de embarques",
    description: "Definición y aplicación de una regla única de severidad para los 4 pasos del wizard: bloqueante (error) impide avanzar/enviar, advertencia no bloquea, éxito al completar. Nuevas variantes 'warning' y 'success' añadidas a los componentes shadcn Alert y Toast usando los tokens semánticos --warning/--success existentes. Nuevo componente compartido src/components/shared/ValidationAlert.tsx con los tres niveles (error/warning/success), iconos consistentes (AlertCircle/AlertTriangle/CheckCircle2), título por defecto y lista de mensajes en formato 'Campo: razón.'. Nuevo helper src/lib/ui/wizardFeedback.ts con notifyError/notifyWarning/notifySuccess para centralizar la emisión de toasts del wizard. Aplicado en useNuevoEmbarqueWizard (validación bloqueante por paso), useEmbarqueSubmitOrchestrator (errores de fase bloqueantes, advertencia para cotización no actualizada, éxito al crear) y los 4 Step components (StepDatosGenerales, StepDatosRuta, StepDocumentos, StepCostosPrecios) que ahora muestran ValidationAlert con el mismo layout. StepDocumentos añade una advertencia no-bloqueante cuando hay documentos pendientes. Nuevo test wizardFeedback.test.ts (4 casos). Tests 205/205 pasando.",
  },
  {
    version: "8.94.0",
    date: "2026-04-26",
    type: "patch",
    title: "Wizard Nuevo Embarque: mensajes de validación estandarizados",
    description: "Unificación de tono, formato y severidad de todos los mensajes de error del wizard de embarques bajo el patrón 'Campo: razón.' (español MX, tuteo, sin signos de admiración). Nuevo helper formatValidationMessage(field, reason) y constante STEP_LABELS en src/lib/domain/embarqueWizardSchemas.ts garantizan consistencia futura. Toasts de validación pasan a 'Revisa el Paso N: <nombre>' (Datos generales / Ruta / Documentos / Costos). Toasts de error de submit pasan al patrón 'Error: <fase>' (generación de expediente / subida de documentos / guardado del embarque). El toast de archivo rechazado en StepDocumentos se reformatea con título 'Documento rechazado' y descripción en el mismo formato. Sin cambios funcionales: la lógica de validación se mantiene idéntica.",
  },
  {
    version: "8.93.0",
    date: "2026-04-26",
    type: "minor",
    title: "Wizard Nuevo Embarque: validaciones consistentes y manejo de errores granular",
    description: "Validación end-to-end con zod para los 4 pasos del wizard de Nuevo Embarque (antes solo el paso 1 validaba). Nuevo módulo src/lib/domain/embarqueWizardSchemas.ts con schemas por paso: (1) Datos Generales (modo, tipo, cliente, descripción), (2) Ruta condicional por modo de transporte —Marítimo (puertos, naviera, tipo servicio, contenedor, tipo contenedor), Aéreo (aeropuertos, MAWB) y Terrestre (ciudades, transportista)— con validación cruzada ETA ≥ ETD, (3) Documentos (tamaño máx 10MB, MIME PDF/JPG/PNG/XLSX/DOCX), (4) Costos y Pricing (al menos 1 concepto venta y 1 de costo válidos, cantidad ≥ 1, montos ≥ 0, tipos de cambio USD/EUR > 0). El controller useNuevoEmbarqueWizard ahora expone validateStep(step) unificado y valida los 4 pasos antes de enviar (handleFinish), saltando al primer paso con error y mostrando toast contextual. Cada Step component (StepDatosRuta, StepDocumentos, StepCostosPrecios) recibe sus errores y muestra mensajes inline o en Alert. Cálculo automático de ETA sugerida al ingresar ETD si la cotización vinculada tiene tiempo_transito_dias. Manejo granular de errores en useEmbarqueSubmitOrchestrator: cada fase (resolverExpediente, subirDocumentos, createEmbarque, updateEstadoCotizacion) tiene su propio try/catch con mensaje específico; la actualización del estado de la cotización ahora es no-bloqueante (warning si falla). Nuevo archivo de tests src/lib/domain/__tests__/embarqueWizardSchemas.test.ts (17 casos). Build limpio (tsc), 201/201 pruebas pasando (184 + 17 nuevas).",
  },
  {
    version: "8.92.0",
    date: "2026-04-26",
    type: "minor",
    title: "Auditoría: 3 page controllers, 4 services y 4 hooks raíz reorganizados",
    description: "Top 5 mejoras de la auditoría post-v8.91.0 ejecutadas en un solo paso, sin breaking changes. (1) Embarques.tsx (241 LOC con 5 useState/useMemo + handler de eliminar + builder de exportToCsv inline) reducido a UI pura (~150 LOC) tras extraer src/hooks/embarque/useEmbarquesPageController.ts que orquesta filtros, query de embarques, prefetch, permisos, dialogs (eliminar/duplicar), columnas y export CSV. (2) Facturacion.tsx (234 LOC) reducido a composición + columnas (~165 LOC) tras extraer src/hooks/facturacion/useFacturacionPageController.ts (filtros server-side, paginación, mutación marcarPagado, registro de bitácora, export CSV). (3) ProveedorDetalle.tsx (196 LOC con 3 useState + cálculos de totales + 2 handlers de mutación inline) reducido a UI pura (~155 LOC) tras extraer src/hooks/proveedor/useProveedorDetalleController.ts (carga proveedor, operaciones, totales facturado/pagado/pendiente, dialogs, handlers de update/delete con bitácora). (4) Cuatro services críticos migrados al patrón folder/barrel: services/bitacora/, services/catalogos/, services/configuracion/ y services/usuario/ con index.ts; los archivos antiguos quedan como shim de re-export. (5) Cuatro hooks raíz movidos a sus carpetas de dominio: useClientes → hooks/cliente/, useProveedores → hooks/proveedor/, useFacturas → hooks/facturacion/ y useDashboardData → hooks/dashboard/ (nueva carpeta); los archivos raíz quedan como shim. Build limpio (tsc), 184/184 pruebas pasando.",
  },
  {
    version: "8.91.0",
    date: "2026-04-26",
    type: "minor",
    title: "Auditoría: controllers de proveedor y Cotizaciones, 3 services a folder/barrel y promoción de ProfitBadge",
    description: "Top 5 mejoras de la auditoría arquitectónica post-v8.90.0 ejecutadas en un solo paso, sin breaking changes. (1) NuevoProveedorDialog (202 LOC, mezclaba estado wizard + validación + handlers + UI) reducido a ~120 LOC presentacionales tras extraer src/hooks/proveedor/useNuevoProveedorController.ts (~120 LOC) que centraliza estado, validación, derivados (isAgenteCarga, rfcLabel) y orquestación de pasos. (2) EditarProveedorDialog (161 LOC) reducido a UI pura tras extraer src/hooks/proveedor/useEditarProveedorController.ts que encapsula estado del form, errores derivados con touched-fields, validación de email y handler de guardado. (3) Cotizaciones.tsx (245 LOC, 7 hooks + filtros + KPIs + handlers inline) reducido a composición de columnas + JSX (~155 LOC) tras extraer src/hooks/cotizacion/useCotizacionesPageController.ts (~150 LOC) que orquesta useCotizaciones, useDeleteCotizacion, useDuplicarCotizacion, useClientesForSelect, useListPageState, KPIs derivados y handlers (duplicar, exportar CSV, eliminar, navegación). (4) Tres services críticos pasan al patrón folder/barrel: services/dashboard/, services/facturas/ y services/search/ con index.ts; los archivos antiguos services/dashboardService.ts, services/facturasService.ts y services/searchService.ts quedan como shim de re-export para preservar imports. (5) ProfitBadge promovido de src/components/shared/ a src/components/ProfitBadge.tsx; src/components/shared/ProfitBadge.tsx queda como shim de re-export (la carpeta shared/ se eliminará en una futura iteración una vez migrados los 5 importadores). Build verde, 184/184 pruebas pasando.",
  },
  {
    version: "8.90.0",
    date: "2026-04-26",
    type: "minor",
    title: "Auditoría: agrupación de hooks (catálogos/configuración/portal), 3 services a folder/barrel y controller de NuevoClienteDialog",
    description: "Top 5 mejoras de la auditoría arquitectónica ejecutadas en un solo paso, sin breaking changes. (1) src/hooks/catalogos/ agrupa useNavieras, usePuertos, useTiposContenedor, useOperadoresDistintos, useTasaIVA y useExchangeRates con barrel index.ts. (2) src/hooks/configuracion/ agrupa useConfiguracion, useConfiguracionGlobal, useConfiguracionOrg y useConfiguracionState con barrel. (3) src/hooks/portal/ agrupa usePortalData, usePortalDashboardKpis y usePortalDocumentDownload con barrel. (4) Tres services críticos pasan al patrón folder/barrel: services/auth/, services/storage/ y services/csf/ con index.ts (los archivos antiguos services/authService.ts, services/storage.ts y services/csfService.ts quedan como shim de re-export para preservar todos los imports existentes). (5) NuevoClienteDialog (228 LOC, mezclaba estado del wizard, parsing CSF, validación, mutación y UI) se redujo a ~120 LOC presentacionales tras extraer toda la lógica al hook src/hooks/cliente/useNuevoClienteController.ts (~150 LOC). Todos los hooks raíz movidos quedan como shim de re-export desde su nueva ubicación, garantizando que ningún import de la app o tests se rompa. Build verde, 184/184 pruebas pasando.",
  },
  {
    version: "8.89.0",
    date: "2026-04-26",
    type: "patch",
    title: "Limpieza de tests obsoletos: -17 pruebas tautológicas, +1 regla en ARCHITECTURE",
    description: "Auditoría completa de los 25 archivos de test (201 pruebas) detectó cobertura redundante. Eliminados: src/test/example.test.ts (smoke-test trivial expect(true).toBe(true)), src/lib/__tests__/utils.test.ts (probaba cn() que es wrapper de clsx+tailwind-merge), src/constants/__tests__/proveedorConstants.test.ts (afirmaciones tautológicas sobre arrays literales), src/data/__tests__/ports.test.ts y src/data/ports.ts (catálogo migrado a BD desde v7.x; el archivo era seed sin consumidores). 6 tests tautológicos recortados de embarqueConstants.test.ts (afirmaciones sobre longitudes y miembros de ESTADOS_EMBARQUE / CATALOGO_CONCEPTOS); se conservan los 4 tests de getDocsForMode que sí cubren lógica condicional. Carpeta src/data/ eliminada por completo (sin contenido). ARCHITECTURE.md §11 actualizada con regla explícita 'no testear constantes literales ni wrappers de terceros' y §12 documenta la desaparición de src/data/. Resultado: 25 → 21 archivos de test, 201 → 184 pruebas, 100% pasando, sin pérdida de cobertura real (los 17 tests removidos eran tautologías o probaban librerías ajenas).",
  },
  {
    version: "8.88.0",
    date: "2026-04-26",
    type: "patch",
    title: "ARCHITECTURE.md reorganizado: TOC, naming, React Query, performance, RLS, testing y glosario",
    description: "Reescritura integral del documento de arquitectura para cerrar gaps de documentación detectados en la auditoría. Cambios: (Bloque 1) Cabecera con versión y fecha de revisión, referencia espejo a mem://technical/architecture-and-standards, tabla de contenidos con 14 secciones numeradas, nueva §2 'Flujo de datos canónico' con diagrama ASCII (Page → Hook → Service → Supabase → Mapper → Component), inclusión explícita de src/content/ separado de src/data/, sección dedicada para hooks de dominio. (Bloque 2) Nuevas secciones: §7 Naming (consolida patrones es/en + convenciones para hooks, controllers, tipos, componentes, services), §8 React Query (queryKeys centralizados, staleTime por tipo de dato, política de invalidación, paginación servidor), §9 Performance/Lazy-loading (páginas lazy, jsPDF dinámico, patrón changelog, regla >50KB), §10 RLS y multi-tenant (organization_id, user_roles, security definer, edge functions), §11 Testing (Vitest, qué se testea y qué no, ubicación __tests__/, comandos), §3.5 Controllers de página formalizados. (Bloque 3) Consolidación de 'Excepciones autorizadas' + 'Convención de barrels' + 'Auditoría useEffect' bajo §12 'Decisiones explícitas (con fecha)'; renombrado de 'Deuda técnica aceptada' a §13 'Decisiones de no hacer' añadiendo entrada de costosPLTypes.ts; corrección de referencia obsoleta en §6 (services/<dominio>Services.ts → services/<dominio>/index.ts); §14 Glosario con 12 términos del proyecto (embarque, expediente, cotización, proforma, concepto, P&L, CSF, incoterm, organización, cliente, operador, portal de clientes). El archivo crece de 125 a ~250 líneas pero gana navegabilidad y cubre los gaps reales de onboarding. Sin cambios de código fuente; build verde y 201/201 pruebas pasando.",
  },
  {
    version: "8.87.0",
    date: "2026-04-26",
    type: "minor",
    title: "Refactor arquitectónico Fase 3: lazy-load PDF y consolidación de tipos",
    description: "Pasos 8-10 del plan de auditoría arquitectónica integral. (8) Lazy-load de jsPDF: el generador @/generators/proformaPdf (que arrastra ~200KB de jsPDF + jspdf-autotable) ahora se carga vía dynamic import() en useDescargarProformaPdf y useDialogGenerarProformaController, eliminándolo del bundle inicial y dejándolo sólo en el chunk de la acción de descarga. cotizacionPdf ya estaba lazy desde antes. (9) Consolidación de tipos: se eliminó el re-export legacy src/hooks/cotizacion/useCotizacionTypes.ts y se migraron los 4 consumidores restantes (useCotizacionQueries, useCotizacionMutations, useCotizacionConversions, useCotizaciones, usePortalCotizacionDetalle) a importar directamente desde @/types/cotizacion. costosPLTypes.ts se conserva por contener el helper UI calcTotalsPL usado por SeccionCostosInternosPL{Local,Detalle}. (10) Se confirmó que la regla de shadcn read-only (use-toast.ts, use-mobile.tsx, sidebar.tsx) ya estaba documentada en ARCHITECTURE.md sección 3 + checklist. Build verde y 201/201 pruebas pasando.",
  },
  {
    version: "8.86.0",
    date: "2026-04-26",
    type: "minor",
    title: "Refactor arquitectónico Fase 2: barrels unificados, content/, AuthContext modular",
    description: "Pasos 4-7 del plan de auditoría arquitectónica integral. (4) Convención de barrels estandarizada en src/services/: los 5 barrel-archivo (clienteService, embarqueServices, adminServices, proformaServices, cotizacionServices) se eliminaron y su contenido se movió a index.ts dentro de cada carpeta de dominio. Naming homogéneo (singular, sin sufijo Service/Services). 30+ imports en hooks, componentes y páginas actualizados a la convención @/services/<dominio>. (5) Reorganización editorial: src/data/changelog/ y src/data/changelogData.ts movidos a src/content/changelog/ y src/content/changelogData.ts respectivamente. src/data/ queda reservado a datasets de dominio (ports.ts y su test). (6) AuthContext.tsx (212 LOC) dividido en 4 archivos: useAuthSession (sesión + listener Supabase, ignorando TOKEN_REFRESHED para no invalidar React Query cada 60s), useAuthProfile (perfil + roles + organización vía RPC get_user_context con cache TTL e in-flight de-dupe), useLoginAudit (registro de login en bitácora con guarda sessionStorage) y AuthContext.tsx como compositor delgado (~85 LOC). (7) Auditoría de los 30 useEffect activos: todos legítimos, agrupados en 5 categorías documentadas en ARCHITECTURE.md (sincronización form, listeners, hidratación wizards, hooks utilitarios, shadcn read-only). ARCHITECTURE.md actualizado con secciones 'Convención de barrels' y 'Auditoría de useEffect'. Build verde y 201/201 pruebas pasando.",
  },
  {
    version: "8.85.0",
    date: "2026-04-26",
    type: "minor",
    title: "Refactor arquitectónico Fase 1: lazy-load completo de changelog + controllers de página",
    description: "Paso 1-3 del plan de auditoría arquitectónica integral (post v8.84.0). (1) Se extrajo todo el contenido de recentChangelog (770 LOC, versiones 8.0.0 a 8.84.0) al archivo src/data/changelog/v8.ts, alineándolo con la convención v1-v7. El módulo changelogData.ts queda en ~30 LOC con sólo la entrada actual eager y carga dinámica del resto vía import(), reduciendo el chunk lazy de /changelog. (2) Se añadió a ARCHITECTURE.md la sección 'Excepciones autorizadas' que documenta que mappers en lib/mappers/ pueden importar `type Tables` de Supabase y que `import type` no constituye violación de capa. (3) Se aplicó useListPageState (hook genérico ya existente) en Clientes.tsx y Proveedores.tsx eliminando estado local duplicado de search/page/pageSize. (4) Se creó src/hooks/reportes/useReportesPageController.ts absorbiendo los 5 useState + 3 useMemo + 2 handlers de Reportes.tsx, dejando la página como composición pura de UI (~70 LOC). (5) Se creó src/hooks/cliente/useClienteDetalleController.ts absorbiendo los 4 useState + 7 mutations + 3 handlers de ClienteDetalle.tsx. Build verde y 201/201 pruebas pasando.",
  },
];

/** Carga perezosa del bloque v8 completo (todas las entradas previas a la actual). */
export async function loadChangelogV8(): Promise<ChangelogEntry[]> {
  const mod = await import("./changelog/v8");
  return mod.changelogV8;
}

/** Carga perezosa del changelog histórico (v7.x y anteriores). */
export async function loadLegacyChangelog(): Promise<ChangelogEntry[]> {
  const mod = await import("./changelog/legacy");
  return mod.legacyChangelog;
}

/** Compat: array completo solo si se necesita explícitamente (no recomendado). */
export const changelog = recentChangelog;
