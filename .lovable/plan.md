## Objetivo

Aplicar el paquete completo de `instrucciones-lovable-portales-2026-07-28.md`: 3 regresiones (REG B-001, B-004, B-016) + 43 bugs (B-064…B-106) de portales, costeo/tarifario y facturación, en el orden de olas que propone el propio documento (SQL antes que el frontend que lo consume).

## Ola 1 — Seguridad y dinero crítico

- **REG B-001** · Migración DROP-only de las 27 policies `Hide soft deleted %` restrictivas + las 3 del patrón `pagos_factura`/`proveedor_facturas`. Desbloquea el soft delete (42501).
- **REG B-016** · `duplicar_cotizacion` rota por columna inexistente `tipo_cambio_usd`.
- **B-065** · `get_top_tarifas` sin validación de membresía (fuga cross-tenant).
- **B-069** · Revertir 3 policies que dejan al agente leer pricing/facturas del cliente.
- **B-064** · Conversión cotización→embarque multiplicaba el costo por N contenedores.
- **B-068 + B-076** · "Facturación Pendiente" con saldo real por moneda (fuente única = estado de cuenta).
- **B-077** · `monto_no_aplicado` multi-moneda → "Saldo a favor" fantasma.

## Ola 2 — Desbloquear pipeline tarifario

B-066 (`agente_aprobar_tarifa` + overload huérfano PGRST203), B-067 + B-072 (trigger de reemplazo por naviera validando NEW), B-071 (vista de tarifa vigente ignoraba `p_fecha`), B-079 (estado `vencida` derivado), B-080 (agente desactivado fuera del Top-3), B-089 (parseo de fechas date-only, off-by-one TZ México — frontend).

## Ola 3 — Vínculos y márgenes

B-073 (persistir linkage tarifa↔cotización), B-074 (override deja la cotización sin conceptos de venta), B-075 (LCL vendido a costo), B-084 (policy por nombre en texto), B-092 (`lcl_tarifa_wm` / `lcl_minimo_flete` no persistidos), REG B-004 (menú "+ Nuevo" del CRM vacío).

## Ola 4 — Portales completos y pulido

B-070 (portal agente roto por EXISTS sobre `costeo_agentes`), B-078 (contexto "No autenticado" — CONDICIONAL), B-081+B-093+B-101, B-082, B-083+B-106, B-085, B-086+B-095, B-087+B-094, B-088, B-090, B-091, B-096, B-097, B-098, B-099, B-100, B-102, B-103, B-104, B-105.

## Detalles técnicos

- Las migraciones se emiten con timestamps nuevos y crecientes, idempotentes (`DROP POLICY IF EXISTS`, `CREATE OR REPLACE`), respetando H4/H6 (`search_path`, `SECURITY DEFINER` justificado, GRANTs por tabla nueva).
- Tras cada ola: `bun run lint --max-warnings 0`, tests unitarios afectados, `audit:migrations` y `tsc`. No avanzo a la ola siguiente si algo queda en rojo.
- Cada ola bumpea `APP_VERSION` y agrega su bloque en `CHANGELOG.md` (raíz) con los IDs de bug.
- Se añaden/actualizan tests de regresión donde el fix es lógica pura (fechas date-only, ranking Top-3, saldo con notas de crédito, cuadre multi-moneda) y tests RLS para B-065, B-069, B-070, B-085.

## Punto que requiere tu visto bueno

**REG B-001** elimina las policies RLS que ocultaban registros borrados. El documento demuestra que en PostgreSQL no se puede tener a la vez "ocultar por RLS" y "soft delete por UPDATE". Tras el cambio, los borrados quedan protegidos sólo por las policies de tenant y ocultos por los ~91 filtros `.is('deleted_at', null)` de la aplicación. Es la opción correcta pero traslada el ocultamiento a la capa de app; lo aplico salvo que prefieras otra ruta. Si, aplica.