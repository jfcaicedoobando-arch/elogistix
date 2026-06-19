## Resultado de la auditoría

El subagente identificó **66 hallazgos** (18 CRITICAL, 30 HIGH, 16 MEDIUM, 2 LOW). El patrón principal: **mutations de React Query sin `onError`** (errores silenciosos) y **operaciones destructivas/financieras sin `onSuccess` toast** (sin confirmación).

Buena noticia: **no hay `catch {}` vacíos** en componentes — todo lo que se traga está concentrado en los hooks. Eso hace el fix sistémico, no archivo-por-archivo.

Analogía: es como un panel de control de una fábrica donde la mitad de los botones funcionan pero no encienden la luz que confirma — los operadores los aprietan dos veces "por si acaso", o no se enteran de que falló.

## Estrategia (en 4 oleadas)

Para no inundar al usuario con toasts duplicados (algunos componentes ya tienen `try/catch` propio), seguimos la regla:

- **Hooks añaden `onError` siempre** (red de seguridad para cualquier lugar que use el hook).
- **Hooks añaden `onSuccess` toast** sólo cuando NINGÚN consumidor actual ya lo muestra. Si un dialog ya muestra success, dejamos el hook silent en success.
- Componentes que usan `mutateAsync` y emiten su propio `notifyError` en catch: migrar a `mutate` (sin await) para que el `onError` del hook tome control, eliminando duplicados.

### Oleada 1 — CRITICAL: Embarques + Tesorería + Documentos fiscales (18 hooks)

Archivos a editar (sólo añadir `onError`/`onSuccess` en `useMutation`):

1. `src/features/embarques/mutations/useCreateEmbarque.ts` — `useCreateEmbarque`, `useDuplicarEmbarque`
2. `src/features/embarques/mutations/useDeleteEmbarque.ts` — `useEliminarEmbarque`
3. `src/features/embarques/mutations/useUpdateEmbarque.ts` — `useUpdateEmbarque`
4. `src/features/embarques/mutations/useEstadoEmbarque.ts` — `useAvanzarEstadoEmbarque`, `useSyncEstadoEmbarque`, `useReabrirEmbarque`
5. `src/features/embarques/mutations/useDocumentoEmbarqueMutations.ts` — 4 hooks (upload/delete/create/setNoAplica)
6. `src/features/embarques/mutations/useNotaEmbarque.ts` — `useCreateNotaEmbarque`
7. `src/features/facturacion/hooks/useFacturas.ts` — `useMarcarCostoPagado`
8. `src/features/facturacion/hooks/useNotasCredito.ts` — `useCrearNotaCredito`, `useCambiarEstadoNotaCredito`
9. `src/features/facturacion/hooks/usePagosFactura.ts` — `useRegistrarPagoFactura`, `useEliminarPagoFactura` (revisar `DialogRegistrarPago` para evitar duplicado)
10. `src/features/cxp/hooks/useFacturaProveedorMutations.ts` — crear/eliminar
11. `src/features/cxp/hooks/usePagosProveedor.ts` — registrar/eliminar
12. `src/features/tesoreria/hooks/useTesoreriaMovimientos.ts` — `useImportarMovimientos`, `useConciliarPago`, `useDesconciliar`, `useIgnorarMovimiento`
13. `src/features/tesoreria/hooks/useTesoreriaCuentas.ts` — crear/eliminar
14. `src/features/crm/hooks/leads/convertir.ts` — `useConvertirLead`

### Oleada 2 — HIGH: CRM + Cotizaciones + Clientes/Proveedores (30 hooks)

15. `src/features/cotizacion/hooks/mutations/useCotizacionMutations.ts` — 5 hooks
16. `src/features/cotizacion/hooks/mutations/usePortalCotizacionMutations.ts` — `useResponderCotizacion`
17. `src/features/cotizacion/hooks/useCrearCotizacionDesdeOportunidad.ts`
18. `src/features/cliente/hooks/useClientes.ts` — 5 hooks (verificar wizard de alta cliente que ya toastea)
19. `src/features/cliente/hooks/useClientUsersMutations.ts` — 3 hooks
20. `src/features/proveedor/hooks/useProveedores.ts` — 3 hooks (verificar dialogs)
21. `src/features/crm/hooks/useOportunidades.ts` — 3 hooks
22. `src/features/crm/hooks/useActividades.ts` — 3 hooks
23. `src/features/crm/hooks/leads/mutations.ts` — 3 hooks
24. `src/features/crm/hooks/leads/bulk.ts` — 3 hooks
25. `src/features/portal/hooks/usePortalPerfil.ts` — `useActualizarContactoPortal`, `useCambiarPasswordPortal`
26. `src/features/admin/hooks/useAdminData.ts` — `useCreateOrganization`
27. `src/hooks/usuario/useUsuarioMutations.ts` — `useCreateUser`, `useDeleteUser`
28. `src/hooks/usuario/useUsuarios.ts` — `useChangeUserRole`, `useDeleteUser`

