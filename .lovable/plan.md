

## Plan: Renombrar variables y funciones para mayor claridad — v3.2.0

He analizado todo el código de la aplicación. A continuación detallo los renombramientos organizados por archivo. El criterio es: **toda variable de 1-2 letras o abreviatura ambigua se reemplaza por un nombre descriptivo que se entienda sin contexto**.

---

### 1. `src/lib/helpers.ts`
- `[y, m, d]` → `[anio, mes, dia]`

### 2. `src/hooks/useClientes.ts`
- `qc` (×4 hooks) → `queryClient`
- `_d` en callbacks onSuccess → `_resultado`

### 3. `src/hooks/useEmbarques.ts`
- `emb` → `embarqueCreado` (L129)
- `embError` → `errorCrearEmbarque`
- `r` en `.then(r => r)` y `for (const r of results)` → `respuesta`
- `cv` → `conceptoVenta` (L142)
- `cc` → `conceptoCosto` (L149)
- `d` → `documento` (L156)

### 4. `src/hooks/useFacturas.ts`
No requiere cambios — los nombres ya son descriptivos.

### 5. `src/pages/Dashboard.tsx`
- `le` → `cargandoEmbarques` (L37 alias de isLoading)
- `lc` → se elimina, ya no se usa (conceptos se cargan en Reportes)
- En `stats` memo: `e.estado` ok, pero `e` en `.filter(e =>` → `embarque`
- `diff` → `diasParaLlegada`
- `d` → `fechaMes` (L47)
- `y, m` → `anio, mes`
- `inMonth` → `embarquesDelMes`
- `e` en recientes map → `embarque`
- `f` en facturas filter → `factura`
- `g` en gastos → mantener (solo `.length`)

### 6. `src/pages/Embarques.tsx`
- `e` en filter/map → `embarque`
- `m` en MODOS map → `modoTransporte`
- `c` en clientes map → `cliente`
- `p` en setPage → `paginaActual`
- `v` en onValueChange → `valorSeleccionado`

### 7. `src/pages/EmbarqueDetalle.tsx`
- `tcUSD` → `tipoCambioUSD`
- `tcEUR` → `tipoCambioEUR`
- `c` en reduce (conceptosVenta) → `concepto`
- `t` → `totalConcepto`
- `m` → `montoConcepto`
- `docArchivo` param → `rutaArchivo`

### 8. `src/pages/Facturacion.tsx`
- `f` en filter/map → `factura`
- `g` en gastos map → `gasto`
- `e` en ESTADOS_FACTURA map → `estadoFactura`

### 9. `src/pages/Reportes.tsx`
- `le` → `cargandoEmbarques`
- `lc` → `cargandoConceptos`
- `c` en clientes.map → `cliente`
- `cEmbarques` → `embarquesDelCliente`
- `embIds` → `idsEmbarquesCliente`
- `tcMap` → `tiposCambioEmbarques`
- `tc` → `tipoCambio`
- `v` en ventas filter → `venta`
- `g` en costos filter → `costo`
- `f` en facturas filter → `factura`
- `i` en render → `indice`

### 10. `src/pages/NuevoEmbarque.tsx`
- `cv` en interfaces/filtros → `conceptoVenta` / `venta`
- `cc` → `conceptoCosto` / `costo`
- `ct` en contactos.find → `contacto`
- `c` en reduce → `concepto`
- `n` en setNextId → `contadorActual`
- `s` en setCurrentStep → `pasoActual`
- `p` en proveedoresDb.find → `proveedor`
- `rates` → `tiposDeCambio`

### 11. `src/pages/Clientes.tsx`
- `c` en filtered/map → `cliente`
- `d` en documentos map → `documento`
- `o` en Dialog onOpenChange → `abierto`

### 12. `src/pages/ClienteDetalle.tsx`
- `ct` (contacto) → `contacto`
- `_d` → `_resultado`
- `t` en TIPOS_CONTACTO map → `tipoContacto`
- `e` en handleChange → mantener (event pattern estándar)
- `v` en onValueChange → `valorSeleccionado`

### 13. `src/pages/Proveedores.tsx`
- `p` en map → `proveedor`
- `t` en TABS map → `tabConfig`
- `i` en skeleton → `indice`

### 14. `src/pages/ProveedorDetalle.tsx`
- `prov` → `proveedor`
- `o` en operaciones map → `operacion`
- `i` en key → `indice`

### 15. `src/pages/Usuarios.tsx`
- `u` en map → `usuario`
- `r` en rolesData map → `rolUsuario`

### 16. `src/components/GlobalSearch.tsx`
- `q` → `terminoBusqueda` (param)
- `o` en setOpen → `estaAbierto`
- `e` en embarques map → `embarque`
- `c` en clientes map → `cliente`
- `p` en proveedores map → `proveedor`
- `f` en facturas map → `factura`
- `r` en grouped reduce → `resultado`

### 17. `src/components/embarque/StepCostosPrecios.tsx`
- `cv` → `venta`
- `cc` → `costo`
- `v` en onValueChange → `valorSeleccionado`
- `c` en CONCEPTOS map → `conceptoMaritimo`
- `p` en proveedoresDb map → `proveedor`

### 18. `src/components/embarque/TabCostos.tsx`
- `c` en map → `concepto`

### 19. `src/components/embarque/TabNotas.tsx`
- `n` en map → `nota`

### 20. `src/components/embarque/TabFacturacion.tsx`
- `f` en map → `factura`

### 21. `src/components/NuevoProveedorDialog.tsx` / `EditarProveedorDialog.tsx`
- `f` en setForm → `formularioActual`
- `v` en onValueChange → `valorSeleccionado`
- `t` en TIPOS map → `tipoProveedor`
- `m` en MONEDAS map → `moneda`
- `p` en PAISES map → `pais`

### 22. `src/contexts/AuthContext.tsx`
- `_event` → `_eventoAuth`

---

### Archivos a modificar (22 archivos)

```text
src/lib/helpers.ts
src/hooks/useClientes.ts
src/hooks/useEmbarques.ts
src/pages/Dashboard.tsx
src/pages/Embarques.tsx
src/pages/EmbarqueDetalle.tsx
src/pages/Facturacion.tsx
src/pages/Reportes.tsx
src/pages/NuevoEmbarque.tsx
src/pages/Clientes.tsx
src/pages/ClienteDetalle.tsx
src/pages/Proveedores.tsx
src/pages/ProveedorDetalle.tsx
src/pages/Usuarios.tsx
src/components/GlobalSearch.tsx
src/components/embarque/StepCostosPrecios.tsx
src/components/embarque/TabCostos.tsx
src/components/embarque/TabNotas.tsx
src/components/embarque/TabFacturacion.tsx
src/components/NuevoProveedorDialog.tsx
src/components/EditarProveedorDialog.tsx
src/contexts/AuthContext.tsx
src/pages/Changelog.tsx  (nueva entrada v3.2.0)
```

### Criterios aplicados
- Variables de iterador de 1 letra (`e`, `c`, `f`, `g`, `p`) → nombre completo de la entidad
- Abreviaciones ambiguas (`prov`, `emb`, `tc`, `qc`, `le`, `lc`) → nombre completo
- Destructuring críptico (`[y, m, d]`) → nombre legible
- Callbacks `_d` → `_resultado`
- Setters con `f =>` → `formularioActual =>`
- Sin cambiar nombres que ya son claros (`search`, `page`, `toast`, `navigate`, etc.)

