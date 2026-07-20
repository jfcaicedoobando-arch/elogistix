## Diagnóstico (bug real)

El botón **"Registrar llegada"** en el tab Tracking dispara `actualizarFechaLlegadaRealEmbarque(...)`, que hace un update directo a la BD poniendo `estado = 'Arribo'`. Pero la máquina de estados de BD (migración `20260718214722`, vigente desde el 18-jul) sólo permite:

```
En Tránsito → { En Aduana, En Proceso, Llegada }
Llegada     → { Arribo, En Aduana }
Arribo      → { Entregado, Llegada }
```

`En Tránsito → Arribo` **no existe**. El trigger lanza `LC_TRANSICION_INVALIDA` y la UI muestra el error. Este error sí es un bug (no ruido), por eso hoy pasó el filtro `LC_*` que agregamos en v13.302.7.

Analogía: el botón se llama "llegada" pero está intentando saltarse un paso — como marcar un paquete "entregado" cuando apenas llegó a la sucursal.

## Fix

### 1. `src/features/embarques/services/embarqueDirectMutations.ts`
Cambiar `estado: 'Arribo'` → `estado: 'Llegada'` en `actualizarFechaLlegadaRealEmbarque`. Semánticamente correcto: "marcar llegada" registra `fecha_llegada_real` y avanza al estado `Llegada` (llegada al puerto). `Arribo` es un paso posterior (disposición / almacén) que se transiciona desde `Llegada`. Actualizar el JSDoc.

### 2. Copys UI
- `src/features/embarques/components/tracking/MarcarLlegadaForm.tsx` — línea 63: `"Al guardar, el embarque avanza a Arribo."` → `"Al guardar, el embarque avanza a Llegada."`
- `src/features/embarques/components/tracking/TrackingNuevoEventoForm.tsx` — comentarios doc (líneas 10-11) y ayuda (línea 86) alineadas a `Llegada`.
- El evento de bitácora `"Arribo a Puerto"` que se registra tras la mutación seguirá llamándose así (es un texto de evento, no un estado).

### 3. Cache invalidation / react-query
Ninguna — la misma mutación ya invalida las queries del detalle.

### 4. Test de regresión
Extender `src/features/embarques/services/__tests__/mutations.test.ts` (o crear archivo hermano `embarqueDirectMutations.test.ts` si no existe) con un test que verifique que `actualizarFechaLlegadaRealEmbarque` manda `estado: 'Llegada'`. Blindar contra futura reversión.

### 5. Housekeeping
- Bump `APP_VERSION` → `13.302.8`
- Entrada en `CHANGELOG.md` con referencia al `requestId` del reporte del usuario.

## Fuera de alcance
- No se toca la máquina de estados (la vigente es la correcta según el flujo modelado).
- No se toca `useDocsFaltantesParaEstado.ts` — la lista de estados que exige documentos es correcta.
- No se agrega ningún nuevo estado ni se altera el enum `estado_embarque`.
