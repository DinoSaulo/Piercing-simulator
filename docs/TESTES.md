# Testes

Cinco suítes, três executores. As três primeiras rodam offline em segundos e
formam o `npm test`; as duas últimas são sob demanda.

| Suíte | Executor | Onde | Comando |
| --- | --- | --- | --- |
| Backend — unidade e integração | `deno test` | [`supabase/functions/_tests/`](../supabase/functions/_tests) | `npm run test:api` |
| Contrato entre as três fontes de verdade | `deno test` | [`_tests/contract_test.ts`](../supabase/functions/_tests/contract_test.ts) | incluído em `test:api` |
| Frontend — unidade, componente e integração | Vitest + RTL + MSW | [`frontend/tests/`](../frontend/tests) | `npm run test:web` |
| E2E em navegador | Playwright | [`e2e/`](../e2e) | `npm run test:e2e` |
| Contra o Supabase real | `deno test` | [`_tests/live_test.ts`](../supabase/functions/_tests/live_test.ts) | `npm run test:live` |

```bash
npm test          # backend + contrato + frontend
npm run lint      # oxlint
npm run test:api:check   # deno check da Edge Function
```

Nenhuma das suítes altera código de produção: todas foram escritas contra o
comportamento existente.

## Backend

A API é uma Edge Function em Deno, então os testes rodam em Deno — não em Node.
Chamam `handler(new Request(...))` direto, sem abrir porta.

Duas particularidades moldam o arranjo:

**A env é lida no import.** `config.ts` congela os valores e `supabase.ts` cria
o client no momento em que o módulo é avaliado. Por isso o ambiente vem de
`--env-file=supabase/functions/_tests/.env.test`, um arquivo versionado com
valores falsos. Sem ele os testes não rodam.

Como consequência, o cenário "secret ausente" não cabe no mesmo processo: o
`config` já foi congelado. Ele roda numa invocação separada, com
`.env.missing` — é o que `test:api:config` faz. Esse arquivo mantém
`SUPABASE_URL` e a service role key porque `createClient()` lança com string
vazia, e sem elas o próprio import quebraria antes de o teste chegar na
resposta 500.

**O dublê é a rede, não o Supabase.**
[`support/fetch_fake.ts`](../supabase/functions/_tests/support/fetch_fake.ts)
troca o `fetch` global e roteia por caminho (`/rest/v1/...`,
`/storage/v1/...`). O supabase-js real monta as queries e interpreta as
respostas; só a rede é fingida. Isso permite asserções como *"o upload foi
removido depois que o insert falhou"*, olhando as requisições gravadas.

> **Ordem de import:** `fetch_fake.ts` precisa vir antes de qualquer arquivo da
> função. O supabase-js guarda a referência do `fetch` global quando
> `createClient()` roda — trocar depois não teria efeito.

## Contrato entre as três fontes de verdade

O catálogo de estilos e as listas de gênero e parte do corpo vivem em três
lugares que precisam concordar:
[`piercingStyles.js`](../frontend/src/data/piercingStyles.js) e
[`constants.js`](../frontend/src/constants.js),
[`validation.ts`](../supabase/functions/api/validation.ts) e os CHECK de
[`schema.sql`](../supabase/schema.sql).

[`contract_test.ts`](../supabase/functions/_tests/contract_test.ts) importa os
dois primeiros de verdade e faz parse do SQL. O mapa do backend não é lido como
texto — `STYLES_BY_BODY_PART` é privado, então ele é reconstruído perguntando ao
próprio `parseSimulationForm` o que aceita. É o comportamento que vale.

É o aviso *"mexer aqui exige mexer nos três lugares"* virando falha de CI.

## Frontend

Vitest em jsdom, React Testing Library e MSW. O MSW intercepta no nível da rede,
então os testes de tela atravessam o código real de
[`api/admin.js`](../frontend/src/api/admin.js) e
[`api/createSimulation.js`](../frontend/src/api/createSimulation.js), incluindo
`credentials: 'include'` e o parsing de erro.

Dois detalhes de ambiente, documentados em
[`tests/setup.js`](../frontend/tests/setup.js):

- Os globais da família `fetch` vêm do Node, não do jsdom. Com o `FormData` do
  jsdom, o fetch do Node não reconhecia o corpo como multipart e mandava a
  requisição sem o boundary. Efeito colateral: `File` é o do Node, então os
  testes que anexam arquivo usam `fireEvent.change` em vez de
  `userEvent.upload`.
- `URL.createObjectURL` é stubado — o jsdom não implementa, e
  `ImageUploadField` depende dela.

Nos testes que envolvem a barra de progresso, os timers falsos precisam envolver
o envio, não só a espera: a barra agenda o primeiro `requestAnimationFrame` ao
montar, e um frame agendado com o rAF real não seria avançado depois.

## E2E

```bash
npx playwright install chromium   # uma vez
npm run test:e2e
```

O Playwright sobe o `vite dev` sozinho (e reaproveita um que já esteja aberto na
5173). A API é interceptada com `page.route()` — sem Docker, sem banco.

Cobre o que só aparece em navegador: o `inert` realmente tirando o formulário da
ordem de foco atrás do portão de idade, o `<input type="file">` recebendo um
arquivo do disco, a barra correndo em tempo real e o overlay da imagem travando
a rolagem da página.

## Contra o Supabase real

Cobre o que o fake não alcança: os CHECK constraints do Postgres, o `on
conflict` atômico da RPC de bloqueio e uma signed URL que realmente abre a
imagem.

```bash
npx supabase start

# aplica tabelas, RLS, bucket e a função de login (idempotente)
docker exec -i supabase_db_<project-ref> psql -U postgres -d postgres < supabase/schema.sql

npm run test:live
```

As credenciais vêm de `supabase/functions/.env`, o mesmo arquivo que a função
local já usa — nada fica no código.

Notas:

- As simulações criadas ficam no banco local. Para limpar:
  `docker exec supabase_db_<ref> psql -U postgres -d postgres -c "truncate public.simulations;"`
- O teste de bloqueio usa um IP fictício novo a cada execução, então uma
  execução nunca trava a seguinte.
- No stack local a função recebe `SUPABASE_URL=http://kong:8000`, que só
  resolve dentro da rede do Docker. O teste reescreve a origem da signed URL
  para alcançá-la a partir do host — o que significa que ele **não** acusaria
  uma origem errada em produção; prova que o objeto chegou ao bucket e que a
  assinatura é válida.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda em push na `main`
e em pull request, com dois jobs paralelos:

- **web** — `oxlint` e Vitest
- **api** — `deno check` e as duas invocações do `deno test`, contrato incluso

E2E e a suíte live ficam de fora: exigem Chromium, Docker e credenciais. São
comandos locais.
