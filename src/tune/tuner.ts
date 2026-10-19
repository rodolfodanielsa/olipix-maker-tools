import JSZip from 'jszip';
import { BED_KEYS, FILAMENT, PROCESS, Scope, Spec, specFor } from './spec';

const SETTINGS = 'Metadata/project_settings.config';

type Project = Record<string, unknown>;

export interface Setting { key: string; label: string; value: string; scope: Scope }
export interface FilamentSlot { slot: number; used: boolean; type: string; color: string | null; profile: string | null }
export interface Summary {
  printer: string | null;
  nozzle: number | null;
  bed: string | null;
  savedBy: string | null;
  plates: number;
  objects: string[];
  filaments: FilamentSlot[];
  settings: Setting[];
  overrides: { object: string; keys: string[] }[];
}
export interface Change { key: string; label: string; before: string; after: string; reason: string }
export interface Rejected { key: string; why: string }
export interface Proposed { key: unknown; value?: unknown; reason?: unknown }

export class TuneError extends Error {}

export interface Loaded { zip: JSZip; project: Project; summary: Summary }

/** The value when it is a scalar or an array of identical items; null otherwise. */
function single(raw: unknown): string | null {
  if (Array.isArray(raw)) {
    const items = new Set(raw.map(String));
    return items.size === 1 ? [...items][0]! : null;
  }
  return typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : null;
}

function number(v: string): string {
  const s = String(parseFloat(Number(v).toFixed(4)));
  return s === '-0' ? '0' : s;
}

function same(before: string, after: string): boolean {
  const strip = (s: string) => s.replace(/%+$/, '');
  const a = strip(before);
  const b = strip(after);
  return a !== '' && b !== '' && !isNaN(Number(a)) && !isNaN(Number(b)) ? Math.abs(Number(a) - Number(b)) < 1e-9 : before === after;
}

function normalise(spec: Spec, raw: unknown): string | null {
  if (typeof raw === 'boolean') raw = raw ? '1' : '0';
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const v = String(raw).trim();
  switch (spec.type) {
    case 'bool': {
      const l = v.toLowerCase();
      return l === '1' || l === 'true' ? '1' : l === '0' || l === 'false' ? '0' : null;
    }
    case 'enum':
      return spec.values.includes(v) ? v : null;
    case 'percent': {
      const m = /^(\d+(?:\.\d+)?)\s*%?$/.exec(v);
      return m && Number(m[1]) >= spec.min && Number(m[1]) <= spec.max ? `${number(m[1]!)}%` : null;
    }
    case 'int':
      return /^-?\d+$/.test(v) && Number(v) >= spec.min && Number(v) <= spec.max ? String(Number(v)) : null;
    case 'float':
      return v !== '' && !isNaN(Number(v)) && Number(v) >= spec.min && Number(v) <= spec.max ? number(v) : null;
  }
}

/** Every key this project can have changed, with its scope; keys the file lacks (or holds as differing per-variant values) are left out. */
function specs(project: Project): Map<string, { spec: Spec; scope: Scope }> {
  const out = new Map<string, { spec: Spec; scope: Scope }>();
  for (const [k, spec] of Object.entries(PROCESS)) out.set(k, { spec, scope: 'process' });
  const bed = BED_KEYS[single(project.curr_bed_type) ?? ''] ?? 'hot_plate_temp';
  const filament: Record<string, Spec> = { ...FILAMENT };
  for (const k of [bed, `${bed}_initial_layer`]) filament[k] = specFor(k)!;
  for (const [k, spec] of Object.entries(filament)) out.set(k, { spec, scope: 'filament' });
  for (const k of [...out.keys()]) if (single(project[k]) === null) out.delete(k);
  return out;
}

const parseXml = (text: string): Document | null => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  return doc.getElementsByTagName('parsererror').length ? null : doc;
};

const children = (el: Element, tag: string): Element[] => [...el.children].filter((c) => c.tagName === tag);

