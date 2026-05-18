import { formatCurrency, formatDate } from '@/lib/formatters';
import { escapeHtml as esc } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type ProformaRow = Tables<'proformas'>;
type EmbarqueRow = Tables<'embarques'>;
type ClienteRow = Tables<'clientes'>;

type EmbarqueLite = Pick<EmbarqueRow,
  'expediente' | 'bl_master' | 'modo' | 'tipo' | 'incoterm'
  | 'puerto_origen' | 'puerto_destino' | 'aeropuerto_origen' | 'aeropuerto_destino'
  | 'ciudad_origen' | 'ciudad_destino' | 'naviera' | 'aerolinea' | 'descripcion_mercancia'>;

type ClienteLite = Pick<ClienteRow, 'nombre' | 'rfc' | 'direccion' | 'ciudad' | 'estado' | 'cp'> | null | undefined;

function buildHeaderMeta(proforma: ProformaRow, esConsolidada: boolean): string {
  return `
    <div class="meta">
      <span class="badge">SIN VALIDEZ FISCAL</span>
      ${esConsolidada ? '<span class="badge badge-blue" style="margin-left:6px">CONSOLIDADA</span>' : ''}
      <p style="margin-top:6px"><strong>Fecha de emisión:</strong> ${formatDate(proforma.fecha_emision)}</p>
      <p><strong>Expediente:</strong> ${esc(proforma.expediente)}</p>
      ${proforma.bl_master ? `<p><strong>BL/MAWB:</strong> ${esc(proforma.bl_master)}</p>` : ''}
    </div>`;
}

function buildClienteSection(proforma: ProformaRow, cliente: ClienteLite): string {
  const direccionCompleta = cliente
    ? [cliente.direccion, cliente.ciudad, cliente.estado, cliente.cp].filter(Boolean).join(', ')
    : '';
  return `
  <section>
    <h3>Datos del Cliente</h3>
    <div class="grid">
      <div class="cell"><span class="label">Razón Social</span><span class="value">${esc(cliente?.nombre || proforma.cliente_nombre)}</span></div>
      <div class="cell"><span class="label">RFC</span><span class="value">${esc(cliente?.rfc || '-')}</span></div>
      <div class="cell" style="grid-column: 1 / -1"><span class="label">Dirección</span><span class="value">${esc(direccionCompleta || '-')}</span></div>
    </div>
  </section>`;
}

function buildEmbarqueSection(embarque: EmbarqueLite): string {
  const origen = embarque.puerto_origen || embarque.aeropuerto_origen || embarque.ciudad_origen || '-';
  const destino = embarque.puerto_destino || embarque.aeropuerto_destino || embarque.ciudad_destino || '-';
  return `
  <section>
    <h3>Datos del Embarque</h3>
    <div class="grid-3">
      <div class="cell"><span class="label">Modo</span><span class="value">${esc(embarque.modo)}</span></div>
      <div class="cell"><span class="label">Tipo</span><span class="value">${esc(embarque.tipo)}</span></div>
      <div class="cell"><span class="label">Incoterm</span><span class="value">${esc(embarque.incoterm)}</span></div>
      <div class="cell"><span class="label">Origen</span><span class="value">${esc(origen)}</span></div>
      <div class="cell"><span class="label">Destino</span><span class="value">${esc(destino)}</span></div>
      <div class="cell"><span class="label">Ruta</span><span class="value">${esc(origen)} → ${esc(destino)}</span></div>
    </div>
    ${embarque.descripcion_mercancia ? `<p style="margin-top:8px"><span class="label">Descripción de la mercancía:</span> <strong>${esc(embarque.descripcion_mercancia)}</strong></p>` : ''}
  </section>`;
}

function buildCondicionesSection(proforma: ProformaRow): string {
  const credito = proforma.dias_credito == null
    ? '—'
    : (Number(proforma.dias_credito) === 0 ? 'Contado' : `${proforma.dias_credito} días`);
  return `
  <section>
    <h3>Condiciones Comerciales</h3>
    <div class="grid">
      <div class="cell"><span class="label">Ejecutivo de Operaciones</span><span class="value">${esc(proforma.operador || '—')}</span></div>
      <div class="cell"><span class="label">Días de crédito</span><span class="value">${credito}</span></div>
    </div>
  </section>`;
}

export function buildProformaHeaderHtml(proforma: ProformaRow, cliente: ClienteLite, embarque: EmbarqueLite, esConsolidada: boolean): string {
  return `
  <div class="header">
    <div>
      <h1>PROFORMA${esConsolidada ? ' CONSOLIDADA' : ''}</h1>
      <p class="numero">${esc(proforma.numero)}</p>
    </div>
    ${buildHeaderMeta(proforma, esConsolidada)}
  </div>

  ${buildClienteSection(proforma, cliente)}
  ${esConsolidada ? '' : buildEmbarqueSection(embarque)}
  ${buildCondicionesSection(proforma)}`;
}

export type { EmbarqueLite, ClienteLite };
