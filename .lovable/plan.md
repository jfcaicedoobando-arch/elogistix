
# Plan: Refactor del módulo `/configuracion` (híbrido)

## Objetivo
Que el módulo sea honesto: cada tab visible debe **hacer algo**. Eliminar lo demostradamente muerto y conectar 3-4 parámetros baratos a sus consumidores reales.

## Estructura final propuesta (5 tabs)

```text
Configuración
├─ Empresa            ← cableada a PDFs (cotización/proforma/factura)
├─ Facturación        ← sólo tasa IVA + serie/folio (ambos cableados)
├─ Auditoría          ← 3 umbrales cableados al módulo Auditoría
├─ Catálogos          ← Puertos (renombrado)
└─ Herramientas       ← Exportar ZIP (renombrado)
```

## Cambios concretos

### A. Eliminar (tabs + claves muertas)

| Quitar | Por qué |
|---|---|
| Tab **Tipos de Cambio** | Frankfurter.app reemplaza a este default; nadie lo lee. |
| Tab **Cotizaciones** | Cada cotización captura sus propios valores; el default global no se aplica en el form. |
| Tab **Embarques** | `prefijo_expediente` lo asigna el RPC `generar_expediente`; los otros 2 campos no se leen. |
| Tab **Alertas** | Umbrales hardcodeados en sidebar/dashboard; no hay ROI en cablearlos. |
| `TabNavieras.tsx`, `TabTiposContenedor.tsx` | Archivos huérfanos no montados → borrar. |
| Claves: empresa.subtitulo, facturacion.dias_vencimiento, facturacion.moneda_default | Sin consumidor y sin plan de uso. |

Las **claves en la tabla `configuracion`** quedan en la base por compatibilidad (no se borran filas vía migración para evitar romper RLS o triggers); sólo se quita la UI y los campos del state hook. Si más tarde se quieren purgar, se hace en una migración separada.

### B. Cablear (3 conexiones nuevas, baratas)

1. **Empresa → PDFs**: crear `useDatosEmpresa()` que devuelva `{nombre, rfc, direccion, email, telefono}` desde `configuracion`. Inyectar en los tres generators (`generators/cotizacion/*`, `generators/proforma/*`, `generators/factura/*`) reemplazando los literales actuales del header.
2. **Facturación → serie/folio**: ya están en `configuracion`; conectar a `useDialogGenerarProformaController` para prefill al generar nueva proforma.
3. **Auditoría → módulo Auditoría**: crear `useConfigAuditoria()` y reemplazar los umbrales hardcodeados en `services/auditoria/*` que hoy usan 5 / 30 / 5 fijos.

### C. Reorganizar

- Mover `TabPuertos` bajo nuevo tab **Catálogos** (deja espacio para Navieras/Contenedores cuando se cableen de verdad).
- Renombrar `TabExportar` → tab **Herramientas** (deja espacio futuro para "Importar", "Restaurar", etc.).

### D. UX del shell

- `useConfiguracionState` queda con 16 campos (de 27) → reducción ~40%.
- Botón "Guardar Cambios" sólo aparece si el tab activo tiene campos editables (Catálogos y Herramientas no lo muestran).
- Reordenar tabs: **Empresa → Facturación → Auditoría → Catálogos → Herramientas** (de más usado a más raro).

## Archivos afectados

**Borrar:**
- `src/components/configuracion/TabTiposCambio.tsx`
- `src/components/configuracion/TabCotizaciones.tsx`
- `src/components/configuracion/TabEmbarques.tsx`
- `src/components/configuracion/TabAlertas.tsx`
- `src/components/configuracion/TabNavieras.tsx`
- `src/components/configuracion/TabTiposContenedor.tsx`

**Crear:**
- `src/hooks/configuracion/useDatosEmpresa.ts`
- `src/hooks/configuracion/useConfigAuditoria.ts`

**Editar:**
- `src/pages/admin-org/Configuracion.tsx` (de 9 a 5 tabs, reordenar)
- `src/hooks/configuracion/useConfiguracionState.ts` (purga de 11 campos)
- `src/components/configuracion/TabFacturacion.tsx` (reducir a 3 campos)
- `src/generators/cotizacion/header.ts` (+ análogos en proforma/factura) — usar `useDatosEmpresa`
- `src/services/auditoria/*` — leer umbrales desde config
- `src/constants/appVersion.ts` → `12.51.18`
- `CHANGELOG.md` → entrada `2026-06-04`

## Validación
- `bunx vitest run` debe seguir en 982/982.
- Verificar visualmente `/configuracion`, `/auditoria` y un PDF de cotización tras los cambios.

## Fuera de alcance
- Borrar filas históricas de `configuracion` (migración separada si se solicita).
- Implementar tabs nuevos (Navieras, Tipos de Contenedor) — sólo se deja el slot "Catálogos".
- Cambios en `configuracion_global` (super-admin) — este módulo es per-org.
