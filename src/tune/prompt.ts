import { t } from '../i18n';
import { allowed } from './spec';
import type { Proposed, Summary } from './tuner';

const USE_KEYS = ['decorative', 'functional', 'outdoor', 'prototype', 'miniature'];
const PRIORITY_KEYS = ['balanced', 'speed', 'quality', 'strength', 'material'];

const labels = (group: string, keys: string[]): Record<string, string> => Object.fromEntries(keys.map((k) => [k, t(`prompt.${group}.${k}`)]));

export const uses = (): Record<string, string> => labels('use', USE_KEYS);
export const priorities = (): Record<string, string> => labels('priority', PRIORITY_KEYS);

export interface Choices {
  use: string;
  priority: string;
  notes: string;
  /** Free text: the printer the user will actually print on. */
  printingOn: string;
  /** Free text per project slot: the spool the user will load. */
  spools: Record<number, string>;
}

const present = (v: unknown): boolean => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);

function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => present(v))) as Partial<T>;
}

/** What leaves the page is exactly this JSON: slicer settings, object and plate names, printer and spool names and the typed notes. Never the file. */
export function payload(summary: Summary, c: Choices): Record<string, unknown> {
  const settings = Object.fromEntries(
    summary.settings.map((s) => [s.key, { label: s.label, value: s.value, allowed: allowed(s.key) }]),
  );
  const notes = c.notes.trim().slice(0, 500);
  const printingOn = c.printingOn.trim().slice(0, 80);
  return compact({
    printer: compact({
      in_project: summary.printer,
      printing_on: printingOn || null,
      nozzle_mm: summary.nozzle,
      bed: summary.bed,
    }),
    filaments: summary.filaments
      .filter((f) => f.used)
      .map((f) =>
        compact({
          slot: f.slot,
          in_project: [f.type, f.color ?? '', f.profile ?? ''].join(' ').trim(),
          spool: c.spools[f.slot]?.trim().slice(0, 80) || null,
        }),
      ),
    use: uses()[c.use] ?? uses().decorative,
    priority: priorities()[c.priority] ?? priorities().balanced,
    notes: notes || null,
    plates: summary.layout.length
      ? summary.layout.slice(0, 20).map((p) => compact({ plate: p.plate, name: p.name, objects: p.objects.slice(0, 30) }))
      : summary.plates,
    objects: summary.layout.length ? null : [...new Set(summary.objects)].slice(0, 30),
    per_object_overrides: summary.overrides,
    settings,
  });
}

/** The text the user pastes into their AI: instructions first, then the project data. */
export function buildPrompt(summary: Summary, c: Choices): string {
  return `${t('prompt.system')}\n\n${t('prompt.data')}:\n${JSON.stringify(payload(summary, c), null, 2)}\n`;
}

export class ReplyError extends Error {}

function decode(reply: string): Record<string, unknown> | null {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    const json: unknown = JSON.parse(reply.slice(start, end + 1));
    return json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The AI's reply, tolerant of code fences and chatter around the JSON; the changes still go through validate(). */
export function parseReply(reply: string): { changes: Proposed[]; note: string | null } {
  const json = decode(reply);
  if (!json) throw new ReplyError(t('prompt.notJson'));
  const list = json.changes ?? json.alteracoes;
  if (!Array.isArray(list)) throw new ReplyError(t('prompt.noList'));
  const changes: Proposed[] = [];
  for (const item of list) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      changes.push({ key: o.key ?? o.chave, value: o.value ?? o.valor, reason: o.reason ?? o.motivo });
    }
  }
  const note = json.note ?? json.nota;
  return { changes, note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 600) : null };
}
