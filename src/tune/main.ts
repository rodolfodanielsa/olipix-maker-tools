import { buildPrompt, parseReply, PRIORITIES, USES, type Choices } from './prompt';
import { countUse } from '../counter';
import { initTheme } from '../theme';
import { apply, load, TuneError, validate, type Change, type Loaded } from './tuner';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

let loaded: Loaded | null = null;
let fileName = 'projeto.3mf';
let changes: Change[] = [];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
}

const notice = (kind: '' | 'error' | 'ok', text: string) => el('div', { className: `notice ${kind}`.trim() }, text);

function fill(select: HTMLSelectElement, options: Record<string, string>): void {
  for (const [value, label] of Object.entries(options)) select.append(el('option', { value }, label));
}

function choices(): Choices {
  const spools: Record<number, string> = {};
  document.querySelectorAll<HTMLInputElement>('#spools input').forEach((i) => {
    spools[Number(i.dataset.slot)] = i.value;
  });
  return {
    use: $<HTMLSelectElement>('use').value,
    priority: $<HTMLSelectElement>('priority').value,
    notes: $<HTMLTextAreaElement>('notes').value,
    printingOn: $<HTMLInputElement>('printing-on').value,
    spools,
  };
}

function refreshPrompt(): void {
  if (loaded) $<HTMLTextAreaElement>('prompt').value = buildPrompt(loaded.summary, choices());
}

function show(id: string, on: boolean): void {
  $(id).hidden = !on;
}

function renderSummary(l: Loaded): void {
  const s = l.summary;
  const dl = el('dl');
  const row = (k: string, v: Node | string) => dl.append(el('dt', {}, k), el('dd', {}, v));
  row('Impressora', s.printer ?? 'desconhecida');
  if (s.nozzle !== null) row('Bico', `${s.nozzle} mm`);
  if (s.bed) row('Base', s.bed);
  row('Objetos', s.objects.length ? `${s.objects.length}: ${[...new Set(s.objects)].slice(0, 5).join(', ')}${s.objects.length > 5 ? '…' : ''}` : '—');
  const used = s.filaments.filter((f) => f.used);
  const fil = el('span');
  used.forEach((f, n) => {
    if (n) fil.append(', ');
    if (f.color) {
      const chip = el('span', { className: 'chip' });
      chip.style.background = f.color;
      fil.append(chip);
    }
    fil.append(`${f.type}${f.profile ? ` (${f.profile})` : ''}`);
  });
  row('Filamentos usados', used.length ? fil : '—');
  row('Definições ajustáveis', String(s.settings.length));
  if (s.savedBy) row('Guardado por', s.savedBy);
  const box = $('summary');
  box.replaceChildren(dl);
  box.hidden = false;
}

function renderSpools(l: Loaded): void {
  const box = $('spools');
  box.replaceChildren();
  const used = l.summary.filaments.filter((f) => f.used);
  for (const f of used) {
    const input = el('input', { maxLength: 80, placeholder: 'ex.: Bambu PLA Matte Red' });
    input.dataset.slot = String(f.slot);
    input.addEventListener('input', refreshPrompt);
    const colour = f.color ?? '';
    box.append(el('label', {}, `Bobine para a cor ${f.slot} — ${f.type} ${colour} (opcional)`, input));
  }
}

async function open(file: File): Promise<void> {
  const msg = $('file-msg');
  msg.replaceChildren();
  show('s-ctx', false);
  show('s-prompt', false);
  show('s-reply', false);
  show('s-result', false);
  $('summary').hidden = true;
  loaded = null;
  try {
    loaded = await load(await file.arrayBuffer());
  } catch (e) {
    msg.replaceChildren(notice('error', e instanceof TuneError ? e.message : 'Não foi possível ler o ficheiro.'));
    return;
  }
  fileName = file.name.replace(/\.3mf$/i, '');
  renderSummary(loaded);
  if (!loaded.summary.settings.length) {
    msg.replaceChildren(notice('error', 'Este projeto não tem definições que se possam ajustar de forma segura.'));
    return;
  }
  renderSpools(loaded);
  refreshPrompt();
  for (const id of ['s-ctx', 's-prompt', 's-reply']) show(id, true);
}

