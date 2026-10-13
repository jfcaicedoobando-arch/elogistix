import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ReporteEjecutivoDocument } from '@/pdf/documents/ReporteEjecutivoDocument';
import type { SnapshotEjecutivo } from '../types';
vi.mock('@react-pdf/renderer',()=>({Document:({children}:{children?:ReactNode})=><div>{children}</div>,Page:({children}:{children?:ReactNode})=><div>{children}</div>,Text:({children}:{children?:ReactNode})=><span>{children}</span>,StyleSheet:{create:(o:unknown)=>o},Font:{register:vi.fn(),registerHyphenationCallback:vi.fn()}}));
vi.mock('@/pdf/components/ReportHeader',()=>({ReportHeader:({children}:{children?:ReactNode})=><div>{children}</div>}));
vi.mock('@/pdf/components/ReportSummary',()=>({ReportSummary:({items}:{items:{label:string,value:string}[]})=><div>{items.map(x=><div key={x.label}>{x.label}: {x.value}</div>)}</div>}));
vi.mock('@/pdf/components/Footer',()=>({Footer:()=>null}));
vi.mock('@/pdf/components/DataTable',()=>({DataTable:()=>null}));
const snapshot={periodo:'2026-09',fuente:'facturas',generadoEn:'2026-10-01T12:00:00Z',tipoCambioUsd:20,tcEsFallback:false,vencimientos:{fechaReferencia:'2026-10-01'},tesoreria:{cuentas:[]},topDeudores:[],topAcreedores:[],alertas:[],kpis:{ingresos_mxn:0,utilidad_mxn:-100,margen_pct:0,saldo_bancos_mxn:0,saldo_bancos_incompleto:true,eerr_incompleto:true}} as unknown as SnapshotEjecutivo;
describe('export ejecutivo conserva completitud',()=>{
 it('PDF etiqueta ingresos, utilidad y bancos parciales y no inventa margen',()=>{
  render(<ReporteEjecutivoDocument snapshot={snapshot}/>);
  expect(screen.getByText('Ingresos: Parcial: MXN 0.00')).toBeInTheDocument();
  expect(screen.getByText('Utilidad: Parcial: MXN -100.00')).toBeInTheDocument();
  expect(screen.getByText('Bancos: Parcial: MXN 0.00')).toBeInTheDocument();
  expect(screen.getByText('Margen: No disponible')).toBeInTheDocument();
 });
 it('PDF con ingreso0 completo explica margen no calculable',()=>{
  render(<ReporteEjecutivoDocument snapshot={{...snapshot,kpis:{...snapshot.kpis,eerr_incompleto:false}}}/>);
  expect(screen.getByText('Margen: No calculable')).toBeInTheDocument();
 });
});
