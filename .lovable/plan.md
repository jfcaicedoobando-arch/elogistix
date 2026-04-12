

## Auditoría Arquitectónica v8.4.0 — Reporte Final

El codebase ha mejorado enormemente tras los refactorings v8.2.0–v8.4.0. Los problemas restantes son menores pero vale la pena documentarlos para completar la limpieza.

---

### Hallazgos ordenados por criticidad

#### 1. ALTO — `as any` residual en `CotizacionDetalle.tsx`

Líneas 178 y 182 usan `(cotizacion as any).comentario_cliente`. Este campo se tipó correctamente en `PortalCotizacionDetalle.tsx` pero el fix no se propagó aquí.

**Archivos**: `src/pages/CotizacionDetalle.tsx`
**Solución**: Importar el tipo correcto (`Tables<'cotizaciones'>`) o acceder al campo tipado si ya existe en el esquema.

---

#### 2. ALTO — Queries inline con strings hardcodeados en 3 componentes

Tres componentes tienen queries Supabase directas con `queryKey` de strings sin usar `queryKeys`:

- **`TabPortalCliente.tsx`**: query `["client_users", clienteId]` + mutaciones `delete` directas contra `client_users`
- **`NuevoUsuarioDialog.tsx`**: query `["admin", "organizations-list"]` + insert directo a `organization_members`
- **`TabResumen.tsx`**: query `['embarques-relacionados', ...]`

**Solución**: Extraer a hooks dedicados o agregar keys al factory `queryKeys.ts`. Registrar `clientUsers` en `queryKeys.portal` o `queryKeys.clientes`.

---

#### 3. MEDIO — `format(parseISO(...))` inline en 3 archivos (7 llamadas)

Persisten llamadas directas a `format(parseISO(...))` en vez de usar el centralizado `formatDate`:

- `PortalDashboard.tsx`: 2 llamadas con formatos `"dd MMM"` y `"dd/MM"`
- `PortalEmbarqueDetalle.tsx`: 3 llamadas con formatos `"dd 'de' MMMM"` y `"dd/MM/yyyy"`
- `TabPortalCliente.tsx`: 1 llamada con `format(new Date(...))` 

`formatDate` ya acepta `locale` y `formatStr`, así que estas llamadas pueden migrarse directamente.

**Archivos**: 3 archivos portal
**Solución**: Reemplazar por `formatDate(dateStr, "dd MMM")`.

---

#### 4. MEDIO — `AgregarMiembroOrgDialog.tsx` usa `useEffect` + `setState` para fetching

Líneas 33-47 usan un patrón imperativo (`useEffect` → `supabase.functions.invoke` → `setState`) en vez del patrón declarativo del proyecto (React Query). Esto no maneja estados de error, no se beneficia del caché, y rompe la convención.

**Archivos**: `src/components/admin/AgregarMiembroOrgDialog.tsx`
**Solución**: Migrar a `useQuery` con la key `queryKeys.admin.allUsers` (reutilizando `useAdminGlobalUsers` o un subset).

---

#### 5. MEDIO — `format` importado de `date-fns` en componentes que deberían usar `formatDate`

`TabTracking.tsx` y `SeccionRutaCotizacion.tsx` importan `format` directamente de `date-fns`. El primero formatea fechas de eventos; el segundo formatea fechas para el calendario (caso especial legítimo para `<Calendar>`).

**Archivos**: `TabTracking.tsx` (migrable), `SeccionRutaCotizacion.tsx` (legítimo — formato de Calendar component)
**Solución**: Migrar `TabTracking.tsx` a `formatDate`. Dejar `SeccionRutaCotizacion.tsx` como está.

---

#### 6. BAJO — `PortalEmbarqueDetalle.tsx` es el archivo más grande (392 líneas)

Combina resumen, timeline de eventos, documentos y detalles financieros en un solo componente. Podría descomponerse en sub-componentes.

**Solución**: Extraer secciones a componentes como `PortalEmbarqueTimeline`, `PortalEmbarqueDocumentos`. No es urgente dado que la complejidad es manejable.

---

#### 7. BAJO — Query keys no registrados en el factory

- `["client_users", clienteId]` en `TabPortalCliente`
- `["admin", "organizations-list"]` en `NuevoUsuarioDialog`
- `['embarques-relacionados', ...]` en `TabResumen`

Estas deberían registrarse en `queryKeys.ts` para consistencia.

---

### Plan de acción recomendado

| Paso | Descripción | Archivos | Esfuerzo |
|------|------------|----------|----------|
| 1 | Eliminar `as any` en `CotizacionDetalle.tsx` — tipar `comentario_cliente` | 1 archivo | Bajo |
| 2 | Extraer queries de `TabPortalCliente` y `NuevoUsuarioDialog` a hooks, registrar keys | 3 archivos + `queryKeys.ts` | Medio |
| 3 | Migrar `format(parseISO(...))` inline a `formatDate` en portal + `TabTracking` | 4 archivos | Bajo |
| 4 | Refactorizar `AgregarMiembroOrgDialog` de `useEffect`+`setState` a `useQuery` | 1 archivo | Bajo |
| 5 | Registrar query keys faltantes (`embarques-relacionados`, `client_users`) | `queryKeys.ts` + `TabResumen.tsx` | Bajo |
| 6 | Descomponer `PortalEmbarqueDetalle.tsx` en sub-componentes (opcional) | 1 → 3 archivos | Medio |

### Resumen

La arquitectura está en **excelente estado**. Los hallazgos son deuda técnica menor: 1 cast `as any` residual, 3 componentes con queries no centralizadas, y algunas llamadas de formateo que no siguen la convención establecida. Un patrón imperativo de fetching (`useEffect`) sobrevive en un diálogo de admin. Nada es un blocker funcional — completar estos pasos cierra definitivamente el ciclo de limpieza iniciado en v8.2.0.

