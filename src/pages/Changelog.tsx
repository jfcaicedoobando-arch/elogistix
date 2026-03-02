import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type ChangeType = "major" | "minor" | "patch";

interface ChangelogEntry {
  version: string;
  date: string;
  type: ChangeType;
  title: string;
  description: string;
}

const changelog: ChangelogEntry[] = [
  {
    version: "3.13.0",
    date: "2026-03-02",
    type: "minor",
    title: "Refactorización integral del código",
    description:
      "Consolidación de utilidades duplicadas: getEstadoColor unificado para todos los estados (embarque, cotización, factura), resolverContacto centralizado, interfaces ConceptoVentaLocal/ConceptoCostoLocal extraídas a conceptoTypes.ts, hook useConceptosForm reutilizable. Componentes SearchInput y PaginationControls extraídos y usados en 5+ páginas. Eliminación de ~20 casts 'as any' en CotizacionDetalle, código muerto de validaciones y variables abreviadas renombradas.",
  },
  {
    version: "3.12.5",
    date: "2026-03-02",
    type: "patch",
    title: "Validaciones obligatorias deshabilitadas temporalmente",
    description:
      "Se deshabilitaron temporalmente todas las validaciones de campos obligatorios en el wizard de creación de embarques (Paso 1 y Paso 2) para facilitar las pruebas durante el desarrollo.",
  },
  {
    version: "3.12.4",
    date: "2026-03-02",
    type: "patch",
    title: "Campo 'Carta garantía' para Marítimo FCL",
    description:
      "Nuevo campo dropdown 'Carta garantía' (Sí/No) en la sección de Ruta del formulario de cotizaciones, visible únicamente cuando el modo es Marítimo y el tipo de embarque es FCL. Persistido en la base de datos y mostrado en el detalle de la cotización.",
  },
  {
    version: "3.12.3",
    date: "2026-03-02",
    type: "patch",
    title: "Campo 'Días libres de almacenaje' para Marítimo LCL",
    description:
      "Nuevo campo numérico 'Días libres de almacenaje' en la sección de Ruta del formulario de cotizaciones, visible únicamente cuando el modo es Marítimo y el tipo de embarque es LCL. Persistido en la base de datos y mostrado en el detalle de la cotización cuando el valor es mayor a 0.",
  },
  {
    version: "3.12.2",
    date: "2026-03-02",
    type: "patch",
    title: "Campo 'Días libres en destino' para Marítimo FCL",
    description:
      "Nuevo campo numérico 'Días libres en destino' en la sección de Ruta del formulario de cotizaciones, visible únicamente cuando el modo es Marítimo y el tipo de embarque es FCL. Persistido en la base de datos y mostrado en el detalle de la cotización cuando el valor es mayor a 0.",
  },
  {
    version: "3.12.1",
    date: "2026-03-02",
    type: "patch",
    title: "Vigencia reemplazada por Validez de la Propuesta",
    description:
      "Se eliminó el campo manual 'Vigencia (días)' de la sección inferior del formulario de cotizaciones. La vigencia ahora se calcula automáticamente a partir de la fecha de 'Validez de la propuesta' seleccionada en la sección de Ruta. La Card se renombró a 'Notas Adicionales' y solo muestra el campo de notas.",
  },
  {
    version: "3.12.0",
    date: "2026-03-02",
    type: "minor",
    title: "Campos adicionales de ruta y seguro en cotizaciones",
    description:
      "Se agregaron 7 campos nuevos a la sección Ruta de cotizaciones: tiempo de tránsito (días), frecuencia (Diaria/Semanal/Quincenal), ruta de texto libre, validez de la propuesta (fecha), tipo de movimiento (CY-CY/CY-DR/DR-DR/DR-CY), seguro (toggle Sí/No) con valor en USD. El valor del seguro se suma automáticamente al total de la cotización. Campos visibles en detalle de cotización.",
  },
  {
    version: "3.11.0",
    date: "2026-03-02",
    type: "minor",
    title: "Autocompletado de puertos para carga marítima y multimodal",
    description:
      "Los campos de Origen y Destino en la sección Ruta ahora usan un buscador con autocompletado basado en un catálogo de ~150 puertos cuando el modo es Marítimo o Multimodal. Cada sugerencia muestra nombre del puerto, ciudad y país. Si el puerto no está en la lista, se permite escribirlo manualmente. Los flujos Aéreo y Terrestre conservan sus campos actuales sin cambios.",
  },
  {
    version: "3.10.0",
    date: "2026-03-02",
    type: "minor",
    title: "Sección de Mercancía Aérea con peso volumétrico",
    description:
      "Nueva sección de mercancía específica para carga aérea. Incluye tipo de carga, sector económico, descripción adicional, MSDS condicional y tabla dinámica de dimensiones con cálculo automático de peso volumétrico por fila (H×L×W×Pcs / 6000). Totales de piezas y peso volumétrico en kg. Datos persistidos en columna JSONB dimensiones_aereas.",
  },
  {
    version: "3.9.0",
    date: "2026-03-02",
    type: "minor",
    title: "Mercancía dinámica FCL/LCL para carga marítima",
    description:
      "Sección de mercancía en cotizaciones ahora se adapta dinámicamente al tipo de embarque marítimo. FCL muestra selector de contenedor (10 tipos), tipo de peso (Normal/Sobrepeso) y campos compartidos. LCL muestra tabla dinámica de dimensiones con cálculo automático de volumen m³ y totales. Para modos no marítimos se mantienen los campos estándar. Los datos se persisten en 6 nuevas columnas de la tabla cotizaciones.",
  },
  {
    version: "3.8.0",
    date: "2026-03-02",
    type: "minor",
    title: "Tipo de Carga y Descripción de Mercancía en Cotizaciones",
    description:
      "Nuevo dropdown de Tipo de Carga (Carga General / Mercancía Peligrosa) con campo condicional para subir hoja de seguridad MSDS. Descripción de mercancía reemplazada por dropdown con 9 categorías fijas: Automotriz, Médica, Alimentos, Carga Proyecto, Construcción, Industrial, General, Tecnología, Arte y Moda.",
  },
  {
    version: "3.7.0",
    date: "2026-03-02",
    type: "minor",
    title: "Flujo Prospecto/Cliente en Cotizaciones",
    description:
      "Nuevo flujo de destinatario al crear cotizaciones: cliente existente o prospecto (empresa, contacto, email, teléfono). Nuevo estado 'Aceptada' intermedio. Al aceptar, si es prospecto se puede convertir a cliente con formulario pre-llenado; luego se habilita 'Crear Embarque'. Registro completo en bitácora.",
  },
  {
    version: "3.6.0",
    date: "2026-03-02",
    type: "minor",
    title: "Módulo de Cotizaciones",
    description:
      "Nuevo módulo completo de cotizaciones con tabla independiente. Incluye listado con filtros y paginación, formulario simplificado para crear cotizaciones, detalle con conceptos de venta, y conversión automática a embarque al confirmar. Estados: Borrador, Enviada, Confirmada, Rechazada, Vencida. Registro en bitácora y folio auto-generado (COT-YYYY-NNNN).",
  },
  {
    version: "3.5.0",
    date: "2026-03-02",
    type: "minor",
    title: "Mejoras operativas: estado de embarques, edición de clientes, notas y confirmación de eliminación",
    description:
      "Nuevo botón 'Avanzar estado' en el detalle del embarque con confirmación y registro en bitácora. Edición de datos del cliente desde su página de detalle. Doble confirmación antes de eliminar contactos. Formulario para agregar notas libres en la pestaña de Notas del embarque con registro automático en bitácora.",
  },
  {
    version: "3.4.0",
    date: "2026-03-01",
    type: "minor",
    title: "Edición de embarques existentes",
    description:
      "Nueva página para editar embarques con wizard de 3 pasos (Datos Generales, Datos de Ruta, Costos y Pricing) pre-cargados con los valores actuales. Sincronización completa de conceptos de venta y costo. Registro automático en bitácora. Botón Editar conectado desde el detalle del embarque.",
  },
  {
    version: "3.3.1",
    date: "2026-03-01",
    type: "patch",
    title: "Suite de tests unitarios y de integración",
    description:
      "44 tests en 11 archivos cubriendo helpers (formatDate, getEstadoColor, getModoIcon), formatters (formatCurrency), utils (cn), constantes de embarque/proveedor/contenedores/puertos/navieras, componente BitacoraActividad y hook usePermissions.",
  },
  {
    version: "3.3.0",
    date: "2026-03-01",
    type: "minor",
    title: "Sistema de Bitácora y Actividad",
    description:
      "Nueva tabla centralizada bitacora_actividad para registrar todas las acciones de usuarios. Hook useBitacora con consultas filtradas y registro automático. Componente BitacoraActividad como timeline visual. Página dedicada /bitacora con paginación y filtros por módulo. Widget de actividad reciente en Dashboard. Registro automático al crear embarques, clientes, proveedores, subir documentos e iniciar sesión.",
  },
  {
    version: "3.2.0",
    date: "2026-03-01",
    type: "minor",
    title: "Renombramiento de variables para mayor claridad",
    description:
      "Todas las variables de 1-2 letras y abreviaciones ambiguas fueron reemplazadas por nombres descriptivos en 22 archivos. Ejemplos: e→embarque, f→factura, qc→queryClient, tc→tipoCambio, le→cargandoEmbarques, cv→venta, cc→costo, prov→proveedor, [y,m,d]→[anio,mes,dia]. El código ahora es legible sin necesidad de contexto adicional.",
  },
  {
    version: "3.1.0",
    date: "2026-03-01",
    type: "minor",
    title: "Refactorización — Limpieza, deduplicación y modularización",
    description:
      "Eliminación de funciones helper duplicadas (getModoIcon, getEstadoColor, formatDate) en favor de las centralizadas en helpers.ts. Hook useContactosCliente deduplicado. Constantes de proveedor extraídas a proveedorConstants.ts. NuevoEmbarque dividido en 5 sub-componentes (StepDatosGenerales, StepDatosRuta, StepDocumentos, StepCostosPrecios, StepIndicator). EmbarqueDetalle dividido en 5 tabs (TabResumen, TabDocumentos, TabCostos, TabFacturacion, TabNotas). Eliminados componentes sin usar (TableSkeleton, ErrorState) y variable muerta fileInputRef.",
  },
  {
    version: "3.0.0",
    date: "2026-03-01",
    type: "major",
    title: "Fases 3 y 4 — Permisos, búsqueda, storage, responsive y tipos de cambio",
    description:
      "Permisos por rol en toda la UI (viewers solo lectura). Emails reales en gestión de usuarios. Subida de documentos al storage con descarga. Búsqueda global (Ctrl+K) en embarques, clientes, proveedores y facturas. Componentes reutilizables TableSkeleton y ErrorState. Tipos de cambio dinámicos desde API externa. Versión actualizada a v3.0.0.",
  },
  {
    version: "2.0.0",
    date: "2026-03-01",
    type: "major",
    title: "Migración completa a base de datos y limpieza de código",
    description:
      "Todos los módulos (Facturación, Dashboard, Reportes) ahora usan datos reales de la BD. Se eliminó mockData.ts y archivos obsoletos. KPIs, gráficas y alertas son dinámicos. Liquidación de gastos funcional con acción de marcar pagado.",
  },
  {
    version: "1.7.0",
    date: "2026-03-01",
    type: "minor",
    title: "Módulo de Embarques conectado a base de datos",
    description:
      "El listado, detalle y creación de embarques ahora persisten en la base de datos real. Se incluyen subentidades (conceptos de venta/costo, documentos, notas) y se eliminó la dependencia de mockData para embarques.",
  },
  {
    version: "1.6.0",
    date: "2026-02-28",
    type: "minor",
    title: "Módulo de Proveedores conectado a base de datos",
    description:
      "El listado, detalle, creación y edición de proveedores ahora persisten en la base de datos real con react-query. Se eliminó el store en memoria y se agregaron estados de carga.",
  },
  {
    version: "1.5.1",
    date: "2026-02-28",
    type: "patch",
    title: "Módulo de Clientes conectado a base de datos",
    description:
      "El listado de clientes, creación de nuevos clientes y gestión de contactos (CRUD) ahora persisten en la base de datos real. Se eliminó la dependencia de datos mock para este módulo.",
  },
  {
    version: "1.5.0",
    date: "2026-02-28",
    type: "minor",
    title: "Esquema de base de datos para entidades core",
    description:
      "Se crearon las tablas clientes, proveedores, embarques, facturas y sus subtablas relacionales (contactos, conceptos de venta/costo, documentos, notas) con políticas RLS por rol, triggers de updated_at e índices de rendimiento.",
  },
  {
    version: "1.4.1",
    date: "2026-02-28",
    type: "patch",
    title: "Alta de usuarios desde el panel de administración",
    description:
      "Los administradores ahora pueden registrar nuevos usuarios directamente desde el módulo de Gestión de Usuarios, asignando email, contraseña y rol.",
  },
  {
    version: "1.4.0",
    date: "2026-02-28",
    type: "minor",
    title: "Módulo de usuarios con login y roles",
    description:
      "Sistema de autenticación con login/registro, gestión de roles (admin, operador, viewer), protección de rutas por rol y página de administración de usuarios.",
  },
  {
    version: "1.3.2",
    date: "2026-02-28",
    type: "patch",
    title: "Pricing simplificado",
    description:
      "Se eliminaron las líneas de IVA (16%) y Total (Con IVA) en el paso de Costos y Pricing. Ahora solo se muestra el Subtotal (Sin IVA) como entrada manual.",
  },
  {
    version: "1.3.1",
    date: "2026-02-27",
    type: "patch",
    title: "Dropdowns de conceptos marítimos",
    description:
      'Se agregaron opciones predefinidas "Flete marítimo" y "Revalidación" en los campos de concepto cuando el modo de transporte es Marítimo.',
  },
  {
    version: "1.3.0",
    date: "2026-02-26",
    type: "minor",
    title: "Costos y Pricing dinámico",
    description:
      "Nuevo paso en el wizard de embarque con filas dinámicas para conceptos de venta y costos. Incluye agregar/eliminar filas, cálculo de subtotal y utilidad estimada.",
  },
  {
    version: "1.2.1",
    date: "2026-02-25",
    type: "patch",
    title: "Validación de ruta marítima",
    description:
      "Todos los campos del paso 2 (Datos de Ruta) son obligatorios para embarques marítimos, excepto BL Master y BL House.",
  },
  {
    version: "1.2.0",
    date: "2026-02-24",
    type: "minor",
    title: "Wizard de Nuevo Embarque",
    description:
      "Formulario de 4 pasos para crear embarques: Datos Generales, Datos de Ruta, Documentos y Costos y Pricing. Incluye selectores de puertos, navieras y tipos de contenedor.",
  },
  {
    version: "1.1.0",
    date: "2026-02-20",
    type: "minor",
    title: "Wizard de Nuevo Cliente",
    description:
      "Diálogo de dos pasos para crear clientes. Requiere carga obligatoria de documentos (CIF, opinión fiscal, acta constitutiva, etc.) antes de guardar.",
  },
  {
    version: "1.0.0",
    date: "2026-02-15",
    type: "major",
    title: "Lanzamiento inicial",
    description:
      "Dashboard con KPIs y gráficas, listado y detalle de embarques, módulo de facturación, módulo de clientes con vista detalle, módulo de proveedores con CRUD completo, página de reportes y navegación lateral.",
  },
];

const typeConfig: Record<ChangeType, { label: string; className: string }> = {
  major: { label: "Major", className: "bg-destructive text-destructive-foreground" },
  minor: { label: "Minor", className: "bg-info text-info-foreground" },
  patch: { label: "Patch", className: "bg-muted text-muted-foreground" },
};

export default function Changelog() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Changelog</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Historial de cambios y nuevas funcionalidades de la plataforma.
        </p>
      </div>

      <div className="relative border-l-2 border-border ml-4 space-y-6 pl-8">
        {changelog.map((entry) => {
          const config = typeConfig[entry.type];
          return (
            <div key={entry.version} className="relative">
              {/* Timeline dot */}
              <div className="absolute -left-[calc(2rem+5px)] top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" />

              <Card>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono font-bold text-sm">v{entry.version}</span>
                    <Badge className={config.className}>{config.label}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{entry.date}</span>
                  </div>
                  <h3 className="font-semibold">{entry.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{entry.description}</p>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
