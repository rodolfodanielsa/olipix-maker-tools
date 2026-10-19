export type Rounding = 'none' | 'euro' | 'ninety';

export interface PriceInput {
  grams: number;
  hours: number;
  minutes: number;
  /** Filament price per kg. */
  filamentPerKg: number;
  /** Average draw while printing, in watts. */
  powerW: number;
  /** Electricity price per kWh. */
  kwh: number;
  /** Wear and amortisation of the printer, per hour. */
  machinePerHour: number;
  /** One-off cost for the whole plate (prep, build plate, packaging). */
  setup: number;
  /** Extra on the running costs to cover failed prints, in %. */
  failurePercent: number;
  /** Profit as a % of cost. Ignored when `fixedProfit` is set. */
  marginPercent: number;
  /** Profit as a fixed amount for the whole plate. Wins over the margin. */
  fixedProfit: number | null;
  vatPercent: number;
  /** How many identical pieces the plate holds; grams and time are for the whole plate. */
  pieces: number;
  rounding: Rounding;
}

export interface PriceResult {
  costs: { material: number; energy: number; machine: number; failures: number; setup: number; total: number };
  profit: number;
  /** Margin actually obtained, as a % of cost. */
  marginPercent: number;
  vatPercent: number;
  /** Per piece. */
  withoutVat: number;
  vat: number;
  rounding: number;
  withVat: number;
  pieces: number;
  /** Whole plate. */
  totalWithVat: number;
}

const cents = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const positive = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

function roundUp(price: number, mode: Rounding): number {
  if (mode === 'euro') return Math.ceil(cents(price));
  if (mode === 'ninety') return cents(Math.ceil(cents(price) - 0.9) + 0.9);
  return price;
}

/** Null until there is something to price (no weight and no time). */
export function calculate(input: PriceInput): PriceResult | null {
  const grams = positive(input.grams);
  const hours = positive(input.hours) + positive(input.minutes) / 60;
  if (grams === 0 && hours === 0) return null;

  const pieces = Math.max(1, Math.floor(positive(input.pieces)) || 1);
  const material = (grams * positive(input.filamentPerKg)) / 1000;
  const energy = (hours * positive(input.powerW) * positive(input.kwh)) / 1000;
  const machine = hours * positive(input.machinePerHour);
  const failures = ((material + energy + machine) * positive(input.failurePercent)) / 100;
  const setup = positive(input.setup);
  const total = material + energy + machine + failures + setup;

  const profit = input.fixedProfit !== null ? positive(input.fixedProfit) : (total * positive(input.marginPercent)) / 100;
  const vatPercent = positive(input.vatPercent);

  const unrounded = cents(((total + profit) * (1 + vatPercent / 100)) / pieces);
  const withVat = cents(roundUp(unrounded, input.rounding));
  const withoutVat = cents(withVat / (1 + vatPercent / 100));

  return {
    costs: {
      material: cents(material),
      energy: cents(energy),
      machine: cents(machine),
      failures: cents(failures),
      setup: cents(setup),
      total: cents(total),
    },
    profit: cents(profit),
    marginPercent: total > 0 ? cents(((withoutVat * pieces - total) / total) * 100) : 0,
    vatPercent,
    withoutVat,
    vat: cents(withVat - withoutVat),
    rounding: cents(withVat - unrounded),
    withVat,
    pieces,
    totalWithVat: cents(withVat * pieces),
  };
}
