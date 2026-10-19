# Olipix Maker Tools

Ferramentas gratuitas para quem imprime em 3D. Páginas estáticas: tudo corre no browser, sem conta, sem servidor, os ficheiros nunca saem do computador.

## Ferramentas

- **Ajustar 3MF** (`/tune/`) — abre um projeto do Bambu Studio (sem fatiar), gera um prompt para copiares para a AI que preferires, validas a resposta (JSON) contra uma lista fechada de definições e descarregas `<nome>-ajustado.3mf`. Só se reescreve `Metadata/project_settings.config`.

## Desenvolvimento

```bash
npm install
npm run dev        # servidor local
npm test           # vitest (jsdom)
npm run build      # tsc + vite build -> dist/
```

Deploy: o workflow `.github/workflows/pages.yml` publica `dist/` no GitHub Pages a cada push para `main`.

## Privacidade

Nada é enviado por esta página. O único texto que sai é o prompt que copias, e podes lê-lo antes. Não há analytics.
