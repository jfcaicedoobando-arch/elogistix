# Ola 9 — Cierre de los 14 hallazgos que siguen abiertos

Revisé los 44 hallazgos de la auditoría (5 críticos, 13 altos, 17 medios, 9 bajos) uno por uno contra el código actual con tres auditores en paralelo, más verificaciones puntuales mías.

## Estado verificado

- **Críticos (C1–C5): 5/5 corregidos.**
- **Altos: 11 corregidos** (incluye A7 y A9, que los auditores no pudieron confirmar y sí están hechos: `vsRealDomain.ts` excluye gastos sin tipo de cambio, y existe `emailAllowlist.ts` en el provisioning).
- **Medios: 11 corregidos.**
- **Bajos: 5 corregidos.**
- **Abiertos: 14** (2 altos, 5 medios, 5 bajos, 2 parciales) — ninguno es fuga de datos ni escalada de privilegios; son cálculos, fechas, refresco de pantalla e higiene.

## Qué se corrige en esta ola

### Grupo 1 — Dinero (mayor riesgo contable)
1. **A6 — Saldo de facturas de proveedor infla lo pagado.** En `proveedorFacturas.update.ts` la suma de pagos no ignora los pagos borrados ni descuenta notas de crédito aplicadas. Se agrega el filtro de borrados y el descuento de notas de crédito, igual que ya se hace en cobranza.
2. **M5 — Tipo de cambio 1 en el hueco de facturación.** `huecoFacturacion/buildFilas.ts` usa `?? 1` cuando el embarque no trae TC; se cambia al mismo fallback DOF que ya usa la proyección.
3. **M6 — Notas de crédito en el estado de resultados** no usan su propio tipo de cambio ni el del embarque vinculado; se enlaza el TC real y sólo se cae al DOF si no existe.
4. **B3 — Redondeo local** en `pagoProveedorLote.ts`: usar `roundMoney` de `financialUtils.ts`.
5. **B5 — Parseo de montos** en `AvisoTcRequerido.tsx` y `AplicarAnticipoDialog`: usar `parseMonto` centralizado (formato mexicano).

### Grupo 2 — Correo y fechas
6. **M9 — Estado de cuenta CxC por correo:** excluye las facturas "Parcialmente pagada" del vencido y asume una sola moneda para todo el estado de cuenta. Se incluyen las parciales y se agrupan totales por moneda.
7. **A11 — Fechas con zona horaria del navegador** (`facturasCrud.ts`, `sincronizarEtapa.ts`, `crear.ts`): cambiar `new Date().toISOString().split("T")[0]` por el helper de fecha local México. Evita registros con fecha de "mañana" después de las 18:00.

### Grupo 3 — Pantalla y UX
8. **M13 — Refresco incompleto:** al facturar, invalidar también las consultas de CxP para que los gastos vinculables no queden desactualizados.
9. **M14 — Doble PDF:** `usePdfExport` usa estado como candado; se cambia a `useRef` para bloquear el doble clic en el mismo frame.
10. **B7 — Formulario de envío de documentos** se sobreescribe cuando refresca la lista de contactos: agregar guarda de "ya cargado".

### Grupo 4 — Higiene y consistencia
11. **B2 — Login** aún pide 6 caracteres (`minLength={6}`); usar la política central (mínimo 10).
12. **B6 — Llave de almacenamiento de marketing** literal, no sincronizada con `STORAGE_KEYS`.
13. **M16 — `.env` sigue versionado** aunque ya está en `.gitignore`. Se saca del control de versiones y se documenta en `.env.example`. Como el archivo apunta al backend real, se recomienda además rotar las llaves publicables por separado.
14. **A13 (parcial) — Edge functions:** el helper viejo de `_shared/auth.ts` decide por rol global sin respetar la precedencia de la organización que ya implementamos. Se migra ese helper a la misma regla de rol efectivo.

## Pruebas
- Tests unitarios nuevos por cada corrección de dinero (A6, M5, M6, B3, B5) con casos multimoneda y con pagos borrados/notas de crédito.
- Test de fecha con reloj congelado a 19:00 hora México para A11.
- Test de doble clic para M14 y de "no sobreescribe lo capturado" para B7.
- Test de paridad de política de contraseñas ya existente cubre B2; se agrega el caso del login.
- Corrida completa de la suite y del set de pruebas SQL antes de cerrar.

## Notas técnicas
- Todo el cálculo nuevo pasa por `financialUtils.ts` / `parseMonto.ts`; no se agregan constantes de TC nuevas.
- Sin cambios de esquema salvo, si hace falta, una migración para el descuento de notas de crédito en el saldo (se evaluará reutilizar la función existente `saldo_factura_bruto` en su equivalente de proveedor).
- Cierre con `APP_VERSION` `13.476.0` y entrada en `CHANGELOG.md`.
