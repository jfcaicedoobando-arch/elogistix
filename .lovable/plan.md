## Verificación previa (hecha contra el HEAD y la base real)


| Fix    | Afirmación del documento                                                                       | Resultado de la verificación                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | `eliminar_embarque_completo` es SECURITY DEFINER, con GRANT a `authenticated` y sin `has_role` | **Confirmado**. La función existe, es `prosecdef = true`, tiene EXECUTE para `authenticated` y `service_role`, y su cuerpo no contiene ninguna llamada a `has_role`                                                                                                                                                                                                                                       |
| **C2** | Las edge functions `facturapi-*` no validan rol                                                | **Confirmado**. Ninguna de las 13 funciones `facturapi-*` menciona `has_role` / rol; sólo resuelven `auth.getUser()` y la API key por org (`_shared/facturapiAuth.ts`)                                                                                                                                                                                                                                    |
| **C3** | Pantallas de dinero expuestas al truncado de 1000 filas                                        | **Parcialmente confirmado**. No existe `assertNotTruncated` ni configuración `[api] max_rows`. Ver advertencia abajo sobre `config.toml`                                                                                                                                                                                                                                                                  |
| **C4** | Totales de dinero calculados en cliente                                                        | **Confirmado** en los tres archivos citados (factura manual, conceptos de cotización, CxP)                                                                                                                                                                                                                                                                                                                |
| **C5** | 6 RPCs listan/agregan filas soft-deleted                                                       | **Confirmado en base**: `embarques_listado`, `facturas_listado`, `dashboard_details`, `sidebar_alert_counts`, `operaciones_stats`, `profit_por_cliente` no mencionan `deleted_at`. También confirmado que `profit_por_embarque` **sí** filtra (no se toca). `dashboard_summary` y `embarques_list_extras` sí lo mencionan → el hueco ahí es parcial, hay que revisar caso por caso antes de reescribirlas |
| **C6** | 6 implementaciones divergentes de conversión a MXN                                             | **Confirmado**. Los 6 archivos existen con las políticas divergentes descritas; `src/lib/financial/tcValido.ts` ya existe y `src/lib/financial/convertir.ts` todavía no                                                                                                                                                                                                                                   |


### Dos desviaciones respecto al documento

1. **C3a — no se puede tocar `supabase/config.toml`.** En este proyecto el archivo lo administra la plataforma; agregar `[api] max_rows` ahí se perdería o rompería la sincronización. El objetivo de C3 se cubre igual con C3b (guarda de truncado en cliente) y C3c (agregados en SQL), que son los que realmente eliminan el riesgo.
2. **C5 — `dashboard_summary` / `embarques_list_extras**` ya filtran parcialmente; se revisará el cuerpo vigente antes de reemplazarlas para no perder lógica.

## Plan de aplicación (por etapas, verificando entre cada una)

**Etapa 1 — Seguridad pura (bajo riesgo, sin cambios visibles de datos)**

- C1: migración `20260730000001` con `CREATE OR REPLACE` de `eliminar_embarque_completo`, conservando cuerpo y firma vigentes, añadiendo guard de rol (`has_role`) y comparación de `organization_id`. Gatear también el botón en `EmbarqueDetalleHeaderActions.tsx`.
- C2: chequeo de rol fiscal en las edge functions `facturapi-*`, extraído a un helper compartido para no repetirlo 13 veces.
- Verificación: test pgTAP en `supabase/tests/rls/` (rol sin permiso y tenant ajeno reciben error) + `deno test` de las edge functions.

**Etapa 2 — Datos fantasma (C5)**

- Migración `20260730000003` recreando las 6 RPCs con `deleted_at IS NULL`, respetando firma y tipo de retorno exactos; revisión previa del cuerpo vigente de `dashboard_summary` y `embarques_list_extras`.
- Verificación: test de regresión que inserta embarque + factura, los soft-borra y asegura que ninguna de las RPCs los devuelve ni los suma.

**Etapa 3 — Truncado (C3b + C3c)**

- `assertNotTruncated` en cliente + migración con las 5 RPCs agregadoras, y migración de las pantallas de dinero a esas RPCs.
- Sin cambios en `config.toml`.

**Etapa 4 — Totales server-side (C4)** — la más delicada

- Migración `20260730000002` (C4a/C4b/C4c) con triggers, CHECKs `NOT VALID` y backfill.
- Antes del backfill: consulta de impacto que liste cuántas facturas/cotizaciones/CxP cambian de valor y en cuánto, para revisarla contigo. Sólo después se aplica.

**Etapa 5 — Canon de conversión (C6)**

- Nuevo `src/lib/financial/convertir.ts` + migración de los 6 call sites + guardrail ESLint/test de arquitectura. Se omite el diff sobre `dashboardEjecutivo.ts` si la Etapa 3 ya lo eliminó.

## Cierre

- Regenerar `types.ts` tras las migraciones.
- `bun run lint --max-warnings 0`, suite de tests, tests de arquitectura y suite RLS al final de cada etapa.
- `CHANGELOG.md` + `APP_VERSION` por etapa.

## Detalle técnico

Las migraciones usan `CREATE OR REPLACE` conservando firma y retorno; donde el retorno cambia se requiere `DROP FUNCTION` explícito (caso `embarques_listado`), lo que obliga a re-emitir el `GRANT EXECUTE` en la misma migración. Todos los CHECK nuevos van `NOT VALID` para no bloquear el deploy con datos legacy.

Nota: `.lovable/` está en tu `.gitignore`, así que este plan no se versiona. ¿Quieres que lo quite para que los planes persistan? Tu escoge que es la mejor practica