# Olipix Maker Tools

Ferramentas gratuitas para quem imprime em 3D. Páginas estáticas: tudo corre no browser, sem conta, sem servidor, os ficheiros nunca saem do computador.

## Ferramentas

- **Ajustar 3MF** (`/tune/`) — abre um projeto do Bambu Studio (sem fatiar), gera um prompt para copiares para a AI que preferires, validas a resposta (JSON) contra uma lista fechada de definições e descarregas `<nome>-ajustado.3mf`. Só se reescreve `Metadata/project_settings.config`.
- **Calculadora de preço** (`/price/`) — filamento, energia, máquina, falhas, preparação, margem (ou lucro fixo), IVA e arredondamento, com o preço ao vivo e por peça. Texto para copiar, completo ou só para o cliente. A lógica está em `src/price/calc.ts` (função pura, testada em `tests/price.test.ts`). Os custos (não a peça) ficam em `localStorage`; `price/?demo=1` abre com um exemplo.

## Site

`index.html` é a landing (hero, ferramentas, porquê confiar, intro à Olipix Creative Lab); `tune/` e `price/` são as ferramentas. Tokens e estilos em `src/style.css`. Fontes (Cal Sans e Hanken Grotesk, ambas OFL) e logo estão em `public/`, auto-alojadas: a página não faz pedidos a terceiros. `tune/?demo=1` abre com um projeto de exemplo (`public/sample.3mf`).

**Contador de utilizações:** GoatCounter (`olipix-tools.goatcounter.com`), chamado direto em `src/counter.ts`, sem o `count.js`. Conta `/use/tune` (depois do download) e `/use/price` (quando o utilizador edita um campo e há um preço calculado; o exemplo `?demo=1` só conta depois de o editares), uma vez por ferramenta por browser (marca `counted.<tool>` em `localStorage`). Mostra "N pessoas já usaram" só a partir de 10. Ver Privacidade.

## Idiomas

Português em `/`, `/tune/`, `/price/` e inglês em `/en/`, `/en/tune/`, `/en/price/`. Os seis `index.html` são **gerados**: edita `templates/*.html` e os dicionários `i18n/pt.json` e `i18n/en.json` (secção `html` para as páginas, `js` para os textos de `src/`), e corre `npm run pages` (o `dev` e o `build` já o fazem). Os testes falham se um ficheiro gerado estiver desatualizado, se faltar uma chave num idioma ou se uma definição do Ajustar 3MF não tiver nome em inglês (`src/tune/labels.ts`). A página lê o idioma de `<html lang>`.

## Desenvolvimento

```bash
npm install
npm run dev        # servidor local
npm test           # vitest (jsdom)
npm run build      # tsc + vite build -> dist/
```

Deploy: o workflow `.github/workflows/pages.yml` publica `dist/` no GitHub Pages a cada push para `main`.

## Privacidade

Sem cookies. O projeto e os custos nunca saem do browser; o único texto que sai é o prompt que copias. Há um pedido ao GoatCounter por ferramenta e por browser, só com o caminho (`/use/<tool>`).

Nas Settings do GoatCounter têm de ficar: **"Allow adding visitor counts on your website" ligado** (o site lê o total) e **tudo em "Data collection" desligado** (referrer, user agent, ecrã, país/região, idioma, sessões). A frase de privacidade (`common.privacy` e `home.proof1p` em `i18n/*.json`) diz exatamente isto: ao mudar o que se guarda, mudar a frase na mesma alteração.

## Licença

MIT (ver `LICENSE`). Cobre só o código: o nome e o logo Olipix não estão incluídos.
