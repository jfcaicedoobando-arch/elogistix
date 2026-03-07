

## Oportunidades de refactorización en el proyecto

Tras revisar el codebase completo, estas son las áreas con mayor potencial de mejora:

---

### 1. NuevaCotizacion.tsx — 577 líneas, ~30 estados individuales

El archivo más grande del proyecto. Tiene ~30 `useState` individuales para el wizard de cotización (destinatario, mercancía, ruta, conceptos, etc.). Toda la lógica de guardado, validación y construcción de payload está inline.

**Refactorización:** Extraer un hook `useCotizacionForm.ts` que encapsule todo el estado del wizard (similar al patrón existente de `useEmbarqueForm.ts`). Mover la construcción de payload (`buildPaso1Data`) y las validaciones a funciones puras. Cada paso del wizard ya tiene su componente, pero los props siguen saliendo del page — el hook centraliza eso.

---

### 2. EmbarqueDetalle.tsx — 547 líneas con lógica de duplicación y eliminación inline

Contiene lógica de diálogos de duplicación (con filas de copias editables), eliminación en dos pasos, auto-actualización de estado, y gestión de documentos — todo dentro del mismo archivo.

**Refactorización:** Extraer `DialogDuplicarEmbarque` y `DialogEliminarEmbarque` como componentes independientes. Mover la lógica de auto-actualización de estado a un hook `useAutoEstadoEmbarque`. El page quedaría como orquestador de tabs.

---

### 3. Configuracion.tsx — 484 líneas, ~20 useState con patrón repetitivo

Tiene ~20 estados individuales que se sincronizan manualmente con `config` en un `useEffect` gigante (líneas 71-97). El `handleSave` construye un array masivo de objetos `{categoria, clave, valor}`.

**Refactorización:** Usar `react-hook-form` (ya instalado) con un schema por sección. Extraer cada tab de configuración a su propio componente (como ya se hizo con `TabPuertos`): `TabEmpresa`, `TabTiposCambio`, `TabCotizaciones`, `TabFacturacion`, `TabEmbarques`, `TabAlertas`.

---

### 4. useEmbarques.ts — 470 líneas, hook monolítico

Contiene todas las queries y mutations de embarques en un solo archivo: CRUD, conceptos venta/costo, documentos, notas, facturas, duplicar, eliminar, avanzar estado. Es el hook más largo del proyecto.

**Refactorización:** Separar en archivos por dominio:
- `useEmbarqueQueries.ts` — queries de lectura (embarque, conceptos, docs, notas, facturas)  
- `useEmbarqueMutations.ts` — mutations (crear, editar, eliminar, duplicar, avanzar estado)  
- `useEmbarqueUtils.ts` — `calcularEstadoEmbarque` y tipos exportados
- `useEmbarques.ts` — re-exporta todo para no romper imports existentes

---

### 5. Patrón duplicado: listados con búsqueda + tabla + paginación

`Embarques.tsx`, `Clientes.tsx`, `Proveedores.tsx`, `Cotizaciones.tsx` y `Facturacion.tsx` repiten el mismo patrón: SearchInput + filtros + tabla + paginación opcional.

**Refactorización:** Crear un componente genérico `DataTable<T>` o `ListPage<T>` que reciba columnas, filtros y data. Esto estandariza la UI y reduce ~40-60 líneas por página.

---

### 6. Lógica de IVA y totales duplicada

El cálculo de IVA (16%), subtotales y totales aparece en al menos 4 lugares: `NuevaCotizacion`, `SeccionConceptosVentaCotizacion`, `TabCostos`, y `StepCostosPrecios`. Cada uno reimplementa la misma aritmética.

**Refactorización:** Centralizar en `src/lib/financialUtils.ts` funciones como `calcularSubtotal()`, `calcularIVA()`, `calcularTotal()` y `calcularMargen()`.

---

### 7. Constantes de estado duplicadas

Los arrays de estados (`ESTADOS`, `ESTADOS_FILTRO`) se definen localmente en `Embarques.tsx`, `useDashboardData.ts`, `estadoConfig.ts`, `EmbarqueDetalle.tsx`, etc. Lo mismo con modos de transporte.

**Refactorización:** Unificar en `src/data/embarqueConstants.ts` (ya existe parcialmente) y referenciar desde todos los archivos.

---

### Prioridad recomendada

| Prioridad | Archivo | Impacto |
|-----------|---------|---------|
| Alta | NuevaCotizacion.tsx | Más complejo, más propenso a bugs |
| Alta | Configuracion.tsx | Patrón de estado repetitivo |
| Media | EmbarqueDetalle.tsx | Ya parcialmente modularizado |
| Media | useEmbarques.ts | Facilita mantenimiento a largo plazo |
| Baja | DataTable genérico | Reduce código pero bajo riesgo actual |
| Baja | Constantes unificadas | Cosmético pero mejora consistencia |

