## Problema

El enlace **"Por capturar (CxP)"** (la Opción B del workflow de facturas de proveedor) sólo aparece en el sidebar del rol **Auxiliar contable**. Los demás roles financieros tienen el permiso de ruta pero no ven el atajo.

## Cambio propuesto

Agregar `/cxp/por-capturar` como bandeja visible para los roles financieros que ya tienen permiso en `appRoutes.tsx`.

**Archivo:** `src/hooks/layout/useAppSidebarSections.ts`

| Rol | Cambio |
|---|---|
| `contador` (`buildContador`, línea 72-79) | Agregar sección "Mi bandeja" con `/cxp/por-capturar` |
| `tesorero` (`buildTesorero`, línea 81-89) | Agregar `/cxp/por-capturar` a la bandeja existente, quedando `["/cxp/por-capturar", "/cxp/por-pagar"]` |

No se modifica `ejecutivo_cobranza` (no tiene permiso de ruta para CxP, su flujo es cartera/cobranza, no captura de facturas de proveedor).

No se modifica `appRoutes.tsx` — los permisos ya estaban correctos.

## Versionado

- Bump `APP_VERSION` a `13.94.3` en `src/constants/appVersion.ts`.
- Agregar entrada `[13.94.3]` en `CHANGELOG.md` (raíz) describiendo: "Contador y Tesorero ahora ven el atajo 'Por capturar (CxP)' en el sidebar".

## Validación

Sin pruebas adicionales: cambio de configuración de UI, sin lógica de negocio nueva.
