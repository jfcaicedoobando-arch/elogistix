# Auditoría del CRM y plan para hacerlo tan simple como Salesforce

## Lo bueno (ya está resuelto)

El CRM es el módulo mejor factorizado de la app: Kanban con arrastrar y soltar, tabla con paginación real en servidor, atajos de teclado (`N`/`L`/`O`/`A`, paleta de comandos), creación rápida en popovers de 2 campos, edición en línea en el detalle del lead, plantillas de mensaje, importación CSV, acciones en lote de leads, trazabilidad lead → oportunidad → cotización → embarque, y ningún archivo por encima de 200 líneas. La brecha con Salesforce **no es de funciones**, es de **confianza en los datos** y de **fricción en el día a día**.

## Los 6 hallazgos confirmados

1. **Todas las oportunidades valen MXN 0.** Las 8 oportunidades de la base tienen `monto_estimado = 0`, `moneda = MXN` fija y `fecha_estimada_cierre` vacía. Cuando una cotización crea la oportunidad automáticamente, nunca copia el total ni la divisa de la cotización. Consecuencia: pipeline, ponderado, forecast, leaderboard y cuotas muestran ceros — el CRM parece roto aunque haya negocio real.
2. **Leads duplicados.** Hay 5 leads "Nova Trading" con el mismo correo, creados uno por cada cotización. La creación automática no busca si el lead ya existe. Esto también inunda "Mi día" con 5 veces la misma tarea "Contactar a Nova Trading".
3. **Oportunidades huérfanas de cliente.** Las 8 tienen `cliente_id` nulo aunque el negocio ya se convirtió en embarque; el panel Cliente 360 y los reportes por cliente quedan vacíos.
4. **El rol Gerente Comercial no puede leer el CRM.** Las políticas de base de datos de `crm_leads`, `crm_oportunidades` y `crm_actividades` sólo contemplan `admin`, `operador`, `super_admin`, `vendedor` y `viewer`. El menú y los selectores de vendedor sí ofrecen `gerente_comercial`, así que ese rol ve la pantalla vacía. Igual pasa con `admin_org`.
5. **Cuotas sin pantalla.** La tabla de cuotas por vendedor existe y alimenta el leaderboard, pero no hay dónde capturarlas: hoy sólo se pueden meter por SQL. Por eso el leaderboard muestra "0 %".
6. **Fricción de uso.** No hay vistas guardadas ("Mis oportunidades", "Cierran este mes"), no se puede editar monto/etapa/próximo paso desde la tarjeta del Kanban ni desde la tabla, no hay acciones en lote en oportunidades, la importación CSV no avisa de duplicados y el detalle se abre como página completa (se pierde el contexto de la lista).

## Fase 1 — Datos confiables (primero)

**F1.1 Herencia de datos desde la cotización.** Al crear/vincular la oportunidad desde una cotización, copiar total, divisa, cliente y fecha estimada de cierre; y re-sincronizar el monto cuando la cotización cambie de importe.

**F1.2 Deduplicación de leads.** Antes de crear un lead automático, buscar coincidencia por correo normalizado (y en su defecto por empresa) dentro de la organización; si existe, reutilizarlo. Índice único parcial por organización + correo para blindarlo a nivel de base.

**F1.3 Limpieza de lo existente.** Fusionar los 5 leads "Nova Trading" en uno (reapuntando sus oportunidades), y rellenar monto/divisa/cliente/fecha de las 8 oportunidades actuales desde su cotización ligada.

**F1.4 Acceso por rol.** Agregar `gerente_comercial` y `admin_org` a las políticas de leads/oportunidades/actividades (gerente ve toda la organización, no sólo lo propio) y añadir el caso al test de aislamiento multi-inquilino.

**F1.5 Alerta de duplicados en importación CSV.** Marcar en la vista previa las filas cuyo correo ya existe, con opción "omitir duplicados" o "actualizar existente".

## Fase 2 — Simplicidad tipo Salesforce

**F2.1 Vistas guardadas.** Chips fijos arriba de Leads y Oportunidades: "Mías", "Sin actividad > 7 días", "Cierran este mes", "Ganadas del mes"; más la posibilidad de guardar el filtro actual con nombre (por usuario).

**F2.2 Edición en línea.** Monto, probabilidad, fecha de cierre y vendedor editables desde la tarjeta del Kanban y desde la celda de la tabla, sin abrir el detalle.

**F2.3 Panel lateral de detalle.** Al hacer clic en una tarjeta/fila, abrir el detalle 360 en un panel deslizante sobre la lista (con enlace a la página completa), para no perder el pipeline de vista.

**F2.4 Siguiente paso obligatorio.** Al mover una tarjeta a otra etapa, pedir en un paso la próxima actividad (fecha + asunto), como el "Log a Call / Next Step" de Salesforce. Esto elimina el "Sin próxima acción" que hoy aparece en todas las tarjetas.

**F2.5 Acciones en lote en oportunidades.** Reasignar vendedor, mover etapa y marcar perdida con motivo, igual que ya existe en leads.

**F2.6 Pantalla de cuotas.** Sección en Configuración del CRM para capturar cuota mensual por vendedor, para que el leaderboard y el forecast tengan referencia.

**F2.7 Limpieza de "Mi día".** Agrupar las Next Best Actions por empresa/lead para no repetir la misma tarea, y ordenar por antigüedad de contacto.

## Detalles técnicos

- **Herencia de cotización**: extender `ProspectoData`/`VincularInput` en `src/features/crm/services/vincularCotizacion/` con `total`, `moneda`, `clienteId`, `fechaEstimadaCierre`; propagarlos a `crearOportunidad`. La re-sincronización de monto vive mejor como trigger sobre `cotizaciones` junto a `crm_cierra_oportunidad_desde_cotizacion`, para que también aplique a cambios hechos fuera de la UI.
- **Dedupe**: función auxiliar `buscarLeadPorEmail(orgId, email)` en `services/leads/queries.ts`, más índice único parcial `(organization_id, lower(email)) where email <> ''`. La fusión de duplicados existentes va como operación de datos puntual, no como migración de esquema.
- **RLS**: nueva migración con `DROP POLICY IF EXISTS` + recreación de las tres políticas "Staff CRUD" incluyendo `gerente_comercial` y `admin_org`; ampliar `supabase/tests/rls/test_rls_crm_operacional.sql`.
- **Vistas guardadas**: tabla `crm_vistas_guardadas` (usuario, entidad, filtros jsonb) con RLS por usuario/organización; los chips predefinidos se resuelven en cliente sobre los filtros que ya existen en `oportunidadesFiltersTypes.ts` y la URL (`nuqs`).
- **Panel lateral y edición en línea** se construyen con los componentes existentes (`Sheet`, `FormDialogShell`, `useNumericField`) para no crear lenguaje visual nuevo; se respeta el límite de 200 líneas por archivo extrayendo subcomponentes.
- **Pruebas**: unitarias de dominio para herencia de monto y dedupe, prueba de servicio para el vínculo cotización→oportunidad, prueba RLS para gerente comercial, y E2E de "crear oportunidad y moverla de etapa registrando próximo paso".
- Se registra todo en `CHANGELOG.md` con incremento de `APP_VERSION`.

## Fuera de alcance por ahora

Secuencias de correo multi-paso (cadencias automáticas) y notificaciones push/email reales: son un módulo aparte y conviene atacarlos cuando los datos del pipeline ya sean confiables.
