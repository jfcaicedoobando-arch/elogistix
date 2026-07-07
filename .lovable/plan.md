
# Propagar `{Org}_{nombre}` a todos los archivos descargables/enviables

Ya lo aplicamos a `facturapi-descargar` (PDF/XML de factura, REP y NC). Falta el resto de puntos donde el usuario recibe un archivo.

Analogía: la política de "sticker con la organización" ya se aplica en la ventanilla A; ahora hay que aplicarla en las ventanillas B, C, D…

## Alcance detectado

### Server-side (edge functions)
| Función | Situación actual | Cambio |
|---|---|---|
| `enviar-factura-email/helpers.ts` | `Factura-{numero}.pdf/xml` | `{Org}_Factura-{numero}.pdf/xml` |
| `enviar-cotizacion-email/handlers.ts` | `createSignedUrl` sin `download` (baja con el nombre feo del path) | agregar `download: '{Org}_Cotizacion-{folio}.pdf'` |
| `facturapi-cancelar/index.ts` | `acuse-cancelacion-{numero}.pdf` | `{Org}_acuse-cancelacion-{numero}.pdf` |
| `facturapi-descargar/index.ts` | ✅ ya hecho | — |
| `enviar-proforma-email/index.ts` | Sólo envía link al portal (sin PDF adjunto) | Sin cambios |

Cada función ya conoce el `organization_id` de la entidad; añadir un helper `slugifyOrg` + una consulta `SELECT nombre FROM organizations WHERE id = <org>`. Como los tres archivos comparten el patrón, se extrae un helper único en `supabase/functions/_shared/orgSlug.ts`:

```ts
export function slugifyOrg(nombre: string | null | undefined): string {
  const s = (nombre ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return s || "org";
}
export async function fetchOrgSlug(admin, orgId: string): Promise<string> { ... }
```

Y en `facturapi-descargar/index.ts` migrar sus funciones internas a este helper compartido (dejamos DRY el módulo).

### Client-side (generadores PDF)
| Archivo | Nombre actual | Nombre nuevo |
|---|---|---|
| `src/generators/cotizacionPdf.tsx` | `{folio}-cotizacion` | `{Org}_{folio}-cotizacion` |
| `src/generators/proformaPdf.tsx` (x2) | `{numero}-proforma[-consolidada]` | `{Org}_{numero}-proforma[-consolidada]` |
| `src/generators/rentabilidadPdf.tsx` | `Rentabilidad_...` | `{Org}_Rentabilidad_...` |
| `src/features/cxp/routes/Cxp.tsx` | `Reporte_Cartera_{fecha}` | `{Org}_Reporte_Cartera_{fecha}` |
| `src/features/presupuesto/components/TabVsReal.tsx` | (revisar) | prefijo `{Org}_` |
| `src/features/profit/routes/ProfitEstadoResultados.tsx` | (revisar) | prefijo `{Org}_` |
| `src/features/tesoreria/routes/Tesoreria.tsx` | (revisar) | prefijo `{Org}_` |
| `src/features/cotizacion/routes/CotizacionInformativaDetalle.tsx` (Tarifario) | (revisar) | prefijo `{Org}_` |

Fuera de alcance: CSVs de aging/reconciliación (son datos, no "archivos que se descargan por mail"). Si el usuario los quiere, se agregan en una siguiente ola.

Helper cliente en `src/lib/filenames.ts`:

```ts
import { fetchEmisorEmpresa } from "@/features/configuracion/services";

export function slugifyOrg(nombre: string | null | undefined): string { /* misma lógica */ }

/** Devuelve el slug del emisor configurado. Cache vía fetchEmisorEmpresa. */
export async function getOrgFilenameSlug(): Promise<string> {
  const emisor = await fetchEmisorEmpresa();
  return slugifyOrg(emisor.razonSocial);
}

export async function withOrgPrefix(name: string): Promise<string> {
  const slug = await getOrgFilenameSlug();
  return `${slug}_${name}`;
}
```

Se reusa el cache de 5 min de `fetchEmisorEmpresa`, así que agregar el prefijo no añade queries perceptibles.

Uso típico:
```ts
await descargarPdf(<Doc/>, await withOrgPrefix(`${folio}-cotizacion`));
```

### Tests
- Test unitario de `slugifyOrg` (frontend y edge — misma lógica, dos casas): acentos, espacios, símbolos, string vacío, límite 40 chars.
- Extender `descargarCfdiFacturapi.test.ts`: ya cubre parseo de filename, sin cambios.
- Extender un test de `enviar-factura-email` para verificar que `signUrl` recibe filename con prefijo (mockear `admin.storage`).

### Versión y changelog
- `APP_VERSION` → `13.213.39`.
- Entrada `[13.213.39]` en `CHANGELOG.md`.

## Deploy
- `supabase--deploy_edge_functions` para las 3 funciones tocadas: `enviar-factura-email`, `enviar-cotizacion-email`, `facturapi-cancelar` (y `facturapi-descargar` si movemos al helper compartido).

## Archivos
Nuevos:
- `supabase/functions/_shared/orgSlug.ts`
- `src/lib/filenames.ts`
- `src/lib/__tests__/filenames.test.ts`

Editados:
- `supabase/functions/facturapi-descargar/index.ts` (usar helper compartido — refactor sin cambio funcional)
- `supabase/functions/enviar-factura-email/helpers.ts`
- `supabase/functions/enviar-cotizacion-email/handlers.ts`
- `supabase/functions/facturapi-cancelar/index.ts`
- `src/generators/cotizacionPdf.tsx`
- `src/generators/proformaPdf.tsx`
- `src/generators/rentabilidadPdf.tsx`
- `src/features/cxp/routes/Cxp.tsx`
- `src/features/presupuesto/components/TabVsReal.tsx`
- `src/features/profit/routes/ProfitEstadoResultados.tsx`
- `src/features/tesoreria/routes/Tesoreria.tsx`
- `src/features/cotizacion/routes/CotizacionInformativaDetalle.tsx`
- `src/constants/appVersion.ts`
- `CHANGELOG.md`
