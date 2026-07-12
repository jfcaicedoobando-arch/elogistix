import { useQuery } from "@tanstack/react-query";
import {
  fetchCxpPorCapturar,
  fetchCxpPorPagar,
  fetchCarteraPendiente,
} from "../services/bandejas";
import { bandejas } from "../queryKeys";

const STALE = 30_000;

export const useCxpPorCapturar = () =>
  useQuery({ queryKey: bandejas.cxpPorCapturar, queryFn: fetchCxpPorCapturar, staleTime: STALE });

export const useCxpPorPagar = () =>
  useQuery({ queryKey: bandejas.cxpPorPagar, queryFn: fetchCxpPorPagar, staleTime: STALE });

export const useCarteraPendiente = () =>
  useQuery({ queryKey: bandejas.carteraPendiente, queryFn: fetchCarteraPendiente, staleTime: STALE });

