

## Plan de Refactorización del Código — Por Fases

### Estado: Fases 1-4 completadas ✅

---

### Fase 1 — Limpieza de código muerto ✅
- Eliminada propiedad `iva` de `ConceptoVentaLocal` y `ConceptoCostoLocal`
- Eliminadas inicializaciones `iva: false` en `useConceptosForm.ts` y `EditarEmbarque.tsx`
- Eliminadas funciones vacías `isStep1Valid` e `isStep2Valid` en `NuevoEmbarque.tsx`

### Fase 2 — Hook compartido useEmbarqueForm ✅
- Creado `src/hooks/useEmbarqueForm.ts` con ~35 estados centralizados
- `handleMsdsUpload`, `buildEmbarquePayload`, `buildConceptosVentaPayload`, `buildConceptosCostoPayload`
- `inicializarDesdeEmbarque()` para edición
- `NuevoEmbarque.tsx` reducido de 293 a ~170 líneas
- `EditarEmbarque.tsx` reducido de 369 a ~210 líneas

### Fase 3 — Componente DocumentChecklist ✅
- Creado `src/components/DocumentChecklist.tsx` reutilizable
- Integrado en `Clientes.tsx` y `NuevoProveedorDialog.tsx`
- Eliminadas ~30 líneas de UI duplicada por archivo

### Fase 4 — Descomponer NuevaCotizacion ✅
- `SeccionDestinatario.tsx` — radio cliente/prospecto + formulario
- `SeccionDatosGeneralesCotizacion.tsx` — modo, tipo, incoterm, moneda
- `SeccionRutaCotizacion.tsx` — origen, destino, tránsito, frecuencia, seguro
- `SeccionConceptosVentaCotizacion.tsx` — tabla de conceptos con totales
- `NuevaCotizacion.tsx` reducido de 547 a ~280 líneas

### Fase 5 — Reducir `as any` (pendiente)
- Usar `TablesInsert`/`TablesUpdate` de Supabase en payloads
- Verificar tipos regenerados en `types.ts`

