# Simulador de piercings corporais +18

Aplicação de demonstração com verificação de idade, formulário de simulação,
persistência no Supabase e painel administrativo.

> **Aviso de conteúdo:** o site é destinado a maiores de 18 anos e recebe fotos
> enviadas pela pessoa usuária. O formulário informa explicitamente, antes do
> envio, que a imagem é transmitida ao servidor, armazenada e **visível para a
> administração do site** — e exige o aceite para habilitar o botão de envio.

## Estrutura

```
frontend/            React 19 + Vite + Tailwind CSS v4 + React Router
supabase/
  schema.sql         tabelas, RLS, bucket e função de controle de login
  migrations/        alterações para bancos que já rodaram versões anteriores
  functions/api/     a API inteira, como Edge Function (Deno)
```

Não existe servidor Node: a API roda como Supabase Edge Function. Isso é
Deno, não Node — não há `express`, `multer` nem `node_modules` do lado do
servidor.

## Fluxo da aplicação

1. **Portão de idade** — modal bloqueia o conteúdo. "Não" redireciona para o
   Google; "Sim" libera a página.
2. **Formulário** — gênero, parte do corpo (ambos com input de texto que entra e
   sai em fade quando "Outro" é escolhido), estilos de piercing ilustrados em SVG
   inline e filtrados pela parte do corpo, upload de foto (arquivo ou câmera) e
   aceite de armazenamento.
3. **Modal de carregamento** — barra de progresso de 4 segundos. Em paralelo, o
   payload é enviado para `POST /api/simulate`, que grava a imagem no Supabase
   Storage e os metadados na tabela `simulations`.
4. **Tela de erro** — encerrado o carregamento, a experiência termina numa tela
   de HTTP 500 fictícia com stacktrace de brincadeira e um botão
   "Tentar novamente" que recarrega a página.

O erro da etapa 4 é cenografia: não reflete o resultado real da requisição, que
normalmente conclui com sucesso. Ele não esconde nada sobre os dados, porque o
aceite da etapa 2 já informou que a imagem seria armazenada e vista.

O portão de idade e o erro falso pertencem ao simulador, não ao site: a rota
`/secret/adm` fica fora dos dois.

## Configuração

### 1. Banco e storage

No painel do projeto, abra o **SQL Editor** e rode
[`supabase/schema.sql`](supabase/schema.sql). Ele cria:

- a tabela `public.simulations` com os CHECK constraints dos selects;
- a tabela `public.admin_login_attempts` e a função
  `register_admin_login_failure`, que seguram a força bruta no login;
- RLS habilitado sem policies, fechando as tabelas para as chaves públicas;
- o bucket privado `simulations`, limitado a 10 MB e a tipos de imagem.

**Projeto que já rodou uma versão anterior:** `create table if not exists` não
altera tabela existente, então rode também os arquivos de
[`supabase/migrations/`](supabase/migrations) em ordem. Leia o cabeçalho de cada
um antes — a migração `0001` remove linhas gravadas com os estilos antigos.

### 2. Secrets da função

```bash
cp supabase/functions/.env.example supabase/functions/.env
# preencha ADMIN_USERNAME, ADMIN_PASSWORD e ADMIN_JWT_SECRET

npx supabase link --project-ref <ref>
npx supabase secrets set --env-file supabase/functions/.env
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` **não** entram no arquivo: a
plataforma injeta as duas em toda Edge Function. E nenhum secret customizado
pode começar com `SUPABASE_` — o prefixo é reservado e o CLI recusa o cadastro.
É por isso que o bucket se chama `STORAGE_BUCKET` aqui.

Para gerar o segredo do cookie:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 3. Deploy da API

```bash
npx supabase functions deploy api
```

A função responde em `https://<ref>.supabase.co/functions/v1/api/...`. Os logs
ficam em **Edge Functions > api > Logs** no painel.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

O dev server encaminha `/api/*` para `http://127.0.0.1:54321` — a função servida
localmente por `npx supabase functions serve` (precisa de Docker). Para
desenvolver contra o projeto publicado, aponte para ele:

```
VITE_API_PROXY_TARGET=https://<ref>.supabase.co
```

## Publicação

**Frontend na Vercel.** Configure o *root directory* do projeto como `frontend`;
o resto a Vercel detecta sozinha (Vite). O
[`frontend/vercel.json`](frontend/vercel.json) faz duas coisas:

- encaminha `/api/*` para a Edge Function **pelo servidor**, não pelo browser;
- devolve `index.html` para qualquer rota que não seja um arquivo, para
  `/secret/adm` abrir direto pela URL.

O rewrite não é conveniência: ele mantém a API na mesma origem do site. Sem
isso, o cookie de sessão do painel seria de terceiros — bloqueado no Safari e em
extinção no Chrome. A Vercel não interpola variáveis de ambiente no
`vercel.json`, então o ref do projeto está escrito no arquivo; trocar de projeto
exige editar e publicar de novo.

> **Teste logo após o primeiro deploy:** faça login no painel e recarregue a
> página. Se cair de volta na tela de login, o `Set-Cookie` não sobreviveu ao
> rewrite. Nesse caso, cadastre `ALLOWED_ORIGINS=https://<seu-site>.vercel.app` e
> `ADMIN_COOKIE_SAMESITE=None`, e aponte o frontend direto para a função. Vale
> saber que essa alternativa não funciona no Safari.

## Catálogo de estilos

