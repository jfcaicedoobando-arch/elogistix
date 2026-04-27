## Restringir cotizaciones visibles a clientes

Los clientes verán únicamente cotizaciones en estado **Enviada**, **Aceptada** o **Rechazada**. Borrador, Vencida y Cancelada quedan ocultas.

### 1. Migración SQL — Endurecer la política RLS

Defensa primaria a nivel de base de datos. Aunque alguien intente consultar directamente la API, no podrá leer cotizaciones en borrador.

```sql
DROP POLICY IF EXISTS "Cliente read own cotizaciones" ON public.cotizaciones;

CREATE POLICY "Cliente read own cotizaciones"
ON public.cotizaciones
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND cliente_id IN (SELECT current_user_client_ids())
  AND estado IN (
    'Enviada'::estado_cotizacion,
    'Aceptada'::estado_cotizacion,
    'Rechazada'::estado_cotizacion
  )
);
```

### 2. Filtro defensivo en frontend

`src/services/portal/queries.ts` → añadir `.in("estado", [...])` a `fetchPortalCotizaciones` para evitar incluso solicitar registros que la RLS rechazaría. Mantiene la UI rápida y consistente.

```ts
const PORTAL_COTIZACION_ESTADOS_VISIBLES = ["Enviada", "Aceptada", "Rechazada"] as const;

// dentro de fetchPortalCotizaciones:
.in("estado", PORTAL_COTIZACION_ESTADOS_VISIBLES)
```

### 3. Changelog

Entrada **v8.99.3** en `src/content/changelog/v8/chunks/0.ts`: "Mejora de privacidad en portal del cliente: las cotizaciones en estado Borrador, Vencida y Cancelada ya no son visibles. Solo se exponen Enviada, Aceptada y Rechazada."

### Resultado

- ✅ Cliente ya no ve trabajo interno (borradores con precios tentativos)
- ✅ Cliente sigue viendo histórico relevante (aceptadas y rechazadas)
- ✅ Doble capa: RLS + filtro frontend
- ✅ Operadores y staff interno no se ven afectados (otra política los cubre)