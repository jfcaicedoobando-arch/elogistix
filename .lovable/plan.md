
## Ciclo canónico acordado

```text
Borrador → Confirmado → En Tránsito → Arribo → En Aduana → Entregado → EIR → Cerrado
                                                              (+ Cancelado desde cualquier estado)
```

Esto **difiere de la BD actual** (v13.303.21), que tiene:

```text
Borrador → Confirmado → En Tránsito → En Aduana → Llegada → Arribo → Entregado → EIR → Cerrado
```

Diferencias a corregir:
1. **Orden invertido:** hoy es `En Aduana → Arribo`, debe ser `Arribo → En Aduana`.
2. **Estado `Llegada`:** desaparece del flujo. Se conserva como valor deprecado del enum con salida de rescate hacia `Arribo`/`En Aduana` (mismo patrón que usamos con `Cotización`).

## Cambios propuestos

### 1. Base de datos (migración `v13.303.22`)
Reescribir `transicion_embarque_valida` con el nuevo grafo:

```text
Borrador     → Confirmado
Confirmado   → En Tránsito | Borrador
En Tránsito  → Arribo | En Proceso
Arribo       → En Aduana | En Tránsito
En Aduana    → Entregado | Arribo
Entregado    → EIR | En Aduana
EIR          → Cerrado | Entregado
Cerrado      → EIR
Cancelado    → (cerrado)
Cotización   → Confirmado | Borrador   -- deprecado (rescate)
Llegada      → Arribo | En Aduana       -- deprecado (rescate)
En Proceso   → En Tránsito | Arribo | En Aduana
```

Migración de datos: mover cualquier embarque en `Llegada` a `Arribo` (verifico con `SELECT count(*) FROM embarques WHERE estado='Llegada'` antes de decidir destino).

Comentario del function bump a v13.303.22 explicando el cambio de orden y la deprecación de `Llegada`.

### 2. Frontend — fuente única del ciclo
- Crear `src/features/embarques/domain/cicloEmbarque.ts` con:
  ```ts
  export const CICLO_EMBARQUE = [
    "Borrador", "Confirmado", "En Tránsito",
    "Arribo", "En Aduana", "Entregado", "EIR", "Cerrado",
  ] as const;
  ```
- Consumido por `embarqueFases.ts`, `AvanzarEstadoButton`, `EstadoProgresoCard`, `labelEstadoEmbarque`, filtros del dashboard.

### 3. `embarqueFases.ts` (stepper visual del detalle)
- Actualizar comentario de cabecera al nuevo ciclo.
- Reemplazar los 5 chips actuales (`cotizacion/confirmado/en_transito/llegada/cerrado`) por los **8 pasos canónicos** para que **EIR y En Aduana sean visibles como fase propia**.
- Corregir orden en `ESTADOS_POST_TRANSITO`/`POST_LLEGADA` (que hoy listan Arribo antes de En Aduana — ahora sí es el orden correcto, pero completar con EIR).
- `labelEstadoEmbarque("Llegada")` → "Llegada (deprecado)".

### 4. Verificación
- Verificar en preview la ruta actual `/embarques/375ec92f-…` con Playwright/HD para confirmar el nuevo stepper de 8 pasos con sidebar abierto.
- Actualizar tests: `embarqueFases.test.ts`, cualquier test que valide `transicion_embarque_valida` (usar `psql` no aplica; buscar specs afectados).
- Correr `bun run lint` y vitest.

### 5. Docs
- `CHANGELOG.md` — entrada `## [13.303.22]`: nuevo orden Arribo→En Aduana, deprecación de `Llegada`, stepper visual de 8 pasos con EIR.
- Bump `APP_VERSION` → `13.303.22`.

## Fuera de alcance
- No se toca el enum `estado_embarque` (los valores deprecados quedan en el enum por seguridad de datos históricos, igual que hicimos con `Cotización`).
- No se rediseñan reglas de negocio dependientes del arribo (`yaLlegaron`, `estados_bloqueantes`, alertas de sidebar): los conjuntos siguen siendo semánticamente correctos, solo actualizo comentarios.
