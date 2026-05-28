# Estabilización para cierre de 12.0.0

Objetivo: Pasar de `12.0.0-rc.17` a `12.0.0` final con un único rc de estabilización (`rc.18`) que deje el major listo, sin agregar features.

## Alcance

Sólo limpieza, documentación y verificaciones automáticas. No nuevas funcionalidades. No smoke test manual (queda bajo responsabilidad del usuario).

## Pasos

### 1. Revisión de pendientes de auditoría

Revisar `mem://audit/pendings` y clasificar cada item abierto en:
- **Bloqueante para 12.0.0** → se aborda en rc.18.
- **Diferido a 12.x** → se documenta explícitamente como deuda asumida.

Estado actual conocido: Bloque A cerrado. Pendientes son cosméticos (B6, B7, C9-C11, D12) + previos (P1.5-1.7, refactor complejidad, P3.13-16, edge functions). Propuesta: **todos diferidos a 12.x**, ninguno bloquea el major. Sólo se actualiza el archivo de pendings para reflejar el corte de versión.

### 2. Linter de Supabase

Ejecutar `supabase--linter`. Resolver únicamente hallazgos `ERROR` o `WARN` de seguridad (RLS, search_path, security definer). Hallazgos `INFO` se difieren.

### 3. Changelog consolidado 12.0.0

Editar `CHANGELOG.md` (root) agregando un bloque nuevo `## [12.0.0] - YYYY-MM-DD` **arriba** de los rc.x, con un resumen narrativo agrupado por área:

- **CRM ↔ Cotizaciones**: vincular/crear prospecto, mapeo de etapas, propagación a cliente.
- **Embarques**: ciclo 7 estados, timeline automático, alertas demurrage, liquidación, docs.
- **Multi-tenant**: impersonación, demo readonly, unified user management, unified login.
- **Portal de cliente**: RPCs seguros, layout limpio.
- **Dashboard operativo**: categorías de riesgo, alerts sidebar.
- **Cotizaciones**: wizard, prospectos, incoterms estándar, conversión a embarque.
- **Auditoría arquitectónica**: Power of 10, storage RLS, browser storage wrapper, baseline de imports.
- **Infraestructura**: tipos de cambio dinámicos, paginación servidor, estandarización de tablas, chunk load recovery.

No se eliminan los bloques `rc.1` a `rc.18`; quedan como historial.

### 4. Bump de versión

`src/constants/appVersion.ts`: `12.0.0-rc.17` → `12.0.0-rc.18` durante el trabajo, y al final del rc.18 → `12.0.0` (sin sufijo). Cada bump con su entrada en `CHANGELOG.md`.

### 5. Actualización de memorias

Revisar el índice `mem://index.md` y abrir cualquier memoria potencialmente desactualizada por los cambios CRM-Cotización (`mem://features/cotizacion-crm-integration` si existe, `mem://features/standard-incoterms`, `mem://features/multi-tenant-architecture`). Sólo corrección, no expansión.

## Fuera de alcance

- Smoke test manual del flujo CRM ↔ Cotización (lo hace el usuario).
- Cualquier feature nueva.
- Refactors de los pendientes B/C/D y P1.x (se difieren a 12.x).
- Cambios visuales.

## Entregables

1. `supabase--linter` sin errores de seguridad.
2. `CHANGELOG.md` con bloque `## [12.0.0]` narrativo arriba.
3. `APP_VERSION = "12.0.0"`.
4. `mem://audit/pendings` actualizado con corte 12.0.0 y lista clara de deuda diferida a 12.x.

## Detalle técnico

- Orden de commits sugerido: (1) linter fixes si aplica, (2) bump a `rc.18` + nota corta, (3) cambios de memoria/pendings, (4) bump final a `12.0.0` con el bloque narrativo consolidado.
- El bloque `## [12.0.0]` no duplica bullets de los rc; resume por área de producto en lenguaje orientado a usuario final.
