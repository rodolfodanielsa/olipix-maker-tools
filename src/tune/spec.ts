export type Scope = 'process' | 'filament';

export type Spec =
  | { label: string; type: 'float' | 'int' | 'percent'; min: number; max: number }
  | { label: string; type: 'bool' }
  | { label: string; type: 'enum'; values: readonly string[] };

const INFILL_PATTERNS = ['monotonic', 'monotonicline', 'zig-zag', 'grid', 'line', 'cubic', 'triangles', 'tri-hexagon', 'gyroid', 'honeycomb', 'adaptivecubic', 'alignedrectilinear', '3dhoneycomb', 'hilbertcurve', 'archimedeanchords', 'octagramspiral', 'supportcubic', 'lightning', 'crosshatch'];
const SURFACE_PATTERNS = ['concentric', 'zig-zag', 'monotonic', 'monotonicline', 'alignedrectilinear', 'hilbertcurve', 'archimedeanchords', 'octagramspiral'];

const f = (label: string, min: number, max: number): Spec => ({ label, type: 'float', min, max });
const i = (label: string, min: number, max: number): Spec => ({ label, type: 'int', min, max });
const e = (label: string, values: readonly string[]): Spec => ({ label, type: 'enum', values });
const b = (label: string): Spec => ({ label, type: 'bool' });

export const PROCESS: Record<string, Spec> = {
  layer_height: f('Altura de camada (mm)', 0.04, 0.6),
  initial_layer_print_height: f('Altura da 1.ª camada (mm)', 0.08, 0.6),
  wall_loops: i('Paredes', 1, 12),
  top_shell_layers: i('Camadas de topo', 0, 30),
  bottom_shell_layers: i('Camadas de base', 0, 30),
  top_shell_thickness: f('Espessura mínima do topo (mm)', 0, 5),
  bottom_shell_thickness: f('Espessura mínima da base (mm)', 0, 5),
  sparse_infill_density: { label: 'Enchimento', type: 'percent', min: 0, max: 100 },
  sparse_infill_pattern: e('Padrão de enchimento', INFILL_PATTERNS),
  top_surface_pattern: e('Padrão da superfície de topo', SURFACE_PATTERNS),
  wall_generator: e('Gerador de paredes', ['classic', 'arachne']),
  seam_position: e('Posição da costura', ['nearest', 'aligned', 'back', 'random']),
  detect_thin_wall: b('Detetar paredes finas'),
  ironing_type: e('Engomar', ['no ironing', 'top', 'topmost', 'solid']),
  enable_support: b('Suportes'),
  support_type: e('Tipo de suporte', ['normal(auto)', 'tree(auto)', 'normal(manual)', 'tree(manual)']),
  support_threshold_angle: i('Ângulo limite dos suportes (°)', 0, 90),
  brim_type: e('Brim', ['auto_brim', 'brim_ears', 'outer_only', 'inner_only', 'outer_and_inner', 'no_brim']),
  brim_width: f('Largura do brim (mm)', 0, 20),
  enable_prime_tower: b('Torre de purga'),
  outer_wall_speed: f('Velocidade da parede exterior (mm/s)', 10, 1000),
  inner_wall_speed: f('Velocidade das paredes interiores (mm/s)', 10, 1000),
  sparse_infill_speed: f('Velocidade do enchimento (mm/s)', 10, 1000),
  top_surface_speed: f('Velocidade da superfície de topo (mm/s)', 10, 1000),
  initial_layer_speed: f('Velocidade da 1.ª camada (mm/s)', 10, 500),
  elefant_foot_compensation: f('Compensação do pé de elefante (mm)', 0, 1),
  xy_hole_compensation: f('Compensação XY de furos (mm)', -1, 1),
  xy_contour_compensation: f('Compensação XY de contornos (mm)', -1, 1),
};

export const FILAMENT: Record<string, Spec> = {
  nozzle_temperature: i('Temperatura do bico (°C)', 150, 350),
  nozzle_temperature_initial_layer: i('Temperatura do bico na 1.ª camada (°C)', 150, 350),
  fan_max_speed: i('Ventoinha máxima (%)', 0, 100),
  fan_min_speed: i('Ventoinha mínima (%)', 0, 100),
  filament_max_volumetric_speed: f('Fluxo volumétrico máximo (mm³/s)', 1, 60),
};

/** The bed temperature keys follow the plate the project is set to print on. */
export const BED_KEYS: Record<string, string> = {
  'Cool Plate': 'cool_plate_temp',
  'Engineering Plate': 'eng_plate_temp',
  'High Temp Plate': 'hot_plate_temp',
  'Textured PEI Plate': 'textured_plate_temp',
  'Supertack Plate': 'supertack_plate_temp',
};

const BED_SPEC: Spec = i('Temperatura da base (°C)', 0, 120);

export function bedSpec(key: string): Spec | null {
  const base = key.replace(/_initial_layer$/, '');
  return Object.values(BED_KEYS).includes(base) ? BED_SPEC : null;
}

export function specFor(key: string): Spec | null {
  return PROCESS[key] ?? FILAMENT[key] ?? bedSpec(key);
}

/** What the prompt says a key accepts: "0.04–0.6", "0–100%", "0|1" or the enum values. */
export function allowed(key: string): string {
  const s = specFor(key);
  if (!s) return '';
  switch (s.type) {
    case 'bool':
      return '0|1';
    case 'enum':
      return s.values.join('|');
    case 'percent':
      return `${s.min}–${s.max}%`;
    default:
      return `${s.min}–${s.max}`;
  }
}
