import { js as en } from '../i18n/en.json';
import { js as pt } from '../i18n/pt.json';

export type Lang = 'pt' | 'en';

const dictionaries: Record<Lang, Record<string, string>> = { pt, en };

let current: Lang = typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'pt';

export const currentLang = (): Lang => current;

/** Pages set their language through <html lang>; this is for tests. */
export function setLang(lang: Lang): void {
  current = lang;
}

export const locale = (): string => (current === 'en' ? 'en-IE' : 'pt-PT');

export function t(key: string, vars: Record<string, string | number> = {}): string {
  const text = dictionaries[current][key];
  if (text === undefined) throw new Error(`Missing "${key}" in ${current}`);
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
