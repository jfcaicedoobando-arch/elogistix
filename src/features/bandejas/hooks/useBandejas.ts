import { useQuery } from "@tanstack/react-query";
import {
  fetchCxpPorCapturar,
  fetchCxpPorPagar,
  fetchFacturacionPorEmitir,
  fetchCarteraPendiente,
} from "../services/bandejas";

const STALE = 30_000;

export const useCxpPorCapturar = () =>
  useQuery({ queryKey: ["bandeja", "cxp-por-capturar"], queryFn: fetchCxpPorCapturar, staleTime: STALE });

export const useCxpPorPagar = () =>
  useQuery({ queryKey: ["bandeja", "cxp-por-pagar"], queryFn: fetchCxpPorPagar, staleTime: STALE });

export const useFacturacionPorEmitir = () =>
  useQuery({ queryKey: ["bandeja", "facturacion-por-emitir"], queryFn: fetchFacturacionPorEmitir, staleTime: STALE });

export const useCarteraPendiente = () =>
  useQuery({ queryKey: ["bandeja", "cartera-pendiente"], queryFn: fetchCarteraPendiente, staleTime: STALE });
