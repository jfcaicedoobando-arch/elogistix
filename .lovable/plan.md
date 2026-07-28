## Objetivo

Verificar, uno por uno, los 49 puntos del documento (REG B-001, REG B-004, REG B-016 y B-064…B-106) contra el código y la base de datos reales, y entregar un reporte de estado. **Sin modificar código.**

Contexto verificado antes de este plan: el archivo subido es byte-idéntico (md5 `73fb1ce9…`) al ejecutado la sesión pasada; `APP_VERSION` está en `13.321.0` y hay 5 migraciones nuevas del 28/07 (`20260728195103` … `20260728195844`) más las del bloque previo.

## Método de verificación

Cada ítem se clasifica como **APLICADO**, **PARCIAL**, **NO APLICADO** o **NO VERIFICABLE** (requiere staging/E2E), con la evidencia concreta que lo respalda.

### Grupo A — Base de datos (REG B-001, REG B-016, B-064…B-067, B-069…B-073, B-079, B-080, B-084, B-085, B-090, B-096, B-098)
Consultas de solo lectura contra el backend:
- `pg_proc`: existencia, firma única (sin overloads huérfanos) y cuerpo actual de `duplicar_cotizacion`, `agente_aprobar_tarifa`, `get_top_tarifas`, `crear_embarque_borrador_core`, `actualizar_cotizacion_costos`, `revalidar_tarifa_cotizacion`, `current_agente_id`, `current_agente_org`, `get_current_agente_context`.
- `pg_policies`: policies de las 27 tablas del soft delete (REG B-001), las 3 policies revertidas del agente (B-069), las de `costeo_agentes` (B-070) y las de `storage.objects` del bucket de cartas garantía (B-085).
- `pg_trigger` + definición: trigger de reemplazo de tarifas (B-067/B-072), trigger de estado `vencida` (B-079), validación de tramos solapados (B-096).
- Definición de la vista `costeo_tarifas_vigentes_v` (B-071, B-080).
- Contraste con el SQL "esperado" del documento para detectar divergencias reales, no sólo presencia del objeto.

### Grupo B — Frontend (B-074, B-075, B-081…B-083, B-086…B-089, B-091…B-095, B-097, B-099…B-106)
- Lectura dirigida de los archivos citados por cada FIX (wizard de cotización, `PortalCotizaciones`, `PortalFacturaDetalle`, `PortalEmbarqueResumenTab`, `AgenteTarifas`, KPIs del portal agente, menú "+ Nuevo" del CRM).
- Verificación de que existe y se usa `src/lib/date/dateOnly.ts` en los puntos de B-089/B-103, y que no quedan `new Date(fechaDateOnly)` sin normalizar en esas rutas.
- Búsqueda de los símbolos/campos que cada fix exige (p. ej. `lcl_tarifa_wm`/`lcl_minimo_flete` en el INSERT de B-092, override → regeneración de conceptos en B-074, margen LCL en B-075).

### Grupo C — Cobertura de pruebas
- Identificar cuáles de los fixes tienen test asociado (unitario, RLS `.sql` o E2E) y cuáles quedaron sin red de seguridad — esto es lo que hace que un fix "aplicado" pueda regresar, como pasó con REG B-001 y REG B-016.

## Entregable

Una tabla en el chat: `ID | Estado | Evidencia | Riesgo`, ordenada por severidad, seguida de:
1. Lista corta de ítems NO APLICADOS o PARCIALES, con lo que falta exactamente.
2. Lista de ítems sin test de regresión.
3. Recomendación de siguiente ola de trabajo (que se ejecutaría sólo si lo apruebas después).

## Notas técnicas

- La auditoría es de solo lectura: `supabase--read_query`, `rg` y lectura de archivos. Ninguna migración, ningún `write`.
- Los ítems marcados CONDICIONAL en el documento (B-078, y parcialmente B-104) sólo pueden confirmarse en staging con sesión de agente real; se reportarán como NO VERIFICABLE con el chequeo estático que sí se pueda hacer.
- No se modificará `CHANGELOG.md` ni `APP_VERSION`, ya que no hay cambio funcional.
