# Fase 7 — Validación visual y ajustes finos

Validar las fases 1-6 con capturas reales en móvil y desktop, detectar overflow/regresiones y aplicar ajustes puntuales si aparecen.

## 1. Capturas

Móvil **412×915** y desktop **1366×768** sobre las rutas clave (login con cuenta demo si hace falta):

- `/dashboard`
- `/embarques`
- `/proveedores`
- `/cotizaciones`
- `/crm/leads`, `/crm/oportunidades`, `/crm/mi-dia`
- `/cxp`, `/reportes`, `/auditoria`
- `/profit/dashboard-ejecutivo`, `/profit/estado-resultados`, `/profit/presupuesto`
- `/tesoreria/cuentas`, `/tesoreria/flujo`
- `/admin/organizaciones`, `/admin-org/usuarios`, `/admin-org/configuracion`
- `/portal/dashboard`, `/portal/perfil`

## 2. Checklist por captura

- Search siempre visible en listados.
- Botón "Filtros (n)" abre Sheet con badge correcto en `<md`.
- Sin scroll horizontal en `<sm`.
- `PageHeader` no trunca acciones; título usa `text-display` sin desbordar.
- Tabs scrollables sin cortar etiquetas.
- KPIs sin desbordar en 343 px.
- Tablas → cards en `<sm` (Fase 2) sin tarjetas rotas.

## 3. Ajustes finos

Por cada hallazgo:
- Corrección puntual (clases Tailwind, sin lógica).
- Si aparece overflow recurrente en KPIs, aplicar `text-kpi` + `tabular-nums break-words`.
- Si un Sheet de filtros queda corto de altura en iOS, revisar `pb-[max(env(safe-area-inset-bottom),1rem)]`.

## 4. Metadata

- Si hay ajustes → bump `13.21.1` + entrada en `CHANGELOG.md` resumiendo los fixes.
- Si todo pasa limpio → bump opcional `13.21.1` con nota "validación visual sin regresiones".

## Excluye

- Cambios de lógica de negocio.
- Rediseño tipográfico o de paleta.
- Pruebas Vitest (no aplica para CSS responsivo).

## Orden

1. Login en preview (si la sesión está caducada, pedir al usuario que se autentique).
2. Recorrer rutas en mobile 412×915, capturando.
3. Recorrer rutas en desktop 1366×768, capturando.
4. Aplicar ajustes finos detectados.
5. Bump `13.21.1` + entrada en `CHANGELOG.md` con el resumen del recorrido.
