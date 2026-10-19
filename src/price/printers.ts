export interface Printer {
  id: string;
  name: string;
  /** Average draw while printing PLA, as published by the manufacturer. */
  watts: number;
}

// Only figures the manufacturers publish: Bambu Lab wiki ("Supply voltage", dynamic test, PLA)
// and the Prusa FAQ (MK series, PLA, 26 °C room). Add a printer only with a source.
export const PRINTERS: Printer[] = [
  { id: 'bambu-a1-mini', name: 'Bambu Lab A1 mini', watts: 80 },
  { id: 'bambu-a1', name: 'Bambu Lab A1', watts: 95 },
  { id: 'bambu-x1c', name: 'Bambu Lab X1C', watts: 105 },
  { id: 'bambu-h2d', name: 'Bambu Lab H2D', watts: 197 },
  { id: 'prusa-mk', name: 'Prusa MK3S+ / MK4 / MK4S', watts: 80 },
];

export const OTHER_PRINTER = 'other';
