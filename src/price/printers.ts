export interface Printer {
  id: string;
  name: string;
  /** Average draw while printing PLA, in watts. */
  watts: number;
}

// Average draw while printing PLA. Bambu Lab and Prusa figures are the manufacturers' own
// (Bambu wiki "Supply voltage", dynamic test; Prusa FAQ, MK series, 26 °C room); the others are
// approximate or the midpoint of a published range, so keep them rounded.
export const PRINTERS: Printer[] = [
  { id: 'bambu-a1-mini', name: 'Bambu Lab A1 mini', watts: 80 },
  { id: 'bambu-a1', name: 'Bambu Lab A1', watts: 95 },
  { id: 'bambu-p1s', name: 'Bambu Lab P1S', watts: 105 },
  { id: 'bambu-x1c', name: 'Bambu Lab X1 Carbon', watts: 105 },
  { id: 'bambu-p1p', name: 'Bambu Lab P1P', watts: 110 },
  { id: 'bambu-a2l', name: 'Bambu Lab A2L', watts: 145 },
  { id: 'bambu-h2s', name: 'Bambu Lab H2S', watts: 200 },
  { id: 'bambu-h2d', name: 'Bambu Lab H2D', watts: 197 },
  { id: 'prusa-mk4s', name: 'Prusa MK4S', watts: 80 },
  { id: 'creality-ender3-v3-se', name: 'Creality Ender 3 V3 SE', watts: 125 },
  { id: 'creality-k1', name: 'Creality K1', watts: 100 },
  { id: 'snapmaker-u1', name: 'Snapmaker U1', watts: 123 },
  { id: 'flashforge-creator-5', name: 'Flashforge Creator 5', watts: 150 },
];

export const OTHER_PRINTER = 'other';
