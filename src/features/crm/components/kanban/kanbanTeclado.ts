import type { Announcements, KeyboardCoordinateGetter } from "@dnd-kit/core";

/** Cada flecha horizontal elige una etapa, incluso cuando la columna está vacía. */
export const coordenadasEtapaTeclado: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  if (event.code !== "ArrowRight" && event.code !== "ArrowLeft") return;
  const { collisionRect, droppableContainers, droppableRects } = context;
  if (!collisionRect) return;
  event.preventDefault();
  const centroActual = collisionRect.left + collisionRect.width / 2;
  const derecha = event.code === "ArrowRight";
  const destinos = droppableContainers.getEnabled().flatMap(({ id }) => {
    const rect = droppableRects.get(id);
    if (!rect) return [];
    const distancia = rect.left + rect.width / 2 - centroActual;
    return (derecha ? distancia > 1 : distancia < -1) ? [{ rect, distancia: Math.abs(distancia) }] : [];
  }).sort((a, b) => a.distancia - b.distancia);
  const destino = destinos[0]?.rect;
  if (!destino) return;
  return {
    x: currentCoordinates.x + destino.left + destino.width / 2 - centroActual,
    y: currentCoordinates.y + destino.top + 8 - collisionRect.top,
  };
};

export const instruccionesKanban = {
  draggable: "Para mover una oportunidad, pulsa Espacio o Enter en su botón Mover. Usa las flechas izquierda y derecha para elegir una etapa. Pulsa Espacio o Enter para soltar, o Escape para cancelar.",
};

export const anunciosKanban: Announcements = {
  onDragStart: ({ active }) => `Moviendo ${active.data.current?.nombre ?? "oportunidad"}. Elige una etapa con las flechas izquierda y derecha.`,
  onDragOver: ({ over }) => over ? `Etapa de destino: ${over.data.current?.nombre ?? "sin nombre"}.` : "Fuera de una etapa de destino.",
  onDragEnd: ({ over }) => over ? `Destino elegido: ${over.data.current?.nombre ?? "etapa"}. Revisa el resultado del cambio.` : "Movimiento cancelado: no se eligió una etapa.",
  onDragCancel: () => "Movimiento cancelado. La oportunidad conserva su etapa.",
};
