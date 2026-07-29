## Contexto

Del paquete de hallazgos MEDIOS ya están aplicados M3, M4, M11 (ola 1), M5, M6, M7 (ola 2 SQL), M8 (ola 3), M1/M2 (ola 4) y M9/M10 (ola 5). Verifiqué en el repo que quedan pendientes exactamente tres: M12, M13 y M14 (los loops seriales siguen en `FacturasMasivasToolbar.tsx:56,95`, no existe `src/lib/async/`, no existen los hooks/controladores de M14 ni el test anti-regresión).

## Qué voy a hacer (Ola 6)

### 1. M12 — Acciones masivas de facturas más rápidas y con progreso
- Nuevo helper `src/lib/async/mapWithConcurrency.ts`: procesa en tandas con `Promise.allSettled`, concurrencia máxima configurable y callback de progreso. Sin dependencias nuevas (mismo patrón que `crm/services/leads/bulk.ts`).
- `FacturasMasivasToolbar.tsx`: reemplazar los dos bucles seriales (ZIP de PDF+XML y reenvío de correo) por `mapWithConcurrency(..., 4, ...)`, con descarga PDF/XML en paralelo por factura. Se conservan los conteos de éxito/error y los tres tipos de aviso actuales.
- Mostrar progreso en el botón ("Descargando 12/50…", "Reenviando 12/50…") y limpiar el estado al terminar, con guarda de desmontaje.
- Tests del helper: no supera la concurrencia máxima, el progreso es monótono y un fallo no aborta la tanda.

### 2. M13 — Estados válidos en tablas de envío
Una migración que, para `cotizacion_envios`, `proforma_envios` y `factura_envios`:
- Normaliza cualquier valor de `estado` fuera del catálogo a `fallido` (dejando aviso del conteo).
- Agrega una restricción idempotente que solo permita `enviado`, `parcial` o `fallido` (los tres valores que ya escriben las funciones de envío).
Descartados por falso positivo verificado: `clientes.estado` (es el estado de la república de la dirección fiscal) y `embarques.cobro_cliente_status` (ya tiene su restricción).

### 3. M14 — Sacar la lógica de datos de los componentes
- **Ola 1 (los tres casos de dinero):** extraer a hooks del feature la lógica hoy embebida en `ConciliacionPagoCell.tsx` (`useConciliacionPagoCellController`), `TabDemoras.tsx` (`useTabDemorasController`) y `ProformaInconsistenteAlert.tsx` (`useAsignarConceptosProforma`), unificando las invalidaciones de caché duplicadas. Los componentes quedan presentacionales.
- **Ola 2:** mismo criterio para los 10 `useQuery` y 7 `useMutation` restantes en componentes (organizaciones, selector de factura abierta, tarifas, diálogos de cancelar/enviar factura, bitácoras, notas de crédito, timbrado, editor de conceptos, catálogo SAT, enviar proforma).
- **Ola 3:** mover los 7 archivos `use*.ts(x)` que viven bajo `components/` a la carpeta `hooks/` de su feature y corregir imports (movimiento puro, sin cambio de lógica).
- **Test de arquitectura** `no-inline-query-mutations.test.ts`: bloquea nuevos `useQuery({`/`useMutation({` dentro de `src/features/*/components/**` (baseline que solo puede bajar) y prohíbe archivos `use*` bajo `components/`.

## Detalles técnicos

- Concurrencia 4 para no saturar la función de envío ni el proxy de CFDI; JSZip es síncrono al añadir archivos, seguro desde las tandas.
- Migración idempotente con `NOT VALID` + `VALIDATE CONSTRAINT` para no bloquear escrituras concurrentes.
- Cada hook extraído mantiene los `queryKeys` canónicos y los helpers `notify*`; se respeta el límite de 200 líneas por archivo.

## Verificación

- `bunx vitest run src/lib/async src/features/cxp src/features/embarques` y los tests de arquitectura en verde.
- `bun run lint -- --max-warnings 0` y typecheck limpios.
- `bun run audit:migrations` en verde tras la migración.
- Actualizar `CHANGELOG.md` y `APP_VERSION` a `13.331.0`.

Si prefieres reducir el alcance, puedo dejar M14 Olas 2–3 para un turno aparte y cerrar hoy M12 + M13 + M14 Ola 1.