A lista de estilos exibida depende da parte do corpo escolhida. Sem parte
selecionada — ou com "Outro", que não tem lista própria — a tela mostra o
catálogo inteiro.

| Parte do corpo        | Estilos (`id`)                                                             |
| --------------------- | -------------------------------------------------------------------------- |
| Glande                | `prince-albert`, `prince-albert-reverso`, `apadravya`, `ampallang`, `dydoe` |
| Mamilo / Mamilos      | `mamilo-padrao`, `areola`                                                   |
| Clítoris              | `vch`, `hch`, `triangle`, `isabella`                                        |
| Ânus                  | `anal`                                                                      |
| Outro / não escolhida | todos os acima                                                              |

"Clítoris" exibe, acima dos botões, um aviso sobre o risco de perfurar a glande
clitoriana diretamente.

O mapeamento vive em três lugares que precisam andar juntos:
[`frontend/src/data/piercingStyles.js`](frontend/src/data/piercingStyles.js) (com
títulos, descrições e SVGs),
[`supabase/functions/api/validation.ts`](supabase/functions/api/validation.ts) e
os CHECK constraints em [`supabase/schema.sql`](supabase/schema.sql). Os três
recusam combinações inválidas, como `bodyPart=Ânus` com `style=apadravya`.

## Painel administrativo

Fica em `/secret/adm` e lista as simulações com miniatura, data, gênero, parte do
corpo (com o texto livre, quando houver) e estilo. Tem contador do total, botão
de atualizar e botão de sair.

O caminho ser difícil de adivinhar **não** é proteção: ele aparece em histórico,
referer e logs. Quem protege é o login.

Como a sessão é guardada:

- credenciais em secrets, comparadas com hash de tamanho fixo — `===` sairia no
  primeiro byte diferente e o tempo de resposta entregaria a senha aos poucos;
- cinco tentativas erradas por IP travam o login por 15 minutos, com o contador
  no Postgres (isolates da Edge Function não compartilham memória);
- a sessão é um JWT HS256 num cookie `HttpOnly`, fora do alcance de qualquer
  JavaScript da página;
- `ProtectedRoute` é conveniência de interface. Quem barra o acesso aos dados é a
  API: sem cookie válido, `GET /api/admin/simulations` responde 401 por mais que
  alguém remova o componente pelo devtools.

As imagens chegam como URLs assinadas de 1 hora. **Uma URL assinada vale para
quem a tiver, sem autenticação, até expirar** — por isso as respostas do painel
vão com `Cache-Control: no-store` e a imagem em tamanho real abre num overlay, e
não numa aba nova.

Se o `x-forwarded-for` não chegar até a função, todas as tentativas caem no mesmo
balde e um ataque tranca também o admin. Para destravar:

```sql
delete from public.admin_login_attempts;
```

## API

Base: `/api` (o rewrite da Vercel e o proxy do Vite cuidam do encaminhamento).

### `POST /api/simulate`

`multipart/form-data`:

| campo           | obrigatório         | descrição                                     |
| --------------- | ------------------- | --------------------------------------------- |
| `gender`        | sim                 | um dos valores do select de gênero            |
| `genderOther`   | se `gender=Outro`   | texto livre, até 80 caracteres                |
| `bodyPart`      | sim                 | um dos valores do select de parte do corpo    |
| `bodyPartOther` | se `bodyPart=Outro` | texto livre, até 80 caracteres                |
| `style`         | sim                 | id do estilo, válido para a `bodyPart` enviada |
| `consent`       | sim                 | `"true"`                                      |
| `image`         | sim                 | arquivo de imagem, até 10 MB                  |

Resposta `200`: `{ "ok": true, "id": "<uuid>", "createdAt": "<iso>" }`.
Entradas inválidas respondem `400` com `{ "ok": false, "error": "…" }`.

### `GET /api/health`

`{ "ok": true }`.

### `POST /api/admin/login`

`{ "username": "...", "password": "..." }` → `200` com o cookie de sessão, `401`
se as credenciais não baterem, `429` se o IP estiver travado.

### `POST /api/admin/logout`

Expira o cookie. O navegador não consegue apagar um cookie `HttpOnly` sozinho.

### `GET /api/admin/session`

`200` com `{ "username": "..." }` se houver sessão, `401` se não.

### `GET /api/admin/simulations`

Exige o cookie. Devolve as 100 mais recentes com URLs assinadas, e o total real
da tabela separado — o contador da tela continua certo depois da centésima.

## Testes

```bash
npm install                 # uma vez, na raiz (Deno e Playwright)
npm install --prefix frontend

npm test                    # backend + contrato + frontend, offline, ~15s
```

| Comando | O que cobre |
| --- | --- |
| `npm run test:api` | Edge Function: unidade, integração e o contrato entre as três fontes de verdade |
| `npm run test:web` | Frontend: unidade, componentes e os dois fluxos completos |
| `npm run test:e2e` | Chromium de verdade, com a API interceptada |
| `npm run test:live` | Contra o stack do Supabase rodando (exige Docker) |

O teste de contrato é o que segura a duplicação avisada em
[Catálogo de estilos](#catálogo-de-estilos): ele cruza
`piercingStyles.js`, `validation.ts` e os CHECK de `schema.sql`, e quebra o CI
se os três divergirem.

Detalhes de cada suíte, incluindo os pré-requisitos do E2E e da suíte live:
[`docs/TESTES.md`](docs/TESTES.md).

## Verificação

```bash
npm run lint
npm run build
npm run test:api:check      # deno check da Edge Function
npm test
```
