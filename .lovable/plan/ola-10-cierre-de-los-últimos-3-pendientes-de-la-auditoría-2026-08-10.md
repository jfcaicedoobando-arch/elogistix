# Ola 10 — Cierre de los últimos 3 pendientes de la auditoría

Verifiqué los 44 hallazgos uno por uno contra el código actual (13.476.0) con tres auditores en paralelo, más comprobaciones directas mías de los casos dudosos.

## Estado verificado

- **Críticos (C1–C5): 5/5 cerrados.**
- **Altos: 12/13 cerrados.** A10 sí está implementado (no sólo comentado): `tcEsFallback` viaja desde `agregador.ts:126` hasta el aviso en `ProfitDashboardEjecutivo.tsx:101`. Queda A11 con un sitio residual.
- **Medios: 15/17 cerrados.** Abiertos: M9 y M16.
- **Bajos: 9/9 cerrados.**

## Lo que falta corregir (3 cosas)

### 1. A11 — Fecha de vigencia de la cotización en UTC
`src/features/cotizacion/services/mutations/crear.ts:31-36` calcula la vigencia con `fechaVigencia.toISOString().split("T")[0]`. Después de las 18:00 hora de México eso guarda la fecha del día siguiente, así que la cotización vence un día tarde. Se cambia al helper de fecha local México que ya usan `facturasCrud.ts` y `sincronizarEtapa.ts`.

### 2. M9 — Estado de cuenta CxC por correo: parciales excluidas y una sola moneda
En `supabase/functions/cxc-estado-cuenta-enviar/index.ts`:
- `calcularTotales` (líneas ~94-105) descarta las facturas `Parcialmente pagada` del monto **vencido**, aunque su saldo restante sí esté vencido.
- La función recibe una "moneda dominante" tomada de `facturas[0].moneda` y filtra todo el estado de cuenta a esa divisa: si el cliente tiene facturas en MXN y USD, las de la otra moneda desaparecen del total, del saldo y del vencido.

Corrección: contar las parciales vencidas por su saldo, y calcular totales **por moneda** (mapa `{MXN: {...}, USD: {...}}`) para que la plantilla del correo muestre un bloque por divisa en lugar de sumar peras con manzanas.

### 3. M16 — `.env` sigue versionado
Ya está en `.gitignore`, pero el archivo continúa en el índice de git, así que los cambios se siguen registrando. Sacarlo del control de versiones requiere una operación de git que no ejecuto desde aquí; lo dejo señalado con la instrucción exacta y, como el archivo apunta al backend real, recomiendo además rotar las llaves publicables. Las llaves son públicas por diseño (`anon`/publishable), así que es higiene de repositorio, no fuga de credenciales.

## Pruebas

- Test de `crearCotizacion` con reloj congelado a las 19:00 hora de México: la vigencia debe caer en el día correcto (A11).
- Tests de la función de correo: cliente con facturas MXN + USD (totales separados por divisa) y factura `Parcialmente pagada` vencida (su saldo entra al vencido) (M9).
- Corrida completa de la suite antes de cerrar.

## Notas técnicas

- Sin cambios de esquema ni de RLS: A11 es un helper de fecha, M9 es cálculo dentro de la edge function y su plantilla.
- La lógica de totales de M9 se extrae a un módulo puro exportado para poder probarla sin desplegar la función.
- Cierre con `APP_VERSION` `13.477.0` y entrada en `CHANGELOG.md`.
