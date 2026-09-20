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
                    body_part in ('Glande', 'Mamilo', 'Mamilos', 'Clítoris', 'Ânus', 'Outro')
                  ),
  body_part_other text check (char_length(body_part_other) <= 80),

  piercing_style  text not null check (
                    piercing_style in (
                      -- Glande
                      'prince-albert',
                      'prince-albert-reverso',
                      'apadravya',
                      'ampallang',
                      'dydoe',
                      -- Mamilo / Mamilos
                      'mamilo-padrao',
                      'areola',
                      -- Clítoris
                      'vch',
                      'hch',
                      'triangle',
                      'isabella',
                      -- Ânus
                      'anal'
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
    check ((body_part = 'Outro') = (body_part_other is not null)),

  -- Cada parte do corpo oferece um subconjunto de estilos, e é isso que a tela
  -- mostra. "Outro" não tem lista própria, então aceita qualquer estilo válido.
  constraint style_matches_body_part check (
    case body_part
      when 'Glande' then piercing_style in (
        'prince-albert', 'prince-albert-reverso', 'apadravya', 'ampallang', 'dydoe'
      )
      when 'Mamilo'   then piercing_style in ('mamilo-padrao', 'areola')
      when 'Mamilos'  then piercing_style in ('mamilo-padrao', 'areola')
      when 'Clítoris' then piercing_style in ('vch', 'hch', 'triangle', 'isabella')
      when 'Ânus'     then piercing_style in ('anal')
      else true
    end
  )
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

-- -----------------------------------------------------------------------------
-- 4. Tentativas de login do painel /secret/adm
-- -----------------------------------------------------------------------------
-- O contador precisa ficar no banco, e não em memória: cada requisição da Edge
-- Function pode cair num isolate diferente, que não compartilha estado com os
-- outros. Sem isso o bloqueio por força bruta seria sorteado.
create table if not exists public.admin_login_attempts (
  client_ip    text primary key,
  failures     integer not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.admin_login_attempts enable row level security;

comment on table public.admin_login_attempts is
  'Tentativas de login falhas por IP. Escrita apenas pela Edge Function (service_role).';

-- Ler o contador, somar 1 e gravar de volta em três passos deixa uma janela em
-- que várias tentativas simultâneas leem o mesmo valor — exatamente o que um
-- ataque paralelo explora. Aqui o insert/update acontece numa instrução só.
create or replace function public.register_admin_login_failure(p_ip text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_failures integer;
  v_locked   timestamptz;
begin
  insert into public.admin_login_attempts as a (client_ip, failures)
       values (p_ip, 1)
  on conflict (client_ip) do update
          -- Bloqueio já vencido reinicia a contagem em vez de somar sobre o
          -- histórico antigo.
          set failures = case
                           when a.locked_until is not null and a.locked_until < now() then 1
                           else a.failures + 1
                         end,
              locked_until = case
                               when a.locked_until is not null and a.locked_until < now() then null
                               else a.locked_until
                             end,
              updated_at = now()
    returning a.failures into v_failures;

  if v_failures >= 5 then
    update public.admin_login_attempts
       set locked_until = now() + interval '15 minutes',
           failures     = 0,
           updated_at   = now()
     where client_ip = p_ip
    returning locked_until into v_locked;
  end if;

  return v_locked;
end;
$$;

revoke all on function public.register_admin_login_failure(text) from public, anon, authenticated;
