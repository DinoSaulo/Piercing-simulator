# Simulador de piercings corporais +18

Aplicação de demonstração com verificação de idade, formulário de simulação e
persistência no Supabase.

> **Aviso de conteúdo:** o site é destinado a maiores de 18 anos e recebe fotos
> enviadas pela pessoa usuária. O formulário informa explicitamente, antes do
> envio, que a imagem é transmitida ao servidor e armazenada — e exige o aceite
> para habilitar o botão de envio.

## Estrutura

```
frontend/   React 19 + Vite + Tailwind CSS v4
backend/    Node.js + Express + multer + @supabase/supabase-js
supabase/   schema.sql — tabela, RLS e bucket de storage
```

## Fluxo da aplicação

1. **Portão de idade** — modal bloqueia o conteúdo. "Não" redireciona para o
   Google; "Sim" libera a página.
2. **Formulário** — gênero, parte do corpo (ambos com input de texto que entra e
   sai em fade quando "Outro" é escolhido), 6 estilos de piercing ilustrados em
   SVG inline, upload de foto (arquivo ou câmera) e aceite de armazenamento.
3. **Modal de carregamento** — barra de progresso de 4 segundos. Em paralelo, o
   payload é enviado para `POST /api/simulate`, que grava a imagem no Supabase
   Storage e os metadados na tabela `simulations`.
4. **Tela de erro** — encerrado o carregamento, a experiência termina numa tela
   de HTTP 500 fictícia com stacktrace de brincadeira e um botão
   "Tentar novamente" que recarrega a página.

O erro da etapa 4 é cenografia: não reflete o resultado real da requisição, que
normalmente conclui com sucesso. Ele não esconde nada sobre os dados, porque o
aceite da etapa 2 já informou que a imagem seria armazenada.

## Configuração

### 1. Supabase

No painel do projeto, abra o **SQL Editor** e rode o conteúdo de
[`supabase/schema.sql`](supabase/schema.sql). Ele cria:

- a tabela `public.simulations` com os CHECK constraints dos selects;
- RLS habilitado sem policies, fechando a tabela para as chaves públicas;
- o bucket privado `simulations`, limitado a 10 MB e a tipos de imagem.

### 2. Backend

```bash
cd backend
cp .env.example .env     # preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev              # http://localhost:3333
```

As chaves ficam em `Project Settings > API Keys` no painel do Supabase. A
`service_role` ignora RLS — ela vive apenas no backend e nunca no navegador.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

O dev server do Vite encaminha `/api/*` para `http://localhost:3333`, então não
há CORS nem URL absoluta no código. Para apontar para outro backend, defina
`VITE_API_PROXY_TARGET` (veja `frontend/.env.example`).

## API

### `POST /api/simulate`

`multipart/form-data`:

| campo            | obrigatório          | descrição                                         |
| ---------------- | -------------------- | ------------------------------------------------- |
| `gender`         | sim                  | um dos valores do select de gênero                |
| `genderOther`    | se `gender=Outro`    | texto livre, até 80 caracteres                    |
| `bodyPart`       | sim                  | um dos valores do select de parte do corpo        |
| `bodyPartOther`  | se `bodyPart=Outro`  | texto livre, até 80 caracteres                    |
| `style`          | sim                  | id do estilo (`argola-classica`, `halter-reto`, …) |
| `consent`        | sim                  | `"true"`                                          |
| `image`          | sim                  | arquivo de imagem, até 10 MB                      |

Resposta `200`: `{ "ok": true, "id": "<uuid>", "createdAt": "<iso>" }`.
Entradas inválidas respondem `400` com `{ "ok": false, "error": "…" }`.

### `GET /api/health`

`{ "ok": true, "uptime": <segundos> }`.

## Visualizar as imagens gravadas

O bucket é privado. Para abrir um arquivo, gere uma signed URL pelo backend:

```js
const { data } = await supabase.storage
  .from('simulations')
  .createSignedUrl(imagePath, 60)
```
