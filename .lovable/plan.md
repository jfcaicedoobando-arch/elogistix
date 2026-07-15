## Causa raíz

El bug es un efecto colateral del fix anterior (v13.300.53). La RPC `duplicar_factura_para_sustitucion` copia también `snapshot_emision` de la factura original al nuevo borrador `F971-R`. El trigger `bloquear_modificacion_factura_emitida` interpreta `snapshot_emision IS NOT NULL` como "factura ya emitida" y bloquea cualquier UPDATE (incluido el autosave de datos fiscales) con el mensaje `factura_inmutable: la factura F971-R ya fue emitida…`.

Analogía: al fotocopiar el libro, también pegamos el sello de "documento oficial firmado" — la BD trata al borrador como si ya estuviera timbrado.

El `snapshot_emision` sólo debe existir cuando la propia factura pase a `Emitida` (lo llena el trigger `congelar_factura_al_emitir`), nunca al crearse como borrador.

## Cambios

### 1. Migración: RPC `duplicar_factura_para_sustitucion`
- En el `INSERT INTO public.facturas`, sustituir `v_old.snapshot_emision` por `NULL` en la columna `snapshot_emision`.
- El resto de la RPC (copia de renglones vivos, bitácora, validaciones de rol) se mantiene igual.

### 2. Data fix del borrador existente
Con la herramienta de datos, limpiar `snapshot_emision` en los borradores de sustitución que hayan quedado contaminados por la versión anterior:
```
UPDATE public.facturas
   SET snapshot_emision = NULL
 WHERE sustituye_a IS NOT NULL
   AND estado = 'Borrador'
   AND uuid_fiscal IS NULL
   AND snapshot_emision IS NOT NULL;
```
Cubre el caso reportado (`75fe099b-…`) y cualquier otro creado en la ventana v13.300.53.

### 3. Versionado
- `APP_VERSION` → `13.300.55`
- Entrada breve en `CHANGELOG.md` que referencie el `requestId` del error y explique el fix.

## Notas técnicas
- No hay cambios de frontend.
- El autosave de datos fiscales volverá a funcionar en cuanto se limpie el snapshot y se actualice la RPC.
- El snapshot correcto se generará automáticamente cuando se timbre `F971-R` (trigger `congelar_factura_al_emitir`).
