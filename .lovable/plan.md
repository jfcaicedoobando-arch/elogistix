# Plan: Bug bash live · Waves 8-10

44 hallazgos (28 MEDIA + 16 BAJA). Los agrupo por **familia técnica** para atacar la causa raíz común, no bug por bug. Cada ola es shippeable e independiente.

## Ola 8 · Dinero y KPIs correctos (alta rentabilidad UX)

Ataca los bugs donde el número en pantalla miente al usuario.

- **B-019** — `PorVencer 0d`: el cálculo de días en el badge de cartera usa fecha mal parseada; unificar con `dateUtils.diasEntre`. Además revisar el default del filtro "Accionable ≤7d" para excluir "0d".
- **B-020** — KPI `Vencido $0` vs gráfica de aging: refactorizar `clasificar()` en `proveedorFacturas.helpers.ts` para que evalúe vencimiento **antes** de "Por aprobar", y que `calcularKPIsCxP` sume vencido por fecha (no por estatus).
- **B-022** — P&L "Sin datos": extender RPC `pnl_financiero_embarque` para devolver `por_concepto` y `por_concepto_costo` agregando desde `conceptos_venta` y `conceptos_costo`.
- **B-033** — Dashboard cuenta Borradores como activos: modificar `dashboard_stats()` para excluir `estado='Borrador'` del CTE `activos`.
- **B-036** — Listado cotizaciones con `subtotal`/`moneda` stale: dejar de leer las columnas viejas; calcular en la RPC de listado desde `conceptos_venta` (misma fuente que el detalle).
- **B-040** — Folio duplicado con MAX+1 lexicográfico: reemplazar `duplicar_cotizacion` para que use `siguiente_folio_cotizacion` atómica (mismo helper de crear).
- **B-053** — `formatCurrency` negativos: ya se tocó en Wave 6 pero reporta persistir en P&L; verificar filas y unificar.

## Ola 9 · Validaciones espejo + error→mensaje humano

Cura los "error crudo de Postgres" bajando validación a la UI y traduciendo errores restantes con `mapPostgresError`.

- **B-023** — Alta cliente RFC: validar RFC (regex SAT) en step 1 con Zod; conservar documentos adjuntos al retroceder (mover state fuera del step); limpiar huérfanos de storage.
- **B-024** — Email cliente NULLable: hacerlo opcional en BD (`ALTER TABLE clientes ALTER COLUMN email DROP NOT NULL`) — la UI ya lo trata como opcional.
- **B-025** — CLABE dígito verificador: implementar módulo-10 ABM en `validaciones/clabe.ts` y aplicar en Zod del form de cuentas.
- **B-026** — ETA anterior a ETD: validar en cliente (Zod cross-field) antes de submit; traducir el check constraint restante con `mapPostgresError`.
- **B-027** — Borrador→Confirmado sin datos: agregar Zod pre-transición en `avanzar_estado_embarque` invocador (peso>0, ≥1 contenedor, BL Master no vacío, naviera, shipper/consignatario).
- **B-045** — `%.2f` literal en RAISE: patchear 3 migraciones (usar `%s` + `to_char`).
- **B-061** — Zod se traga silenciosamente en anticipos: adjuntar handler de rechazo en `handleSubmit` que llame `notifyValidationError`; auditar `AplicarAnticipoDialog` con mismo patrón.

## Ola 10 · Flujos rotos + estados + seeds

Desatasca los callejones sin salida.

- **B-028 + B-031 + B-063** — Marítimo bloqueado: seed catálogo `tipos_contenedor` (INSERT idempotente con los 12 tipos hardcodeados actuales); unificar dropdown "Buscar tarifa" a leer de esa tabla; agregar interfaz admin en Configuración → Catálogos.
- **B-021** — `organization_members` UNIQUE(user_id): decidir con el usuario si el diseño target es multi-org (drop UNIQUE) o single-org (limpiar OrgSwitcher/get_user_org_ids). **Requiere confirmación del usuario antes de tocar.**
- **B-030** — Bandeja pagos programados: revisar filtros implícitos, exponer estado/ventana como toggles visibles.
- **B-032** — `seed_demo_organization()` sin CxP: extender el seed con 8-10 facturas de proveedor, 3-4 pagos, 2 anticipos, 1 NC.
- **B-034** — Oportunidad "Ganada": al marcar ganada pedir `fecha_cierre_real`, `valor_real`, `cotizacion_ganadora_id` (dialog con Zod).
- **B-035** — `descripcion_mercancia` toma Sector Económico: agregar campo "Descripción de la mercancía" real en la UI; ajustar mapper.
- **B-037** — Diálogo pago CxP stale: refetch al abrir el dialog (`queryClient.invalidateQueries` + `enabled` gate).
- **B-038** — DateInput descarta fecha tecleada: en `DatePickerMx` fallback silencioso reemplazado por error inline.
- **B-039** — Cambio de estado triplicado: consolidar bitácora+nota+evento en una sola entrada del feed con tres etiquetas.

