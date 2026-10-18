import { expect } from '@playwright/test';
import Decimal from 'decimal.js';

const treatments = ['gravado_16', 'gravado_8', 'tasa_0', 'exento', 'no_objeto'];
const optionNames = ['IVA 16%', 'IVA 8% (frontera)', 'Tasa 0%', 'Exento', /No objeto de impuesto/];
const seed = () => Array.from({ length: 20 }, (_, i) => ({
  descripcion: `Servicio sintético ${i + 1}`, cantidad: 1.123456 + i % 3,
  precio_unitario: 123.4567 + i, clave_sat: '78101800', tipo_iva: treatments[i % 5],
}));
const money = n => new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

// Independent oracle: no production arithmetic, formatter or fixture imports.
function expectedTotals(rows) {
  let subtotal = new Decimal(0), iva = new Decimal(0);
  for (const row of rows) {
    const quantity = new Decimal(row.cantidad).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
    const line = money(quantity.times(row.precio_unitario));
    const rate = row.tipo_iva === 'gravado_16' ? 0.16 : row.tipo_iva === 'gravado_8' ? 0.08 : 0;
    subtotal = subtotal.plus(line);
    iva = iva.plus(money(line.times(rate)));
  }
  return { subtotal: subtotal.toFixed(2), iva: iva.toFixed(2), total: subtotal.plus(iva).toFixed(2) };
}

