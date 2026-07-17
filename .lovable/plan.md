# Blindaje de numeración de embarques (folio per-org)

## Contexto

Hoy `embarque_consecutivo_seq` es **una secuencia global** compartida por todas las organizaciones. Estado actual en la base:

- Org "Libre Carga" (`0000…0001`): 182 embarques, folios `ELIMP00001…ELIMP00327`.
- Org secundaria (`05ac6723…`): 27 embarques con folios intercalados en el mismo rango.
- Org Demo (`de100000…`): 4 embarques con folios `DEMO-2026-###` sembrados a mano.

El incidente del `ELIMP20260` ocurrió porque una migración de "sync" hizo `MAX(regexp_replace(expediente,'\D','','g'))` sobre **toda** la tabla, y los folios Demo se interpretaron como el número 2 026 004.

Ya existe la tabla `public.folio_secuencias(organization_id, tipo, ultimo_numero, updated_at)` usada por `factura_proveedor`. La aprovechamos.

## Objetivo

Que cada organización tenga su propio contador de embarques, atómico e imposible de contaminar por otra org.

## Cambios

### 1. Nueva migración `20260717_folio_embarque_per_org.sql`

**a) Sembrar `folio_secuencias` con el máximo actual por org (regex estricto)**

```text
INSERT INTO folio_secuencias(organization_id, tipo, ultimo_numero)
SELECT organization_id, 'embarque',
       COALESCE(MAX(substring(expediente FROM 6)::bigint), 0)
  FROM embarques
 WHERE expediente ~ '^EL[A-Z]{3}[0-9]+$'
   AND deleted_at IS NULL
 GROUP BY organization_id
ON CONFLICT (organization_id, tipo) DO UPDATE
   SET ultimo_numero = GREATEST(folio_secuencias.ultimo_numero, EXCLUDED.ultimo_numero);
```

Resultado: org 0000…0001 arranca en 327, org 05ac6723 en su propio máximo (~139), Demo no queda sembrada (no tiene folios EL___NNNNN, y no se auto-genera).

**b) Reescribir `public.generar_expediente(text)`**

- Obtiene `v_org := current_user_org_id()`; si es NULL → excepción.
- `UPDATE folio_secuencias SET ultimo_numero = ultimo_numero + 1 … RETURNING` (atómico) con `INSERT … ON CONFLICT` para el caso primer folio de una org nueva.
- Loop defensivo: si el candidato colisiona con un `expediente` existente **de la misma org** (por reasignaciones manuales), avanza hasta uno libre (máx 1000 intentos).
- Mantiene el overload por enum `tipo_operacion` intacto.

**c) CHECK constraint suave para prevenir contaminación**

```text
ALTER TABLE embarques
  ADD CONSTRAINT embarques_expediente_formato_valido
  CHECK (
    expediente ~ '^EL[A-Z]{3}[0-9]+$'
    OR expediente ~ '^DEMO-[0-9]{4}-[0-9]+$'
  ) NOT VALID;
```

`NOT VALID` evita fallar por filas históricas raras; los nuevos inserts sí se validan. Además impide que alguien meta a mano un folio como `ELIMP20260` con más de 5 dígitos si queremos, pero mantenemos permisivo (`[0-9]+`) para no romper el histórico.

**d) Retirar la secuencia global**

- `DROP SEQUENCE IF EXISTS public.embarque_consecutivo_seq;` una vez confirmado que nada la referencia (search en código adjunto durante implementación).

### 2. `supabase/tests/rls/_ci_drift.sql`

Quitar el stub `CREATE SEQUENCE IF NOT EXISTS public.embarque_consecutivo_seq;` (ya no aplica) y añadir un seed mínimo de `folio_secuencias` para las orgs de fixture RLS.

### 3. Test de regresión (`supabase/tests/rls/test_folio_embarque_per_org.sql`)

- Simula dos orgs; cada una llama `generar_expediente('Importación')` 3 veces.
- Verifica: org A recibe 00001,00002,00003; org B recibe 00001,00002,00003 (independientes).
- Verifica: un INSERT manual con `expediente='FOO123'` falla por el CHECK.

### 4. Bump versión + CHANGELOG

- `src/constants/appVersion.ts` → `13.301.48`.
- `CHANGELOG.md`: entrada explicando el cambio y el blindaje.

## Detalles técnicos

- **Concurrencia**: el `UPDATE … RETURNING` sobre `folio_secuencias` toma lock de fila por (org, tipo) → dos inserts simultáneos en la misma org se serializan sin gaps, y orgs distintas no se bloquean entre sí.
- **Rollback**: si la migración falla, ninguna fila de `embarques` se toca. Los folios ya emitidos permanecen; sólo cambia el mecanismo del siguiente `nextval`.
- **RLS**: `folio_secuencias` ya tiene policy por `current_user_org_id()`. La función es `SECURITY DEFINER` así que puede escribir aun cuando el usuario sólo tenga SELECT.
- **Demo**: al no tener folios `EL___NNNNN` sembrados, no genera fila en `folio_secuencias`. Si algún día se crea un embarque real en la org Demo, arranca desde 1 sin contaminar a nadie.
- **Compatibilidad**: la firma de `generar_expediente(text)` y `generar_expediente(tipo_operacion)` no cambia — todas las RPCs que la llaman (`resolver_expediente_por_bl`, conversión de cotización, etc.) siguen funcionando sin tocarlas.

## Fuera de alcance

- Renombrar los folios ya intercalados entre orgs (ej. la org secundaria hoy tiene `ELEXP00001` que "debería" ser suyo pero convive con folios de la org principal). Renumerar histórico rompería referencias en PDFs, correos y bitácora. Si en el futuro quieres una vista limpia, se hace con un campo `folio_display` derivado, no tocando `expediente`.
- Folio per-org para cotizaciones, proformas o facturas — este plan se limita a embarques, que es el punto que se rompió.
