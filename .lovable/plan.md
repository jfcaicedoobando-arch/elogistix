## Diagnóstico

El embarque **ELIMP00331** está en estado `Borrador` con ETD ya vencido. El hook `useAutoSyncEstadoEmbarque` corre `calcularEstadoEmbarque(...)`, que sólo excluye del auto-cálculo los estados en `ESTADOS_MANUALES = ["Arribo","En Aduana","Entregado","EIR","Cerrado"]`. `Borrador` y `Cotización` **no** están en esa lista, así que la función los trata como "En Tránsito" en cuanto `hoy >= ETD`, y dispara `syncEstadoMutate` con `Borrador → En Tránsito`. La máquina de estados de BD sólo permite `Borrador → {Cotización, Cancelado}`, por eso rebota con `LC_TRANSICION_INVALIDA`.

Analogía: el "piloto automático" que ajusta el estado según fechas está confundiendo un embarque que todavía está en el escritorio de ventas (Borrador) con uno ya confirmado en tránsito, e intenta saltarse toda la fase comercial.

## Fix

### 1. `src/features/embarques/domain/embarque.ts`
Agregar un allowlist explícito de estados sujetos a auto-cálculo: **sólo** `Confirmado`, `En Tránsito` y `Llegada` participan del cómputo por fechas. Cualquier otro estado (`Borrador`, `Cotización`, `Cancelado`, además de los ya listados en `ESTADOS_MANUALES`) devuelve `estadoActual` sin tocar. Es la única forma limpia porque el hook de sync es un `useEffect` genérico que corre en cualquier detalle de embarque.

```ts
const ESTADOS_AUTO_CALCULABLES = new Set(["Confirmado", "En Tránsito", "Llegada"]);
if (!ESTADOS_AUTO_CALCULABLES.has(estadoActual)) return estadoActual;
```
(Reemplaza al chequeo actual de `ESTADOS_MANUALES` — es más seguro por defecto.)

### 2. Test unitario
Ampliar `src/features/embarques/domain/__tests__/embarque.test.ts` (o crearlo si falta) con:
- `Borrador + ETD vencido → Borrador` (regresión directa del requestId `d3b726f5`).
- `Cotización + ETD vencido → Cotización`.
- `Cancelado + cualquier fecha → Cancelado`.
- Mantener los happy paths existentes (`Confirmado → En Tránsito`, `En Tránsito + ETA vencida sin llegada real → En Tránsito`, `En Tránsito + llegada real → Arribo` cuando aplique — cuidado: hoy `calcularEstadoEmbarque` devuelve `"Arribo"` para `En Tránsito` con `fecha_llegada_real`. Se conserva porque `En Tránsito` está en el allowlist).

### 3. Housekeeping
- Bump `APP_VERSION` → `13.302.9`.
- Entrada en `CHANGELOG.md` referenciando `requestId d3b726f5-998d-4798-9793-b0e68a0b98a8` y explicando el allowlist.

## Fuera de alcance
- No se toca la máquina de estados de BD ni `useEmbarqueEstadoActions` (avance manual sigue igual — el usuario nunca puede clickear "avanzar" de `Borrador` a `En Tránsito`; `getSiguienteEstado("Borrador")` retorna `Cotización`).
- No se agregan nuevos estados ni se altera el enum.
- No se modifica el UI del tab tracking (el bug es 100% de auto-sync en background).
