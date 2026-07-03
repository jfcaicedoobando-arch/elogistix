## Bug: CP del cliente aparece "faltante" al timbrar aunque sí está guardado

### Causa raíz (analogía)
La tabla `clientes` tiene **dos casilleros para el mismo dato**: `cp` y `codigo_postal`. El formulario de "Editar cliente" guarda en el casillero `cp` (66200 para QUIMCELT), pero la validación fiscal (timbrado, FacturAPI, RPCs, banner de alerta) mira el otro casillero, `codigo_postal`, que quedó vacío. Resultado: en la ficha se ve el CP, pero al timbrar dice que falta.

Verificado en DB:
```
QUIMCELT POWDER COATINGS → cp = 66200,  codigo_postal = NULL
```

Y en código: `useClientes`/formulario escriben `cp`; `facturapi-emitir`, `FacturaFiscalCheckAlert`, `DialogTimbrarFactura`, `DialogTimbrarRep`, `DialogNuevaFacturaManual`, `fetchClienteFiscal` y el RPC `convertir_proformas_a_factura` leen `codigo_postal`.

### Plan de arreglo (mínimo, sin tocar lógica fiscal)

Convertimos `cp` en la única fuente de verdad y hacemos que `codigo_postal` se mantenga sincronizado automáticamente. Así ni el formulario ni las edge functions/RPCs necesitan cambiar.

1. **Migración SQL** `supabase/migrations/<ts>_sync_cp_codigo_postal.sql`:
   - `UPDATE public.clientes SET codigo_postal = cp WHERE codigo_postal IS NULL OR codigo_postal = '';` (backfill; no pisa valores existentes distintos).
   - Trigger `BEFORE INSERT OR UPDATE ON public.clientes`: si `NEW.cp` cambia, copiar a `NEW.codigo_postal`; si `NEW.codigo_postal` cambia y `NEW.cp` está vacío, copiar al `cp`. Así ambos casilleros quedan siempre iguales.
   - Sin cambios de RLS ni de GRANT (columna ya existente).

2. **Cambio de UI mínimo** en `DialogEditarCliente.tsx` y `NuevoClienteDialog` (vía `useNuevoClienteController`): al enviar, incluir `codigo_postal: form.cp` en el payload de `insert`/`update`. Es redundante gracias al trigger, pero blinda el caso de que el trigger no exista aún en un entorno viejo.

3. **Test unitario** en `src/features/cliente/hooks/__tests__/useNuevoClienteController.test.tsx` (extender el existente): al guardar un cliente con `cp: "01000"`, el payload enviado a Supabase incluye también `codigo_postal: "01000"`.

4. **Housekeeping**:
   - Bump `APP_VERSION` (patch) en `src/constants/appVersion.ts`.
   - Entrada en `CHANGELOG.md` describiendo el fix.

### Fuera de alcance
- No renombramos ni eliminamos la columna `cp` ni `codigo_postal` (romperíamos edge functions, tests y RPCs). Queda como deuda técnica documentada.
- No tocamos edge functions de FacturAPI ni RPCs; siguen leyendo `codigo_postal`, ahora ya poblado.
- No tocamos QUIMCELT manualmente: el backfill de la migración lo corrige junto con cualquier otro cliente en la misma situación.

### Detalle técnico del trigger

```sql
CREATE OR REPLACE FUNCTION public.clientes_sync_cp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.cp IS DISTINCT FROM COALESCE(OLD.cp, '') AND NEW.cp IS NOT NULL AND NEW.cp <> '' THEN
    NEW.codigo_postal := NEW.cp;
  ELSIF (NEW.codigo_postal IS DISTINCT FROM COALESCE(OLD.codigo_postal, ''))
        AND (NEW.cp IS NULL OR NEW.cp = '') THEN
    NEW.cp := NEW.codigo_postal;
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER trg_clientes_sync_cp
BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.clientes_sync_cp();
```