## Ola 11 · UX/copy/cosméticos (barrido corto)

Todos los baratos en una sola pasada.

- **B-029** — Importación CSV bancario: agregar mapeo de columnas visual (fuera de scope si es grande; mínimo: validación con mensaje claro cuando el layout no coincide).
- **B-041** — Toasts wizard cotización: quitar `successTitle` automático de `useCotizacionMutations`; dejar solo el toast manual del handler.
- **B-042** — JSON crudo en checklist: renderizar `detalle` con formatter humano por tipo de ítem.
- **B-043** — Errores en inglés: envolver invocación de Edge Functions con `mapEdgeError` que traduce mensajes conocidos.
- **B-044** — Documentos cliente teatrales: **decisión requerida** — o persistir a storage con RLS, o remover el requisito bloqueante. Verificar primero si ya persiste en staging (report contradictorio).
- **B-046** — React Query Devtools en prod: condicionar por `import.meta.env.DEV`.
- **B-047** — "Cargando…" con 0 embarques: empty-state cuando `!isLoading && rows.length===0`.
- **B-048** — "MXN: MXN": deduplicar prefijo en resumen.
- **B-049** — Proforma dos estados: unificar fuente (usar `estado_cliente` en ambos lados).
- **B-050** — Title-case destructivo: usar `toTitleCase` con lista de siglas ya extendida en Wave 5.
- **B-051** — Toggles IVA proforma apagados: sincronizar visual con `incluye_iva`.
- **B-052** — Toasts wizard sin dismiss: `toast.dismiss()` antes de emitir el siguiente error del mismo tipo, o usar `id` estable.
- **B-054** — Kanban sobrescribe probabilidad: preguntar con confirm antes de aplicar default de etapa.
- **B-055** — Actividades vencidas: badge "Vencida" distinto + `listActividadesVencidas` filtra también por email/creado_por.
- **B-056** — Póliza seguro silenciosa: Zod con inline errors (prima≥0, vigencia_hasta≥desde).
- **B-057** — "Ajuste neto Ahorro": ya tocado en Wave 6; verificar edge case restante.
- **B-058** — Menú "…" en Entregado: ocultar "Eliminar"; agregar transición "Cancelar" a la máquina de estados si aplica.
- **B-059** — NC "Sesión no válida": reproducir en cloud; si aplica, degradar `getUser()` a `getSession()`.
- **B-062** — GlobalSearch por `folio_interno`: agregar `folio_interno` a `busqueda_global` RPC (unión ILIKE) además de `folio_proveedor`.
- **Observación CSV Aging CxP** — agregar fila de totales al final del CSV.

## Preguntas para el usuario antes de arrancar

1. **B-021** (multi-org): ¿El diseño target es **multi-org** (un usuario en varias organizaciones a la vez) o **single-org** (un usuario ↔ una org, `OrgSwitcher` sólo para super_admin impersonando)? La respuesta define si dropeamos el UNIQUE o simplificamos el código.  un usuario no puede pertenecer a mas de 1 org.
2. **B-044** (docs cliente): ¿Verificamos primero en staging si los archivos SÍ se están subiendo, o asumimos "no persisten" y agregamos la persistencia? No lo se.
3. **Orden**: ¿arranco Ola 8 completa, o prefieres que primero haga las 3 quick-wins de dinero (B-019, B-020, B-022) y valides antes de seguir?Ho,a completa

## Detalles técnicos (para referencia)

- Cambios de schema (RPCs y catálogos) → migraciones en el mismo turno.
- Todos los nuevos toasts pasan por `appFeedback` (regla vigente).
- Cada ola cierra con: `bump APP_VERSION`, entrada al CHANGELOG.md con analogía, y verificación puntual (lint/tests si aplica).
- Estimado: Ola 8 ≈ 7 fixes, Ola 9 ≈ 7, Ola 10 ≈ 8, Ola 11 ≈ 20 (cosméticos). Total 42 (B-021 y B-044 esperan respuesta).

## Estado acumulado tras waves 1-7

27/63 cerrados. Este plan cierra hasta 42 más → objetivo 69/63 (incluye los 3 diferidos B-006/B-010/B-011 que quedan como QW dedicados, no entran acá).