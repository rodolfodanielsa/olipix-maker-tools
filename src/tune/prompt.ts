import { allowed } from './spec';
import type { Proposed, Summary } from './tuner';

export const USES: Record<string, string> = {
  decorative: 'Decorativa ou visual',
  functional: 'Funcional (encaixes, esforço mecânico)',
  outdoor: 'Exterior (sol, humidade)',
  prototype: 'Protótipo rápido',
  miniature: 'Miniatura com muito detalhe',
};

export const PRIORITIES: Record<string, string> = {
  balanced: 'Equilibrada',
  speed: 'Velocidade',
  quality: 'Qualidade de superfície',
  strength: 'Resistência',
  material: 'Poupar material',
};

export const SYSTEM = `És um especialista em impressão 3D FDM com Bambu Studio. Recebes as definições atuais de um projeto,
a impressora, o filamento, o uso da peça e a prioridade. Sugere só as alterações que valem mesmo a pena
para esta peça, no máximo 10, cada uma com um motivo curto em português de Portugal.
Usa apenas chaves que aparecem em "settings" e respeita o "allowed" de cada uma (intervalo ou lista).
O "use" e a "priority" mandam em tudo o resto. Numa peça decorativa ou miniatura, ou com prioridade de
qualidade, não baixes a ventoinha nem subas a temperatura para ganhar resistência: isso piora pontes,
saliências e texto fino. Só sugere alterações de resistência quando o uso for funcional ou exterior, ou a
prioridade for resistência.
Com mais de uma entrada em "filaments" (várias cores), nunca desligues a torre de purga (enable_prime_tower).
Não sugiras mudar uma chave que todos os objetos sobrepõem em "per_object_overrides": não teria efeito.
Se nada precisar de mudar, devolve uma lista vazia.
Escreve sempre em "note" uma ou duas frases curtas: porque estas alterações (ou nenhuma), e uma alteração
opcional que ficou de fora, se houver, com o porquê.
Responde só com JSON, sem texto à volta: {"note":"...","changes":[{"key":"layer_height","value":"0.16","reason":"..."}]}`;

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

/** What leaves the page is exactly this JSON: slicer settings, object names, printer and spool names and the typed notes. Never the file. */
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
    use: USES[c.use] ?? USES.decorative,
    priority: PRIORITIES[c.priority] ?? PRIORITIES.balanced,
    notes: notes || null,
    plates: summary.plates,
    objects: [...new Set(summary.objects)].slice(0, 30),
    per_object_overrides: summary.overrides,
    settings,
  });
}

/** The text the user pastes into their AI: instructions first, then the project data. */
export function buildPrompt(summary: Summary, c: Choices): string {
  return `${SYSTEM}\n\nDados do projeto (JSON):\n${JSON.stringify(payload(summary, c), null, 2)}\n`;
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
  if (!json) throw new ReplyError('A resposta não veio em JSON. Pede à AI para responder só com o JSON.');
  const list = json.changes ?? json.alteracoes;
  if (!Array.isArray(list)) throw new ReplyError('A resposta não traz a lista "changes". Pede à AI para responder no formato indicado.');
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