/** Functional checks only; the runner keeps these outside timing samples. */
export async function functional(page, variant, baseUrl) {
  const labels = [], totalsEvidence = [];
  const url = `${baseUrl.replace(/\/$/, '')}/${variant}/?rows=20`;
  const dialog = page.getByRole('dialog', { name: 'Nueva factura manual', exact: true });
  const field = (name, row = 1) => page.getByLabel(`${name} del concepto ${row}`, { exact: true });
  const description = (row = 1) => page.locator(`#concepto-descripcion-${row - 1}`);
  const sat = (row = 1) => page.locator(`#concepto-clave-${row - 1}`);
  const removeButtons = () => page.getByRole('button', { name: /^Eliminar concepto \d+$/ });
  const notes = () => dialog.locator('textarea');
  let rows = seed();
  async function totals(stage, currency = 'MXN') {
    const expected = expectedTotals(rows), actual = {};
    for (const [key, label] of [['subtotal', 'Subtotal'], ['iva', 'IVA total'], ['total', 'Total']]) {
      const amount = dialog.getByText(label, { exact: true }).locator('..').locator('span').last();
      await expect(amount).toContainText(currency);
      const text = await amount.innerText();
      actual[key] = new Decimal(text.replace(/[^\d.,-]/g, '').replaceAll(',', '')).toFixed(2);
      expect(actual[key], `${stage}: ${key}`).toBe(expected[key]);
    }
    totalsEvidence.push({ stage, currency, expected, actual });
  }
  async function chooseIva(row, option) {
    await page.getByRole('combobox', { name: `IVA del concepto ${row}`, exact: true }).click();
    await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click();
  }
  await page.goto(url);
  await expect(dialog).toBeVisible();
  await expect(removeButtons()).toHaveCount(20);
  await totals('initial mixed IVA');
  labels.push('20 deterministic rows: per-line rounded subtotal, mixed IVA and total');

  await notes().click();
  await notes().pressSequentially('Nota de prueba determinista');
  await expect(notes()).toBeFocused();
  await expect(notes()).toHaveValue('Nota de prueba determinista');
  await totals('notes preserve totals');
  await description().click();
  await description().press('End');
  await description().pressSequentially(' verificado');
  await expect(description()).toBeFocused();
  await expect(description()).toHaveValue(`${rows[0].descripcion} verificado`);
  rows[0].descripcion += ' verificado';
  await sat().fill('80101500');
  await expect(sat()).toHaveValue('80101500');
  rows[0].clave_sat = '80101500';
  labels.push('Notes and concept typing retain focus; description and SAT edits persist');

  await field('Cantidad').fill('');
  await field('Cantidad').pressSequentially('1.234567');
  await expect(field('Cantidad')).toBeFocused();
  await expect(field('Cantidad')).toHaveValue('1.234567');
  await field('Cantidad').pressSequentially('8');
  await expect(field('Cantidad')).toHaveValue('1.234567');
  await field('Cantidad').press('Tab');
  await expect(field('Cantidad')).toHaveValue('1.234567');
  rows[0].cantidad = 1.234567;
  await field('Precio unitario').fill('');
  await field('Precio unitario').pressSequentially('12.3456');
  await expect(field('Precio unitario')).toHaveValue('12.3456');
  await field('Precio unitario').pressSequentially('7');
  await expect(field('Precio unitario')).toHaveValue('12.3456');
  await field('Precio unitario').press('Tab');
  rows[0].precio_unitario = 12.3456;
  await totals('six-decimal quantity and four-decimal price');
  labels.push('Quantity keeps six decimals and rejects seventh; price keeps four and rejects fifth');

  for (let i = 0; i < treatments.length; i++) {
    await chooseIva(1, optionNames[i]);
    rows[0].tipo_iva = treatments[i];
    await totals(`row 1 IVA ${treatments[i]}`);
  }
  labels.push('All five per-row IVA treatments recalculate canonical totals');
  for (const currency of ['USD', 'EUR', 'MXN']) {
    await dialog.getByRole('button', { name: currency, exact: true }).click();
    await expect(dialog.getByRole('button', { name: currency, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await totals(`currency ${currency}`, currency);
  }
  labels.push('MXN/USD/EUR update display without altering documentary amounts');

  await dialog.getByRole('button', { name: /Agregar concepto/ }).click();
  rows.push({ descripcion: '', cantidad: 1, precio_unitario: 0, clave_sat: '78101800', tipo_iva: 'gravado_16' });
  await expect(removeButtons()).toHaveCount(21);
  await expect(field('Cantidad', 21)).toHaveValue('1');
  await expect(sat(21)).toHaveValue('78101800');
  await totals('add default concept');
  await page.getByRole('button', { name: 'Eliminar concepto 2', exact: true }).click();
  rows.splice(1, 1);
  await expect(description(2)).toHaveValue(rows[1].descripcion);
  await expect(field('Cantidad', 2)).toHaveValue(String(rows[1].cantidad));
  await totals('remove middle concept');
  while (rows.length > 1) { await removeButtons().last().click(); rows.pop(); }
  await expect(removeButtons()).toHaveCount(1);
  await expect(removeButtons()).toBeDisabled();
  await totals('last concept cannot be removed');
  labels.push('Add, middle removal, shifted NumericInput state and final-row deletion guard');

  await dialog.getByRole('button', { name: 'EUR', exact: true }).click();
  await totals('fiscal currency before cancellation', 'EUR');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Seguir capturando', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(notes()).toHaveValue('Nota de prueba determinista');
  await expect(description()).toHaveValue(rows[0].descripcion);
  await expect(dialog.getByRole('button', { name: 'EUR', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Descartar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir captura', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(notes()).toHaveValue('');
  await expect(description()).toHaveValue('');
  await expect(field('Cantidad')).toHaveValue('1');
  await expect(field('Precio unitario')).toHaveValue('');
  await expect(removeButtons()).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'MXN', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('combobox').first()).toContainText('Selecciona un cliente');
  rows = [{ descripcion: '', cantidad: 1, precio_unitario: 0, tipo_iva: 'gravado_16' }];
  await totals('discard and reopen resets to empty capture');
  labels.push('Cancel preserves capture; Escape offers discard; reopen resets notes, rows and totals');

  await page.goto(`${url}&border=0`);
  rows = seed();
  await expect(dialog).toBeVisible();
  await totals('border disabled preserves legacy 8 percent');
  await page.getByRole('combobox', { name: 'IVA del concepto 1', exact: true }).click();
  await expect(page.getByRole('option', { name: optionNames[1], exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'IVA del concepto 2', exact: true }).click();
  await expect(page.getByRole('option', { name: optionNames[1], exact: true })).toBeEnabled();
  await page.getByRole('option', { name: optionNames[1], exact: true }).click();
  await totals('legacy 8 percent remains selectable');
  await chooseIva(2, optionNames[0]);
  rows[1].tipo_iva = 'gravado_16';
  await totals('legacy row changed to 16 percent');
  await page.getByRole('combobox', { name: 'IVA del concepto 2', exact: true }).click();
  await expect(page.getByRole('option', { name: optionNames[1], exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  labels.push('Border-disabled blocks new 8 percent while retaining a seeded legacy 8 percent row');
  return { variant, assertions: labels.length, labels, totals: totalsEvidence };
}