export async function load(data: ArrayBuffer | Uint8Array | Blob): Promise<Loaded> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new TuneError('Não foi possível abrir o ficheiro 3MF.');
  }
  if (Object.keys(zip.files).some((n) => /^Metadata\/plate_\d+\.gcode$/.test(n))) {
    throw new TuneError('Este 3MF já está fatiado. Envia o projeto (.3mf) guardado no Bambu Studio, sem G-code: mudar definições num ficheiro fatiado deixava o G-code desatualizado.');
  }
  let project: Project = {};
  try {
    const raw = zip.file(SETTINGS);
    const parsed = raw ? JSON.parse(await raw.async('string')) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) project = parsed as Project;
  } catch {
    // treated as missing below
  }
  if (!Object.keys(project).length) {
    throw new TuneError('Este 3MF não tem definições do Bambu Studio (Metadata/project_settings.config). Abre-o e guarda-o no Bambu Studio primeiro.');
  }

  const modelFile = zip.file('Metadata/model_settings.config');
  const model = modelFile ? parseXml(await modelFile.async('string')) : null;
  const painted = await isPainted(zip);
  const savedBy = await application(zip);

  const objects: string[] = [];
  const overrides: { object: string; keys: string[] }[] = [];
  const used = new Set<number>();
  for (const object of model ? [...model.getElementsByTagName('object')] : []) {
    let name: string | null = null;
    const keys: string[] = [];
    let extruder = 1;
    for (const m of children(object, 'metadata')) {
      const key = m.getAttribute('key') ?? '';
      if (key === 'name') name = m.getAttribute('value') ?? '';
      else if (key === 'extruder') extruder = Math.max(1, parseInt(m.getAttribute('value') ?? '1', 10) || 1);
      else if (specFor(key)) keys.push(key);
    }
    for (const part of children(object, 'part')) {
      let slot = extruder;
      for (const m of children(part, 'metadata')) {
        const key = m.getAttribute('key') ?? '';
        if (key === 'extruder') slot = Math.max(1, parseInt(m.getAttribute('value') ?? '1', 10) || 1);
        else if (specFor(key)) keys.push(key);
      }
      const subtype = part.getAttribute('subtype') ?? '';
      if (subtype === '' || subtype === 'normal_part') used.add(slot);
    }
    name ??= `objeto ${objects.length + 1}`;
    objects.push(name);
    if (keys.length) overrides.push({ object: name, keys: [...new Set(keys)] });
  }

  const types = Array.isArray(project.filament_type) ? (project.filament_type as unknown[]) : [];
  const colours = Array.isArray(project.filament_colour) ? (project.filament_colour as unknown[]) : [];
  const profiles = Array.isArray(project.filament_settings_id) ? (project.filament_settings_id as unknown[]) : [];
  const filaments: FilamentSlot[] = types.map((type, idx) => {
    const color = String(colours[idx] ?? '').toUpperCase();
    const profile = profiles[idx];
    return {
      slot: idx + 1,
      // Painted colours live in the meshes, not in model_settings: then every slot may print.
      used: painted || used.size === 0 || used.has(idx + 1),
      type: String(type),
      color: /^#[0-9A-F]{6}$/.test(color) ? color : null,
      profile: profile !== undefined && profile !== '' ? String(profile) : null,
    };
  });

  const settings: Setting[] = [];
  for (const [key, { spec, scope }] of specs(project)) {
    const value = single(project[key]);
    if (value !== null) settings.push({ key, label: spec.label, value, scope });
  }
  const nozzle = single(project.nozzle_diameter);

  const summary: Summary = {
    printer: single(project.printer_model),
    nozzle: nozzle !== null && !isNaN(Number(nozzle)) ? Number(nozzle) : null,
    bed: single(project.curr_bed_type),
    savedBy,
    plates: Math.max(1, model ? model.getElementsByTagName('plate').length : 0),
    objects,
    filaments,
    settings,
    overrides,
  };
  return { zip, project, summary };
}

/**
 * Checks each proposed change against the file's own settings: unknown or untunable
 * keys, values out of range and no-op changes are dropped with the reason.
 */
