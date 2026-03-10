

## Fix: Add permissive DELETE RLS policies for embarque cascade deletion

### Root Cause
All existing RLS policies on the affected tables are **restrictive** (`Permissive: No`). PostgreSQL requires at least one **permissive** policy to grant access — restrictive policies can only further narrow. Since there are no permissive DELETE policies, delete operations are silently denied.

### Correction to User's SQL
The user's SQL references `public.usuarios` which doesn't exist. This project uses the `public.user_roles` table with the existing `has_role()` security definer function.

### Migration SQL
Add **permissive** DELETE policies on 6 tables using the existing `has_role()` function:

```sql
CREATE POLICY "Permitir eliminar conceptos_venta"
ON public.conceptos_venta FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role));

CREATE POLICY "Permitir eliminar conceptos_costo"
ON public.conceptos_costo FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role));

CREATE POLICY "Permitir eliminar documentos_embarque"
ON public.documentos_embarque FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role));

CREATE POLICY "Permitir eliminar notas_embarque"
ON public.notas_embarque FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role));

CREATE POLICY "Permitir eliminar facturas"
ON public.facturas FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role));

CREATE POLICY "Permitir eliminar embarques"
ON public.embarques FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role));
```

### No code changes needed
The `useEliminarEmbarque` hook already performs the correct cascade delete sequence. Only the database policies are missing.

