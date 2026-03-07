

## Plan: Extraer SeccionMercanciaWrapper

### Análisis de duplicación

Los 3 componentes (FCL, LCL, Aérea) y también `SeccionMercanciaGeneral` comparten exactamente este bloque UI:

1. **Tipo de Carga** — Select con las mismas opciones
2. **Sector Económico** — Select con las mismas opciones
3. **Descripción Adicional** — Textarea
4. **MSDS condicional** — Input file cuando `tipoCarga === 'Mercancía Peligrosa'`

Las constantes `TIPOS_CARGA` y `SECTORES` están duplicadas en los 4 archivos.

### Cambios

**1. Crear `src/components/cotizacion/SeccionMercanciaWrapper.tsx`**

Componente wrapper que renderiza los campos compartidos + un slot `children` para contenido específico:

```text
┌─────────────────────────────────┐
│ [Tipo de Carga]  [Sector Econ.] │  ← wrapper
│ [children específicos]           │  ← slot (contenedor FCL, dimensiones, peso/vol, etc.)
│ [Descripción Adicional]          │  ← wrapper
│ [MSDS si peligrosa]              │  ← wrapper
└─────────────────────────────────┘
```

Props del wrapper: `tipoCarga`, `setTipoCarga`, `sectorEconomico`, `setSectorEconomico`, `descripcionAdicional`, `setDescripcionAdicional`, `msdsFile`, `setMsdsFile`, `children`.

Las constantes `TIPOS_CARGA` y `SECTORES` se definen solo aquí.

**2. Refactorizar `SeccionMercanciaMaritimaFCL.tsx`**

Queda solo con: Tipo de Contenedor, Peso (select). Envuelto en `<SeccionMercanciaWrapper>`.

**3. Refactorizar `SeccionMercanciaMaritimeLCL.tsx`**

Queda solo con: Tabla de dimensiones. Envuelto en `<SeccionMercanciaWrapper>`.

**4. Refactorizar `SeccionMercanciaAerea.tsx`**

Queda solo con: Tabla de dimensiones (peso volumétrico). Envuelto en `<SeccionMercanciaWrapper>`.

**5. Refactorizar `SeccionMercanciaGeneral.tsx`**

Queda solo con: Peso, Volumen, Piezas. Envuelto en `<SeccionMercanciaWrapper>`.

**6. Changelog** — Entrada v4.26.0.

No se requieren cambios en `NuevaCotizacion.tsx` ya que las props externas no cambian.