function renderResult(note: string | null, rejected: { key: string; why: string }[]): void {
  $('note').replaceChildren(...(note ? [notice('', `Nota da AI: ${note}`)] : []));
  const list = $('changes');
  list.replaceChildren();
  if (!changes.length) list.append(notice('', 'A AI não sugere alterações válidas para este projeto.'));
  changes.forEach((c, n) => {
    const box = el('input', { type: 'checkbox', checked: true, id: `c${n}` });
    box.dataset.key = c.key;
    box.addEventListener('change', updateDownload);
    list.append(
      el('div', { className: 'change' }, box,
        el('label', { htmlFor: `c${n}`, className: 'vals' }, `${c.label}: `, el('strong', {}, c.before), el('span', { className: 'arrow' }, '→'), el('strong', {}, c.after)),
        ...(c.reason ? [el('div', { className: 'why' }, c.reason)] : []),
      ),
    );
  });
  const rej = $('rejected');
  rej.replaceChildren();
  if (rejected.length) {
    rej.append(notice('error', `Ignoradas (${rejected.length}): ${rejected.map((r) => `${r.key} — ${r.why}`).join('; ')}`));
  }
  const ov = loaded?.summary.overrides ?? [];
  $('overrides').replaceChildren(
    ...(ov.length ? [notice('', `Alguns objetos têm ajustes próprios (${ov.map((o) => `${o.object}: ${o.keys.join(', ')}`).join('; ')}). Uma alteração global não lhes toca.`)] : []),
  );
  updateDownload();
  show('s-result', true);
}

function selected(): Change[] {
  const on = new Set([...document.querySelectorAll<HTMLInputElement>('#changes input:checked')].map((i) => i.dataset.key));
  return changes.filter((c) => on.has(c.key));
}

function updateDownload(): void {
  $<HTMLButtonElement>('download').disabled = selected().length === 0;
}

function check(): void {
  const msg = $('reply-msg');
  msg.replaceChildren();
  if (!loaded) return;
  try {
    const reply = parseReply($<HTMLTextAreaElement>('reply').value);
    const result = validate(loaded.summary, reply.changes);
    changes = result.changes;
    renderResult(reply.note, result.rejected);
  } catch (e) {
    show('s-result', false);
    msg.replaceChildren(notice('error', e instanceof Error ? e.message : 'Resposta inválida.'));
  }
}

async function download(): Promise<void> {
  if (!loaded) return;
  const msg = $('dl-msg');
  try {
    const blob = await apply(loaded, selected());
    const a = el('a', { href: URL.createObjectURL(blob), download: `${fileName}-ajustado.3mf` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    msg.textContent = 'Feito.';
    countUse('tune');
  } catch (e) {
    msg.textContent = e instanceof Error ? e.message : 'Falhou.';
  }
}

async function copy(): Promise<void> {
  const text = $<HTMLTextAreaElement>('prompt');
  try {
    await navigator.clipboard.writeText(text.value);
    $('copy-msg').textContent = 'Copiado.';
  } catch {
    text.select();
    $('copy-msg').textContent = 'Seleciona o texto e copia manualmente.';
  }
}

fill($<HTMLSelectElement>('use'), USES);
fill($<HTMLSelectElement>('priority'), PRIORITIES);
for (const id of ['use', 'priority', 'printing-on', 'notes']) $(id).addEventListener('input', refreshPrompt);

const drop = $('drop');
const input = $<HTMLInputElement>('file');
drop.addEventListener('click', () => input.click());
drop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    input.click();
  }
});
drop.addEventListener('dragover', (e) => {
  e.preventDefault();
  drop.classList.add('over');
});
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  const f = e.dataTransfer?.files[0];
  if (f) void open(f);
});
input.addEventListener('change', () => {
  const f = input.files?.[0];
  if (f) void open(f);
});
$('copy').addEventListener('click', () => void copy());
$('check').addEventListener('click', check);
$('download').addEventListener('click', () => void download());

initTheme(document.getElementById('theme'));

if (new URLSearchParams(location.search).get('demo') === '1') {
  fetch(new URL('../sample.3mf', location.href))
    .then((r) => r.blob())
    .then((b) => open(new File([b], 'vaso-decorativo.3mf')))
    .catch(() => $('file-msg').replaceChildren(notice('error', 'Não foi possível carregar o projeto de exemplo.')));
}
