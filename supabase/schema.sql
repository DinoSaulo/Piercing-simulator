-- =============================================================================
-- Simulador de piercings corporais +18 — schema do Supabase
-- Rode este arquivo inteiro no SQL Editor do painel do Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela de simulações
-- -----------------------------------------------------------------------------
create table if not exists public.simulations (
  id              uuid primary key default gen_random_uuid(),

  gender          text not null check (
                    gender in ('Masculino', 'Feminino', 'Outro', 'Prefiro não informar')
                  ),
  gender_other    text check (char_length(gender_other) <= 80),

  body_part       text not null check (
                    body_part in ('Glandis', 'Mamilo', 'Mamilos', 'Clítoris', 'Outro')
                  ),
  body_part_other text check (char_length(body_part_other) <= 80),

  piercing_style  text not null check (
                    piercing_style in (
                      'argola-classica',
                      'halter-reto',
                      'halter-curvo',
                      'captive-bead',
                      'circular-ferradura',
                      'espiral-duplo'
                    )
                  ),

  storage_bucket  text not null default 'simulations',
  image_path      text not null,
  image_mime      text not null,
  image_size      integer not null check (image_size > 0),

  -- O formulário exige o aceite explícito antes do envio; a coluna registra isso.
  consent_given   boolean not null default false check (consent_given),

  user_agent      text,
  created_at      timestamptz not null default now(),

  -- Se o select é "Outro", o texto livre correspondente é obrigatório.
  constraint gender_other_required
    check ((gender = 'Outro') = (gender_other is not null)),
  constraint body_part_other_required
    check ((body_part = 'Outro') = (body_part_other is not null))
);

create index if not exists simulations_created_at_idx
  on public.simulations (created_at desc);

comment on table public.simulations is
  'Simulações enviadas pelo formulário público. Gravadas somente pelo backend (service_role).';

-- -----------------------------------------------------------------------------
-- 2. RLS — nenhum acesso via anon/authenticated
-- -----------------------------------------------------------------------------
-- O backend Express usa a chave service_role, que ignora RLS. Ligar RLS sem
-- criar nenhuma policy fecha a tabela para qualquer cliente que use a anon key.
alter table public.simulations enable row level security;

-- -----------------------------------------------------------------------------
-- 3. Bucket de storage (privado)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'simulations',
  'simulations',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Sem policies em storage.objects para este bucket: só a service_role lê/escreve.
-- Para ver uma imagem, gere uma signed URL a partir do backend.
