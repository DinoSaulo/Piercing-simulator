-- =============================================================================
-- 0002 — controle de tentativas de login do painel
--
-- Necessário para a rota /secret/adm. Em banco novo, schema.sql já cria tudo
-- isto — este arquivo é só para projetos que rodaram uma versão anterior.
--
-- Não apaga nada.
--
-- O contador precisa ficar no banco, e não em memória: cada requisição da Edge
-- Function pode cair num isolate diferente, que não compartilha estado com os
-- outros. Sem isso o bloqueio seria sorteado.
-- =============================================================================

create table if not exists public.admin_login_attempts (
  client_ip    text primary key,
  failures     integer not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.admin_login_attempts enable row level security;

comment on table public.admin_login_attempts is
  'Tentativas de login falhas por IP. Escrita apenas pela Edge Function (service_role).';

-- -----------------------------------------------------------------------------
-- Incremento atômico
-- -----------------------------------------------------------------------------
-- Ler o contador, somar 1 e gravar de volta em três passos deixa uma janela em
-- que várias tentativas simultâneas leem o mesmo valor — exatamente o que um
-- ataque paralelo explora. Aqui o insert/update acontece numa instrução só.
--
-- Retorna o instante em que o bloqueio expira, ou NULL se ainda não bloqueou.
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

-- -----------------------------------------------------------------------------
-- Destravar um IP na mão
-- -----------------------------------------------------------------------------
-- Atrás do rewrite da Vercel, se o IP original não chegar no x-forwarded-for
-- todo mundo compartilha o mesmo balde e um ataque tranca também o admin. Para
-- liberar:
--
--   delete from public.admin_login_attempts;
