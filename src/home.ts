import { showUses } from './counter';
import { initTheme } from './theme';

const NS = 'http://www.w3.org/2000/svg';

function ticks(svg: SVGSVGElement, length: number, vertical: boolean): void {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'sweep');
  for (let i = 0, p = 0; p <= length; i++, p += 12) {
    const major = i % 5 === 0;
    const line = document.createElementNS(NS, 'line');
    const size = major ? 14 : 7;
    line.setAttribute(vertical ? 'x1' : 'y1', '0');
    line.setAttribute(vertical ? 'x2' : 'y2', String(size));
    line.setAttribute(vertical ? 'y1' : 'x1', String(p));
    line.setAttribute(vertical ? 'y2' : 'x2', String(p));
    g.append(line);
    if (major && i > 0) {
      const text = document.createElementNS(NS, 'text');
      text.textContent = String(i * 2);
      text.setAttribute(vertical ? 'x' : 'y', vertical ? '16' : '25');
      text.setAttribute(vertical ? 'y' : 'x', String(vertical ? p + 3 : p - 6));
      g.append(text);
    }
  }
  svg.replaceChildren(g);
}

const rulerH = document.getElementById('ruler-h') as SVGSVGElement | null;
const rulerV = document.getElementById('ruler-v') as SVGSVGElement | null;
if (rulerH) ticks(rulerH, 900, false);
if (rulerV) ticks(rulerV, 900, true);

initTheme(document.getElementById('theme'));
void showUses();
