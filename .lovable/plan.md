# Auditoría de `DetailHeader` y plan de adopción

## Veredicto

El componente está **bien planteado pero infra-utilizado y algo incompleto**. Hoy sólo lo usa `ProveedorDetalle.tsx:68`. Mientras tanto, **9 sitios** reimplementan a mano el mismo patrón "botón fantasma + flecha + navegar", cada uno con su propio `<h1>` y sus propias clases (`text-2xl font-bold` vs. el token canónico `text-display`). Es la deuda ya registrada en `docs/refactor/dry-hooks-audit.md` (C-1) y `docs/ui-audit/06-capa3-tranche-d.md` (D-01).

Analogía: tenemos una plantilla de portada oficial impresa, pero cada departamento sigue dibujando la suya a mano; se parecen, pero ninguna es igual.

## Hallazgos sobre el componente

| # | Sev | Ubicación | Qué pasa | Riesgo | Arreglo |
|---|-----|-----------|----------|--------|---------|
| 1 | HIGH | `DetailHeader.tsx:63` | `truncate` sobre el `<h1>` dentro de un `flex` sin `min-w-0` en el hijo: con títulos largos el badge se empuja fuera en pantallas chicas en vez de truncar el texto | Títulos/badges cortados en móvil | Envolver el título en `<span className="truncate min-w-0">` como ya hace `PageHeader.tsx:49` |
| 2 | HIGH | `DetailHeader.tsx:42-45` | El "Volver" es un `<button>` con `navigate`; no es un enlace real cuando `backTo` es ruta | Sin clic-medio / abrir en pestaña nueva; peor a11y y SEO interno | Renderizar `<Link>` (via `asChild`) cuando `backTo` es string; mantener `button` sólo para el caso numérico |
| 3 | MED | `DetailHeader.tsx:43-44` | Rama `if/else` que llama a `navigate` en ambos casos (idéntica) | Ruido / falsa complejidad | Colapsar a una sola llamada tipada |
| 4 | MED | falta | No hay slots `meta` (chips bajo el título) ni `tabs` (pie del header), que `PageHeader` sí tiene | Cada detalle vuelve a inventar la fila de chips/tabs → divergencia visual | Añadir props opcionales `meta` y `tabs` con el mismo contrato que `PageHeader` |
| 5 | MED | falta | Sin estado de carga | Cada página arma su propio esqueleto de encabezado | Exportar `DetailHeaderSkeleton` en el mismo archivo |
| 6 | LOW | `DetailHeader.tsx` vs `PageHeader.tsx` | Los dos duplican el bloque título/descr/acciones, con breakpoint distinto (`md` vs `lg`) | Se desincronizan al retocar uno | Extraer un `HeaderTitleBlock` interno compartido y unificar el breakpoint en `lg` |
| 7 | LOW | sin regla | No existe lint ni test de arquitectura que exija el componente canónico (`eslint.config.js` y `architecture.test.ts` no lo mencionan) | La deuda se vuelve a generar en cada página nueva | Test de arquitectura: prohibir `ArrowLeft` + `useNavigate` en archivos `*Detalle*`/`*DetalleHeader*` |

Lo que **sí está bien**: API por slots (`icon`/`badge`/`trailing`), `backTo` polimórfico, `<h1>` único por página, token `text-display`, `line-clamp-2` en subtítulo, y test unitario existente (`__tests__/DetailHeader.test.tsx`) que cubre render, ambos modos de `backTo` y `trailing`.

## Dónde implementarlo (rollout)

Ola 1 — duplicación pura (bajo riesgo, sólo se cambia el encabezado):
1. `src/features/cliente/components/detalle/ClienteDetalleHeader.tsx:21-31`
2. `src/features/cotizacion/components/detalle/CotizacionDetalleHeader.tsx:18-26`
3. `src/features/admin/components/orgDetalle/OrgHeader.tsx:18-25`
4. `src/features/proformas/routes/ProformaDetalle.tsx:90` + `ProformaDetalleHeader.tsx:32-36`

Ola 2 — portal cliente (hallazgo D-01), hoy back manual + `PageHeader` sin integrar:
5. `src/features/portal/routes/PortalFacturaDetalle.tsx:59,62`
6. `src/features/portal/routes/PortalEmbarqueDetalle.tsx:61,64`
7. `src/features/portal/routes/PortalCotizacionDetalle.tsx:56-60` (retirar `PortalCotizacionHeader` ad-hoc)

Ola 3 — CRM y detalles con header propio (requiere revisar tabs/acciones):
8. `src/features/crm/routes/LeadDetalle.tsx:82,96,100` (hoy tiene **dos** botones "volver")
9. `src/features/crm/components/oportunidadDetalle/OportunidadDetalleContent.tsx:62-63` (usa `ArrowLeft` como `icon` de `PageHeader`)
10. `src/features/facturacion/.../FacturaDetalleHeader.tsx:40-53`
11. `src/features/embarque/.../EmbarqueDetalleHeader.tsx:63-67`

`CotizacionInformativaDetalle.tsx:50` ya usa `PageHeader` limpio: se migra sólo si queremos uniformidad total.

## Detalles técnicos

- Nueva API propuesta: `backTo`, `backLabel`, `icon`, `title`, `subtitle`, `badge`, `meta?`, `trailing?`, `tabs?`, `className`; más `DetailHeaderSkeleton`.
- Tests: ampliar `DetailHeader.test.tsx` con `meta`/`tabs`, render como `<a href>` cuando `backTo` es string, y truncado con título largo + badge.
- Guardarraíl: nuevo caso en `src/lib/__tests__/architecture.test.ts` que falle si un archivo de detalle importa `ArrowLeft` desde `lucide-react`.
- Cada ola termina con `bun run lint -- --max-warnings 0`, `tsgo` y los tests de la feature tocada; se sube `APP_VERSION` y se agrega entrada en `CHANGELOG.md`.

## Riesgos

- Migrar headers que hoy incluyen acciones complejas (Factura, Embarque) puede alterar el orden de botones; se resuelve pasándolos tal cual por `trailing`.
- Unificar el breakpoint de `md` a `lg` cambia levemente el layout en tablet de `ProveedorDetalle` (recién rediseñado): hay que revalidar a 768 px.
