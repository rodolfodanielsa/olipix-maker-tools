import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://rodolfodanielsa.github.io/olipix-maker-tools/';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const LANGS = ['pt', 'en'];
export const PAGES = [
  { name: 'index', dir: '' },
  { name: 'tune', dir: 'tune/' },
  { name: 'price', dir: 'price/' },
];

const siteDir = (lang, page) => (lang === 'en' ? 'en/' : '') + page.dir;
export const outputPath = (lang, page) => `${siteDir(lang, page)}index.html`;

function relative(from, to) {
  const r = posix.relative(from || '.', to || '.');
  return r === '' ? './' : `${r}/`;
}

function vars(lang, page) {
  const depth = (lang === 'en' ? 1 : 0) + (page.dir ? 1 : 0);
  const other = lang === 'pt' ? 'en' : 'pt';
  return {
    lang,
    other,
    root: depth ? '../'.repeat(depth) : './',
    home: page.dir ? '../' : './',
    alt: relative(siteDir(lang, page), siteDir(other, page)),
    site: SITE,
    pathPt: siteDir('pt', page),
    pathEn: siteDir('en', page),
  };
}

const defaultRead = (file) => readFileSync(resolve(repo, file), 'utf8');

export function render(lang, page, read = defaultRead) {
  const dict = JSON.parse(read(`i18n/${lang}.json`)).html;
  const v = vars(lang, page);
  return read(`templates/${page.name}.html`).replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    const value = key in v ? v[key] : dict[key];
    if (value === undefined) throw new Error(`Missing "${key}" in ${lang} for ${page.name}`);
    return value;
  });
}

export function build() {
  for (const lang of LANGS) {
    for (const page of PAGES) {
      const file = resolve(repo, outputPath(lang, page));
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, render(lang, page));
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build();
