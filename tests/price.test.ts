import { describe, expect, it } from 'vitest';
import { calculate, type PriceInput } from '../src/price/calc';

const base: PriceInput = {
  grams: 100,
  hours: 3,
  minutes: 0,
  filamentPerKg: 20,
  powerW: 150,
  kwh: 0.2,
  machinePerHour: 1,
  setup: 1,
  failurePercent: 10,
  marginPercent: 50,
  fixedProfit: null,
  vatPercent: 0,
  pieces: 1,
  rounding: 'none',
};

describe('calculate', () => {
  it('prices each cost and applies the margin', () => {
    const r = calculate(base)!;
    expect(r.costs).toEqual({ material: 2, energy: 0.09, machine: 3, failures: 0.51, setup: 1, total: 6.6 });
    expect(r.profit).toBe(3.3);
    expect(r.withVat).toBe(9.9);
    expect(r.marginPercent).toBe(50.02);
  });

  it('adds VAT on top of the price without VAT', () => {
    const r = calculate({ ...base, vatPercent: 23 })!;
    expect(r.withoutVat).toBe(9.9);
    expect(r.vat).toBe(2.28);
    expect(r.withVat).toBe(12.18);
  });

  it('lets a fixed profit win over the margin, and reports the margin it implies', () => {
    const r = calculate({ ...base, marginPercent: 200, fixedProfit: 3.4 })!;
    expect(r.profit).toBe(3.4);
    expect(r.withVat).toBe(10);
    expect(r.marginPercent).toBe(51.54);
  });

  it('splits the plate over the pieces, setup included', () => {
    const r = calculate({ ...base, pieces: 4 })!;
    expect(r.withVat).toBe(2.47);
    expect(r.totalWithVat).toBe(9.88);
  });

  it('rounds each piece up to the euro or to ,90 and shows the adjustment', () => {
    const euro = calculate({ ...base, rounding: 'euro' })!;
    expect(euro.withVat).toBe(10);
    expect(euro.rounding).toBe(0.1);

    expect(calculate({ ...base, rounding: 'ninety' })!.withVat).toBe(9.9);
    expect(calculate({ ...base, grams: 101, rounding: 'ninety' })!.withVat).toBe(10.9);
    expect(calculate({ ...base, rounding: 'none', pieces: 3 })!.rounding).toBe(0);
  });

  it('counts minutes as part of the print time', () => {
    const a = calculate({ ...base, hours: 1, minutes: 30 })!;
    const b = calculate({ ...base, hours: 1.5, minutes: 0 })!;
    expect(a.withVat).toBe(b.withVat);
  });

  it('returns nothing until there is a weight or a time', () => {
    expect(calculate({ ...base, grams: 0, hours: 0, minutes: 0 })).toBeNull();
    expect(calculate({ ...base, grams: Number.NaN, hours: 0, minutes: 0 })).toBeNull();
  });

  it('treats negative or invalid numbers as zero', () => {
    const r = calculate({ ...base, filamentPerKg: -5, powerW: Number.NaN, pieces: 0, vatPercent: -10 })!;
    expect(r.costs.material).toBe(0);
    expect(r.costs.energy).toBe(0);
    expect(r.pieces).toBe(1);
    expect(r.vatPercent).toBe(0);
  });
});

describe('printers', () => {
  it('have unique ids, names and a sane power draw', async () => {
    const { PRINTERS } = await import('../src/price/printers');
    expect(new Set(PRINTERS.map((p) => p.id)).size).toBe(PRINTERS.length);
    for (const p of PRINTERS) {
      expect(p.name).not.toBe('');
      expect(Number.isFinite(p.watts) && p.watts > 0 && p.watts < 1000).toBe(true);
    }
  });
});
