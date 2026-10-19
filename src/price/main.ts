import { initTheme } from '../theme';
import { calculate, type PriceInput, type PriceResult, type Rounding } from './calc';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);
const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

const SAVED = ['filamentPerKg', 'powerW', 'kwh', 'machinePerHour', 'failurePercent', 'marginPercent', 'vatPercent'] as const;
const STORE = 'price.settings';

const radio = (name: string): string => document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? '';

function num(id: string): number {
  return input(id).valueAsNumber;
}

function read(): PriceInput {
  const pro = radio('mode') === 'pro';
  const fixed = $<HTMLSelectElement>('profitMode').value === 'fixed';
  const fixedProfit = num('fixedProfit');
  return {
    grams: num('grams'),
    hours: num('hours'),
    minutes: num('minutes'),
    filamentPerKg: num('filamentPerKg'),
    powerW: num('powerW'),
    kwh: num('kwh'),
    machinePerHour: pro ? num('machinePerHour') : 0,
    setup: pro ? num('setup') : 0,
    failurePercent: pro ? num('failurePercent') : 0,
    marginPercent: num('marginPercent'),
    fixedProfit: fixed ? (Number.isFinite(fixedProfit) ? fixedProfit : 0) : null,
    vatPercent: pro ? num('vatPercent') : 0,
    pieces: pro ? num('pieces') : 1,
    rounding: (pro ? $<HTMLSelectElement>('rounding').value : 'none') as Rounding,
  };
}

function line(label: string, value: string, strong = false): [HTMLElement, HTMLElement] {
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = label;
  dd.textContent = value;
  if (strong) dt.className = dd.className = 'strong';
  return [dt, dd];
}

function breakdown(r: PriceResult): [string, string, boolean][] {
  const rows: [string, string, boolean][] = [['Material', eur.format(r.costs.material), false], ['Energia', eur.format(r.costs.energy), false]];
  if (r.costs.machine > 0) rows.push(['Máquina', eur.format(r.costs.machine), false]);
  if (r.costs.failures > 0) rows.push(['Falhas', eur.format(r.costs.failures), false]);
  if (r.costs.setup > 0) rows.push(['Preparação', eur.format(r.costs.setup), false]);
  rows.push(['Custo total', eur.format(r.costs.total), true], ['Lucro', eur.format(r.profit), false]);
  if (r.vatPercent > 0) rows.push([`IVA ${r.vatPercent.toLocaleString('pt-PT')}%`, eur.format(r.vat * r.pieces), false]);
  if (r.rounding !== 0) rows.push(['Arredondamento', eur.format(r.rounding * r.pieces), false]);
  return rows;
}

function shareText(r: PriceResult, name: string, audience: string): string {
  const title = name.trim() || 'Peça impressa em 3D';
  const vat = r.vatPercent > 0 ? ' (IVA incluído)' : '';
  if (audience === 'client') {
    const out = [title, r.pieces > 1 ? `${eur.format(r.withVat)} por peça${vat}` : `${eur.format(r.withVat)}${vat}`];
    if (r.pieces > 1) out.push(`${r.pieces} peças: ${eur.format(r.totalWithVat)}${vat}`);
    return out.join('\n');
  }
  const out = [r.pieces > 1 ? `${title} (${r.pieces} peças na mesa)` : title, ...breakdown(r).map(([k, v]) => `${k}: ${v}`)];
  out.push(`Margem obtida: ${r.marginPercent.toLocaleString('pt-PT')}% sobre o custo`);
  out.push(r.pieces > 1 ? `Preço por peça: ${eur.format(r.withVat)}` : `Preço: ${eur.format(r.withVat)}`);
  if (r.pieces > 1) out.push(`Total: ${eur.format(r.totalWithVat)}`);
  return out.join('\n');
}

function render(): void {
  const r = calculate(read());
  const lines = $('lines');
  lines.replaceChildren();
  $('share').hidden = r === null;
  $('per-piece').hidden = r === null || r.pieces === 1;
  if (r === null) {
    $('price').textContent = '—';
    $('price-sub').textContent = 'Preenche o peso ou o tempo e o preço aparece aqui.';
    return;
  }
  $('price').textContent = eur.format(r.withVat);
  const vat = r.vatPercent > 0 ? 'IVA incluído' : 'sem IVA';
  $('price-sub').textContent = r.pieces > 1 ? `${r.pieces} peças: ${eur.format(r.totalWithVat)} · ${vat}` : vat;
  for (const [k, v, strong] of breakdown(r)) lines.append(...line(k, v, strong));
  $<HTMLTextAreaElement>('share-text').value = shareText(r, input('name').value, radio('audience'));
}

function applyMode(): void {
  const pro = radio('mode') === 'pro';
  document.querySelectorAll<HTMLElement>('[data-pro]').forEach((e) => (e.hidden = !pro));
  const fixed = $<HTMLSelectElement>('profitMode').value === 'fixed';
  $('marginBox').hidden = fixed;
  $('fixedBox').hidden = !fixed;
}

function save(): void {
  try {
    const data: Record<string, string> = { mode: radio('mode'), rounding: $<HTMLSelectElement>('rounding').value };
    for (const id of SAVED) data[id] = input(id).value;
    localStorage.setItem(STORE, JSON.stringify(data));
  } catch {
    // storage unavailable: the rates just last for this visit
  }
}

function restore(): void {
  try {
    const data = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, string>;
    for (const id of SAVED) if (typeof data[id] === 'string') input(id).value = data[id];
    if (data.rounding) $<HTMLSelectElement>('rounding').value = data.rounding;
    const mode = document.querySelector<HTMLInputElement>(`input[name="mode"][value="${data.mode}"]`);
    if (mode) mode.checked = true;
  } catch {
    // nothing saved, or storage unavailable: keep the defaults
  }
}

function reset(): void {
  for (const id of ['name', 'grams', 'hours', 'minutes', 'fixedProfit']) input(id).value = '';
  input('pieces').value = '1';
  render();
  input('grams').focus();
}

async function copy(): Promise<void> {
  const text = $<HTMLTextAreaElement>('share-text');
  const msg = $('copy-msg');
  try {
    await navigator.clipboard.writeText(text.value);
    msg.textContent = 'Copiado.';
  } catch {
    text.select();
    msg.textContent = 'Seleciona o texto e copia à mão.';
  }
}

restore();
if (new URLSearchParams(location.search).has('demo')) {
  input('name').value = 'Vaso pequeno';
  input('grams').value = '38';
  input('hours').value = '2';
  input('minutes').value = '15';
}
applyMode();
render();

$('form').addEventListener('input', () => {
  applyMode();
  save();
  render();
});
document.querySelectorAll('input[name="mode"], input[name="audience"]').forEach((r) =>
  r.addEventListener('change', () => {
    applyMode();
    save();
    render();
  }),
);
$('copy').addEventListener('click', () => void copy());
$('reset').addEventListener('click', reset);
initTheme($('theme'));
