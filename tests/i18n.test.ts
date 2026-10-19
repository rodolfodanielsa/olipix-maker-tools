import enIndex from '../en/index.html?raw';
import enPrice from '../en/price/index.html?raw';
import enTune from '../en/tune/index.html?raw';
import ptIndex from '../index.html?raw';
import ptPrice from '../price/index.html?raw';
import ptTune from '../tune/index.html?raw';
import { afterEach, describe, expect, it } from 'vitest';
import { LANGS, outputPath, PAGES, render } from '../scripts/pages.mjs';
import en from '../i18n/en.json';
import pt from '../i18n/pt.json';
import { setLang } from '../src/i18n';
import { buildPrompt, parseReply, ReplyError, type Choices } from '../src/tune/prompt';
import { labelOf, LABELS_EN } from '../src/tune/labels';
import { BED_KEYS, FILAMENT, PROCESS, specFor } from '../src/tune/spec';
import { validate, type Summary } from '../src/tune/tuner';

const committed: Record<string, string> = {
  'index.html': ptIndex,
  'tune/index.html': ptTune,
  'price/index.html': ptPrice,
  'en/index.html': enIndex,
  'en/tune/index.html': enTune,
  'en/price/index.html': enPrice,
};
const dicts = { pt, en } as const;

afterEach(() => setLang('pt'));

describe('dictionaries', () => {
  for (const section of ['html', 'js'] as const) {
    it(`${section}: PT and EN have the same keys`, () => {
      expect(Object.keys(en[section]).sort()).toEqual(Object.keys(pt[section]).sort());
    });
    it(`${section}: no empty strings`, () => {
      for (const lang of LANGS) for (const [k, v] of Object.entries(dicts[lang as 'pt' | 'en'][section])) expect(v, `${lang} ${k}`).not.toBe('');
    });
  }

  it('every {name} placeholder in a PT string is also in the EN one', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [k, v] of Object.entries(pt.js)) expect(names((en.js as Record<string, string>)[k]!), k).toEqual(names(v));
  });
});

describe('pages', () => {
  for (const lang of LANGS) {
    for (const page of PAGES) {
      it(`${outputPath(lang, page)} is up to date and fully rendered`, () => {
        const html = render(lang, page);
        expect(html).not.toContain('{{');
        expect(html).toContain(`<html lang="${lang}"`);
        expect(committed[outputPath(lang, page)], 'run `npm run pages`').toBe(html);
      });
    }
  }

  it('each language links to the same page in the other one', () => {
    expect(render('pt', PAGES[1]!)).toContain('href="../en/tune/" hreflang="en"');
    expect(render('en', PAGES[1]!)).toContain('href="../../tune/" hreflang="pt"');
    expect(render('en', PAGES[0]!)).toContain('href="../" hreflang="pt"');
  });

  it('English pages point at the shared assets one level up', () => {
    expect(render('en', PAGES[2]!)).toContain('src="../../src/price/main.ts"');
    expect(render('en', PAGES[0]!)).toContain('src="../logo.svg"');
  });
});

describe('tune labels', () => {
  it('every setting has an English label', () => {
    for (const key of [...Object.keys(PROCESS), ...Object.keys(FILAMENT)]) expect(LABELS_EN[key], key).toBeTruthy();
  });

  it('bed temperatures share one English label', () => {
    setLang('en');
    for (const bed of Object.values(BED_KEYS)) {
      for (const key of [bed, `${bed}_initial_layer`]) expect(labelOf(key, specFor(key)!)).toBe('Bed temperature (°C)');
    }
  });
});

describe('English prompt and messages', () => {
  const summary: Summary = {
    printer: 'Bambu Lab X1 Carbon', nozzle: 0.4, bed: 'Textured PEI Plate', savedBy: null, plates: 1,
    objects: ['Vase'], overrides: [], filaments: [{ slot: 1, type: 'PLA', color: null, profile: null, used: true }],
    settings: [{ key: 'layer_height', label: labelOf('layer_height', PROCESS.layer_height!), value: '0.2', scope: 'process' }],
  } as Summary;
  const choices: Choices = { use: 'decorative', priority: 'balanced', notes: '', printingOn: '', spools: {} };

  it('asks for English reasons and labels the project data in English', () => {
    setLang('en');
    const prompt = buildPrompt(summary, choices);
    expect(prompt).toContain('reason in English');
    expect(prompt).toContain('Project data (JSON):');
    expect(prompt).toContain('"use": "Decorative or visual"');
    expect(prompt).not.toContain('português');
  });

  it('keeps asking for Portuguese in PT', () => {
    expect(buildPrompt(summary, choices)).toContain('português de Portugal');
  });

  it('explains rejections and bad replies in English', () => {
    setLang('en');
    expect(validate(summary, [{ key: 'layer_height', value: '0.4' }]).rejected[0]?.why).toMatch(/80% of the nozzle/);
    expect(() => parseReply('not json')).toThrow(ReplyError);
    expect(() => parseReply('not json')).toThrow(/wasn't JSON/);
  });
});