export function validate(summary: Summary, proposed: Proposed[]): { changes: Change[]; rejected: Rejected[] } {
  const current = new Map(summary.settings.map((s) => [s.key, s]));
  const colours = summary.filaments.filter((f) => f.used).length;
  const changes = new Map<string, Change>();
  const rejected: Rejected[] = [];
  for (const p of proposed) {
    const key = typeof p.key === 'string' ? p.key.trim() : '';
    const cur = current.get(key);
    if (!cur) {
      rejected.push({ key: key === '' ? '?' : key.slice(0, 60), why: 'chave fora da lista que se pode mudar neste ficheiro' });
      continue;
    }
    if (changes.has(key)) continue;
    const spec = specFor(key);
    const value = spec ? normalise(spec, p.value) : null;
    if (value === null) {
      rejected.push({ key, why: 'valor inválido ou fora do intervalo' });
      continue;
    }
    if (key === 'layer_height' && summary.nozzle !== null && Number(value) > 0.8 * summary.nozzle) {
      rejected.push({ key, why: 'mais de 80% do diâmetro do bico' });
      continue;
    }
    if (key === 'enable_prime_tower' && value === '0' && colours > 1) {
      rejected.push({ key, why: `o projeto usa ${colours} cores: sem torre de purga as trocas misturam cores` });
      continue;
    }
    if (same(cur.value, value)) continue;
    changes.set(key, {
      key,
      label: cur.label,
      before: cur.value,
      after: value,
      reason: typeof p.reason === 'string' ? p.reason.trim().slice(0, 300) : '',
    });
  }
  return { changes: [...changes.values()], rejected };
}

/**
 * Writes the changes into the project and returns the new 3MF. Arrays keep their length
 * (every item gets the value, which load() only allows when they were all equal), and
 * each key is added to different_settings_to_system so Bambu Studio shows it as edited.
 * The changes are re-validated against the file, not trusted from the caller.
 */
export async function apply(loaded: Loaded, changes: { key: string; after: string }[]): Promise<Blob> {
  const project: Project = structuredClone(loaded.project);
  const known = specs(project);
  const diff = Array.isArray(project.different_settings_to_system) ? ([...project.different_settings_to_system] as unknown[]) : null;
  const slots = Array.isArray(project.filament_type) ? project.filament_type.length : 0;

  for (const c of changes) {
    const entry = known.get(c.key);
    const value = entry ? normalise(entry.spec, c.after) : null;
    if (!entry || value === null) throw new TuneError(`Alteração inválida: ${c.key}`);
    const old = project[c.key];
    project[c.key] = Array.isArray(old) ? old.map(() => value) : value;
    if (diff) {
      const indexes = entry.scope === 'filament' ? Array.from({ length: Math.max(1, slots) }, (_, n) => n + 1) : [0];
      for (const n of indexes) {
        if (diff[n] === undefined) continue;
        const listed = diff[n] === '' ? [] : String(diff[n]).split(';');
        if (!listed.includes(c.key)) diff[n] = [...listed, c.key].sort().join(';');
      }
    }
  }
  if (diff) project.different_settings_to_system = diff;

  const out = new JSZip();
  for (const [name, file] of Object.entries(loaded.zip.files)) {
    if (file.dir) out.folder(name);
    else if (name === SETTINGS) out.file(name, JSON.stringify(project, null, 4) + '\n');
    else out.file(name, file.async('uint8array'), { date: file.date });
  }
  return out.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'model/3mf' });
}

/** Whether any object mesh carries colour painting (Bambu: paint_color, Orca: mmu_segmentation). */
async function isPainted(zip: JSZip): Promise<boolean> {
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir || !name.startsWith('3D/') || !name.endsWith('.model')) continue;
    const text = await file.async('string');
    if (text.includes('paint_color="') || text.includes('mmu_segmentation="')) return true;
  }
  return false;
}

/** "BambuStudio-02.04.00.70" from the 3D model header. */
async function application(zip: JSZip): Promise<string | null> {
  const file = zip.file('3D/3dmodel.model');
  if (!file) return null;
  const head = (await file.async('string')).slice(0, 8192);
  return /<metadata name="Application">([^<]{1,80})<\/metadata>/.exec(head)?.[1] ?? null;
}
