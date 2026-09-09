import { useEffect, useRef, useState } from "react";

const HEADER_OFFSET_PX = 88;

function scrollParent(el: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = el.parentElement;
  while (current) {
    const overflowY = window.getComputedStyle(current).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function useAvailableHeight(ref: React.RefObject<HTMLElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const element = ref.current;
      if (!element) return;
      const footer = document.querySelector<HTMLElement>("[data-wizard-footer]");
      const bottom = footer?.getBoundingClientRect().top ?? window.innerHeight;
      setHeight(Math.max(160, Math.round(bottom - element.getBoundingClientRect().top - 8)));
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [ref]);
  return height;
}

/** Mantiene sincronizado el panel del Paso 1 con el scroll real del wizard. */
export function usePaso1ProgressNavigation(sectionIds: string[]) {
  const asideRef = useRef<HTMLElement>(null);
  const availableHeight = useAvailableHeight(asideRef);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const calculate = () => {
      frame = 0;
      const elements = sectionIds
        .map((id) => ({ id, element: document.getElementById(id) }))
        .filter((item): item is { id: string; element: HTMLElement } => item.element !== null);
      if (elements.length === 0) return;
      const scroller = scrollParent(elements[0].element);
      if (scroller && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) {
        setActiveId(elements[elements.length - 1].id);
        return;
      }
      const limit = (scroller?.getBoundingClientRect().top ?? 0) + HEADER_OFFSET_PX;
      let current = elements[0].id;
      for (const { id, element } of elements) {
        if (element.getBoundingClientRect().top <= limit) current = id;
        else break;
      }
      setActiveId(current);
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(calculate);
    };
    calculate();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [sectionIds]);

  const navigateTo = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    setActiveId(id);
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return { activeId, asideRef, availableHeight, navigateTo };
}