## Diagnóstico

Hoy el cierre exige **estado = Entregado** en dos capas:

- **Frontend** (`TabCierre.tsx` líneas 60 y 80): `estatus === "entregado"`.
- **Backend** (`public.cerrar_embarque`): `IF v_emb.estado <> 'Entregado' THEN RAISE`.

Pero en marítimo el flujo natural es: `... → Entregado → EIR → Cerrado`. EIR (Equipment Interchange Receipt) es el último paso operativo del contenedor devuelto a la naviera. Los embarques marítimos quedan parados en EIR y la UI bloquea el cierre.

## Fix

Permitir cerrar desde **Entregado o EIR** en ambas capas. EIR sólo existe en marítimo, así que no afecta aéreo/terrestre.

### 1) Migración: relajar la RPC

```sql
CREATE OR REPLACE FUNCTION public.cerrar_embarque(p_embarque_id uuid) ...
-- cambiar el guard:
IF v_emb.estado::text NOT IN ('Entregado','EIR') THEN
  RAISE EXCEPTION 'Solo se pueden cerrar embarques en estado Entregado o EIR (actual: %)', v_emb.estado::text;
END IF;
```

Resto del cuerpo idéntico.

### 2) `src/features/embarques/components/TabCierre.tsx`

- Constante local `ESTADOS_LISTOS_PARA_CIERRE = new Set(["entregado", "eir"])`.
- Línea 60: `const puedeCerrar = (isAdmin || canEditFinance) && ESTADOS_LISTOS_PARA_CIERRE.has(estatus);`
- Línea 80–86: condicional y mensaje:
  > El embarque debe estar en estado **Entregado** o **EIR** para ejecutar el cierre.

### 3) Tests

Actualizar `src/features/embarques/components/__tests__/TabCierre.rules.test.ts` y `services/__tests__/cierre.test.ts` para agregar caso EIR ⇒ permite.

### 4) Changelog

Bump a `13.87.4` + entrada en `CHANGELOG.md` raíz:
> fix(embarques/cierre) permitir cerrar embarques marítimos desde estado EIR (no sólo Entregado). UI y RPC `cerrar_embarque` actualizadas.

## Sin cambios

- Validaciones de checklist intactas.
- Flujo Aéreo/Terrestre intacto (no llegan a EIR).
- Reapertura intacta.
