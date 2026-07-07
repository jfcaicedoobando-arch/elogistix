# Nombre de archivo PDF/XML de factura con Organización + folio

Hoy el edge function `facturapi-descargar` devuelve nombres tipo `A123.pdf` (sólo serie+folio). Los usuarios quieren identificar la organización que descargó el archivo para no revolverlos entre tenants.

Analogía: en el buzón todos llegaban con "Sobre 123"; ahora vendrán con "LibreCarga_Sobre-123" para saber a quién pertenece.

## Cambios

### 1) `supabase/functions/facturapi-descargar/index.ts`

Después de `resolveTarget` (ya conocemos `organizationId`), agregar un fetch a `public.organizations`:

```ts
const { data: org } = await supabase
  .from("organizations")
  .select("nombre")
  .eq("id", target.data.organizationId)
  .maybeSingle();
const orgSlug = slugifyOrg(org?.nombre ?? "org");
```

Y componer el filename final:

```ts
const filename = `${orgSlug}_${target.data.filename}.${ext}`;
```

**Formato resultante**:

- Factura normal: `LibreCarga_A123.pdf`
- REP (complemento de pago): `LibreCarga_REP-B45.xml`
- Nota de crédito: `LibreCarga_NC-C7.pdf`

Se conserva la lógica actual de `target.data.filename` para que el subtipo (REP/NC) siga visible.

### 2) Helper `slugifyOrg`

Colocado en el mismo `index.ts` (función pequeña, no vale la pena archivo aparte):

```ts
function slugifyOrg(nombre: string): string {
  return nombre
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // quita acentos
    .replace(/[^a-zA-Z0-9]+/g, "_")                     // no-alfanum → _
    .replace(/^_+|_+$/g, "")                            // trim underscores
    .slice(0, 40) || "org";                             // fallback y límite
}
```

Reglas:

- Sin acentos ni ñ (`México` → `Mexico`).
- Sin espacios ni caracteres raros: `Libre Carga S.A.` → `Libre_Carga_S_A`.
- Máx 40 chars para no romper Content-Disposition.
- Si queda vacío, `org`.

### 3) Tests

- `supabase/functions/facturapi-descargar/__tests__/*` (Deno): agregar/actualizar caso que valide `Content-Disposition` contiene el prefijo de la org. Si no existen tests Deno de esta función, crear uno mínimo o extender el existente en `src/features/facturacion/services/__tests__/descargarCfdiFacturapi.test.ts` como cobertura del cliente (parsea filename tal cual venga; ya cubierto).
- Sin cambios en el frontend: `descargarCfdiFacturapi` lee el filename del header, así que el nuevo nombre baja automáticamente.

### 4) Versión y changelog

- `APP_VERSION` → `13.213.38`.
- Entrada `[13.213.38]` en `CHANGELOG.md` explicando el cambio de nombres de archivo.

## Fuera de alcance

- Nombres de archivo del PDF de proforma / reporte de cartera (esos se generan cliente-side; si se solicitan luego, aplicar la misma convención).
- Cambiar el orden del filename (org vs folio) — usaremos `{Org}_{folio}` porque agrupa los archivos por tenant al ordenarlos alfabéticamente.

## Archivos

- `supabase/functions/facturapi-descargar/index.ts`
- (opcional) test Deno de la edge function
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

El archivo no debe de hacer mencion de librecarga, debe de hacer mencion de la org o tenant de libre carga.