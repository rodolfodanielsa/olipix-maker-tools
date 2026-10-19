# Olipix Maker Tools

Ferramentas gratuitas para quem imprime em 3D. Páginas estáticas: tudo corre no browser, sem conta, sem servidor, os ficheiros nunca saem do computador.

## Ferramentas

- **Ajustar 3MF** (`/tune/`) — abre um projeto do Bambu Studio (sem fatiar), gera um prompt para copiares para a AI que preferires, validas a resposta (JSON) contra uma lista fechada de definições e descarregas `<nome>-ajustado.3mf`. Só se reescreve `Metadata/project_settings.config`.

## Site

`index.html` é a landing (hero, ferramentas, porquê confiar, intro à Olipix Creative Lab); `tune/` é a ferramenta. Tokens e estilos em `src/style.css`. Fontes (Cal Sans e Hanken Grotesk, ambas OFL) e logo estão em `public/`, auto-alojadas: a página não faz pedidos a terceiros. `tune/?demo=1` abre com um projeto de exemplo (`public/sample.3mf`).

**Contador de utilizações:** desligado (`COUNTER_URL = null` em `src/counter.ts`). Ao ligar um backend, atualizar o "sem cookies nem analytics" em `index.html`, `tune/index.html` e aqui. Só mostra a partir de 10 utilizações.

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

## Licença

MIT (ver `LICENSE`). Cobre só o código: o nome e o logo Olipix não estão incluídos.
