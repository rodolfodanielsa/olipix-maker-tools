import { currentLang } from '../i18n';
import { bedSpec, type Spec } from './spec';

export const LABELS_EN: Record<string, string> = {
  layer_height: 'Layer height (mm)',
  initial_layer_print_height: 'First layer height (mm)',
  wall_loops: 'Walls',
  top_shell_layers: 'Top layers',
  bottom_shell_layers: 'Bottom layers',
  top_shell_thickness: 'Minimum top thickness (mm)',
  bottom_shell_thickness: 'Minimum bottom thickness (mm)',
  sparse_infill_density: 'Infill',
  sparse_infill_pattern: 'Infill pattern',
  top_surface_pattern: 'Top surface pattern',
  wall_generator: 'Wall generator',
  seam_position: 'Seam position',
  detect_thin_wall: 'Detect thin walls',
  ironing_type: 'Ironing',
  enable_support: 'Supports',
  support_type: 'Support type',
  support_threshold_angle: 'Support threshold angle (°)',
  brim_type: 'Brim',
  brim_width: 'Brim width (mm)',
  enable_prime_tower: 'Prime tower',
  outer_wall_speed: 'Outer wall speed (mm/s)',
  inner_wall_speed: 'Inner wall speed (mm/s)',
  sparse_infill_speed: 'Infill speed (mm/s)',
  top_surface_speed: 'Top surface speed (mm/s)',
  initial_layer_speed: 'First layer speed (mm/s)',
  elefant_foot_compensation: 'Elephant foot compensation (mm)',
  xy_hole_compensation: 'XY hole compensation (mm)',
  xy_contour_compensation: 'XY contour compensation (mm)',
  nozzle_temperature: 'Nozzle temperature (°C)',
  nozzle_temperature_initial_layer: 'First layer nozzle temperature (°C)',
  fan_max_speed: 'Maximum fan speed (%)',
  fan_min_speed: 'Minimum fan speed (%)',
  filament_max_volumetric_speed: 'Maximum volumetric flow (mm³/s)',
};

const BED_EN = 'Bed temperature (°C)';

/** The setting's name in the page language. spec.ts keeps the Portuguese labels so it stays in step with the PHP tuner. */
export function labelOf(key: string, spec: Spec): string {
  if (currentLang() !== 'en') return spec.label;
  return LABELS_EN[key] ?? (bedSpec(key) ? BED_EN : spec.label);
}