### Oleada 3 — MEDIUM: Presupuesto + Plantillas + Etapas (16 hooks)

29. `src/features/presupuesto/hooks/usePresupuestoMensual.ts`
30. `src/features/presupuesto/hooks/usePresupuestoCategorias.ts`
31. `src/features/crm/hooks/useComentariosOportunidad.ts`
32. `src/features/crm/hooks/usePlantillasMensaje.ts`
33. `src/features/crm/hooks/useEtapasPipeline.ts`
34. `src/features/crm/hooks/useAutomatizacionesEtapa.ts`
35. `src/features/crm/hooks/useActualizarActividadNotas.ts`
36. `src/features/embarques/hooks/useEventosEmbarque.ts`
37. `src/features/embarques/hooks/useTrackingLinks.ts`
38. `src/hooks/useAcknowledgeAlerta.ts` (sólo añadir success)

### Oleada 4 — Formularios de auth y mejoras menores

39. `src/pages/auth/ResetPassword.tsx` y `ForgotPasswordDialog.tsx` — añadir `toast.error` en `setError` (duplicar feedback para que sea más visible).

## Best practice / patrón canónico a usar en cada hook

```ts
import { toast } from "@/hooks/shared";
import { notifySuccess, notifyError } from "@/lib/notifications";

return useMutation({
  mutationFn: async (...) => { /* ... */ },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: [...] });
    notifySuccess(toast, { title: "Embarque creado" });
  },
  onError: (error: Error) => {
    notifyError(toast, { title: `Error al crear embarque: ${error.message}`, error, method: "CREATE_EMBARQUE" });
  },
});
```

Reglas:
- Mensajes en **español mexicano**, verbo en pasado para éxito ("creado/eliminado/actualizado"), verbo en presente para error ("Error al crear").
- `method` único por mutation para que Sentry pueda agrupar.
- Para acciones que ya tienen toast en el componente: agregar SÓLO `onError` al hook como red de seguridad, NO `onSuccess` (evita duplicado). Anotar con comentario `// onSuccess se emite desde <Componente> para evitar doble toast`.

## Tests

- Test nuevo `src/__tests__/architecture/mutations-have-onerror.test.ts`: scanner estático que recorre `src/features/**/use*.ts` + `src/hooks/**/use*.ts`, parsea cada `useMutation({...})` y FALLA si encuentra uno sin `onError`. Whitelist explícita para los pocos casos justificados. Esto previene regresiones futuras — es la garantía de "100% cubierto".

## Metadata

- `APP_VERSION` → `13.68.0` (cambio mayor de cobertura UX, lo merece minor bump).
- `CHANGELOG.md` → entrada `[13.68.0]` describiendo las 4 oleadas y el test de arquitectura.
- Memoria nueva `mem://principles/toast-coverage.md`: regla "Todo `useMutation` lleva `onError` con `notifyError`; `onSuccess` toast salvo si el componente ya lo emite".

## Plan de ejecución

Cada oleada se hará en un commit lógico (verificable, reversible):

1. **Build #1** — Oleada 1 + memoria + test de arquitectura (skip-listado inicialmente para no romper en oleadas pendientes).
2. **Build #2** — Oleada 2 + reducir skip-list.
3. **Build #3** — Oleadas 3+4 + remover skip-list por completo.
4. **Build #4** — Bump version, CHANGELOG, correr suite completa de tests.

Total ≈ 35 archivos editados, todos cambios localizados y de bajo riesgo (sólo añadir callbacks a hooks existentes). Sin cambios de schema, RLS, ni UI.

## Fuera de alcance

- No modificar la firma de las mutations (sigue `mutateAsync` disponible).
- No cambiar los servicios (RPC, edge functions, queries).
- No tocar componentes que ya toastean bien (sólo verificar para evitar duplicados).
- No tocar i18n.
