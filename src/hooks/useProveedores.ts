import { useState } from "react";
import { Proveedor } from "@/data/types";
import { proveedores as initialProveedores } from "@/data/mockData";

// In-memory mutable store for proveedores (persists during session)
let _proveedores: Proveedor[] = [...initialProveedores];
let _listeners: Set<() => void> = new Set();

function notify() {
  _listeners.forEach(fn => fn());
}

export function useProveedores() {
  const [, setTick] = useState(0);

  useState(() => {
    const listener = () => setTick(t => t + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  });

  const updateProveedor = (id: string, data: Partial<Proveedor>) => {
    _proveedores = _proveedores.map(p => p.id === id ? { ...p, ...data } : p);
    notify();
  };

  return { proveedores: _proveedores, updateProveedor };
}
