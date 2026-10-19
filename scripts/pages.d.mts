export interface Page {
  name: string;
  dir: string;
}
export const LANGS: string[];
export const PAGES: Page[];
export function outputPath(lang: string, page: Page): string;
export function render(lang: string, page: Page, read?: (file: string) => string): string;
export function build(): void;
