# CLAUDE.md

Repo **público** (GitHub Pages) com ferramentas estáticas para makers, extraídas da Oficina do `../home-deck`. Vite + TS, sem framework, sem backend.

## Regras
- **Nada de dados pessoais, segredos, hostnames ou IPs** neste repo, nem em testes ou fixtures. Os 3MF de teste são gerados em código (`tests/tune.test.ts`).
- Só lógica pura portada do home-deck; nunca copiar dados de clientes, preços reais nem configuração.
- Tudo corre no browser. Sem `fetch` para terceiros, sem analytics.
- Português de Portugal nos textos da UI.

## Ajustar 3MF (`src/tune/`)
Porte de `home-deck/backend/src/Workshop/Service/ProjectTuner.php` e `ProjectTuneAdvisor.php` (doc: `home-deck/docs/fase10-workshop.md`, secção "Ajustar 3MF com o Claude"). Em vez de `claude -p`, o utilizador copia o prompt e cola a resposta. **Ao mudar o `ProjectTuner` no home-deck, repetir aqui** (e vice-versa): `spec.ts` = `PROCESS`/`FILAMENT`/`BED_KEYS`, `tuner.ts` = read/validate/apply, `prompt.ts` = SYSTEM + payload.

Invariantes (cada um foi um bug):
- Só projetos sem fatiar (`Metadata/plate_N.gcode` → recusado).
- Lista fechada de chaves; uma chave só é ajustável se o valor for escalar ou array de itens iguais.
- `apply` revalida contra o ficheiro e só reescreve `project_settings.config`; marca as chaves em `different_settings_to_system`.
- Com >1 cor usada, `enable_prime_tower = 0` é sempre recusado.
- A resposta da AI nunca é confiada: passa sempre por `validate`.

## Comandos
`npm test` · `npm run build` · `npm run dev`
