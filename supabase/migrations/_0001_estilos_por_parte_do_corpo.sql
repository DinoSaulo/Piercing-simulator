-- =============================================================================
-- 0001 — estilos de piercing por parte do corpo
--
-- Só é necessário em projetos que JÁ rodaram a versão anterior de schema.sql.
-- Em banco novo, schema.sql sozinho já cria tudo no formato atual — este arquivo
-- não precisa ser executado.
--
-- O que muda:
--   - body_part: 'Glandis' vira 'Glande' e 'Ânus' passa a ser aceito;
--   - piercing_style: o catálogo genérico (argola, halter, espiral…) dá lugar a
--     estilos reais, específicos por região;
--   - novo constraint amarrando o estilo à parte do corpo.
--
-- ⚠️  APAGA DADOS: os estilos antigos não têm equivalente entre os novos, então
--     qualquer linha gravada antes desta migração é REMOVIDA no passo 3. Rode o
--     SELECT do passo 0 primeiro se quiser ver o que será perdido.
--
--     As imagens dessas linhas continuam no bucket `simulations`, órfãs. Remova
--     pelo painel (Storage > simulations) usando o `image_path` listado abaixo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. O que será removido (rode isolado antes de executar o resto)
-- -----------------------------------------------------------------------------
-- select id, body_part, piercing_style, image_path, created_at
--   from public.simulations
--  where piercing_style not in (
--          'prince-albert', 'prince-albert-reverso', 'apadravya', 'ampallang',
--          'dydoe', 'mamilo-padrao', 'areola', 'vch', 'hch', 'triangle',
--          'isabella', 'anal'
--        );

-- -----------------------------------------------------------------------------
-- 1. Solta os constraints antigos
-- -----------------------------------------------------------------------------
-- Precisa vir antes dos UPDATEs: os valores novos violam as regras antigas.
alter table public.simulations
  drop constraint if exists simulations_body_part_check,
  drop constraint if exists simulations_piercing_style_check,
  drop constraint if exists style_matches_body_part;

-- -----------------------------------------------------------------------------
-- 2. Corrige a nomenclatura da parte do corpo
-- -----------------------------------------------------------------------------
update public.simulations
   set body_part = 'Glande'
 where body_part = 'Glandis';

-- -----------------------------------------------------------------------------
-- 3. Remove linhas com estilos que deixaram de existir
-- -----------------------------------------------------------------------------
delete from public.simulations
 where piercing_style not in (
         'prince-albert', 'prince-albert-reverso', 'apadravya', 'ampallang',
         'dydoe', 'mamilo-padrao', 'areola', 'vch', 'hch', 'triangle',
         'isabella', 'anal'
       );

-- -----------------------------------------------------------------------------
-- 4. Aplica os constraints novos
-- -----------------------------------------------------------------------------
alter table public.simulations
  add constraint simulations_body_part_check check (
    body_part in ('Glande', 'Mamilo', 'Mamilos', 'Clítoris', 'Ânus', 'Outro')
  ),

  add constraint simulations_piercing_style_check check (
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

  -- Cada parte do corpo oferece um subconjunto de estilos, e é isso que a tela
  -- mostra. "Outro" não tem lista própria, então aceita qualquer estilo válido.
  add constraint style_matches_body_part check (
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
  );
