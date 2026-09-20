/**
 * Catalogo de estilos de piercing agrupados por parte do corpo.
 *
 * Os `id` sao os mesmos aceitos pelo CHECK constraint de `piercing_style` na
 * tabela `simulations` e pela validacao do backend — mexer aqui exige mexer nos
 * tres lugares.
 */

const GROUPS = [
  {
    bodyParts: ['Glande'],
    notice: null,
    styles: [
      {
        id: 'prince-albert',
        label: 'Prince Albert (PA)',
        description: 'A perfuração entra pela uretra e sai na base inferior da glande.',
      },
      {
        id: 'prince-albert-reverso',
        label: 'Prince Albert Reverso',
        description: 'Entra pela uretra e sai no topo da glande.',
      },
      {
        id: 'apadravya',
        label: 'Apadravya',
        description: 'Atravessa a glande verticalmente (de cima para baixo).',
      },
      {
        id: 'ampallang',
        label: 'Ampallang',
        description: 'Atravessa a glande horizontalmente (de um lado ao outro).',
      },
      {
        id: 'dydoe',
        label: 'Dydoe',
        description: 'Perfurado diretamente na borda (coroa) da glande.',
      },
    ],
  },

  {
    bodyParts: ['Mamilo', 'Mamilos'],
    notice: null,
    styles: [
      {
        id: 'mamilo-padrao',
        label: 'Piercing de Mamilo Padrão',
        description:
          'Atravessa a própria papila mamária. Pode ser posicionado na horizontal, na vertical ou em um ângulo diagonal.',
      },
      {
        id: 'areola',
        label: 'Piercing de Aréola',
        description:
          'A perfuração é feita na pele da aréola, ao redor do mamilo, sem tocar a base central.',
      },
    ],
  },

  {
    bodyParts: ['Clítoris'],
    notice:
      'Nota técnica do especialista: Piercings feitos diretamente na glande do clítoris são extremamente raros e não recomendados por profissionais sérios devido ao alto risco de danos nervosos e perda de sensibilidade. Os piercings abaixo são aplicados no tecido adjacente que o protege e estimula.',
    styles: [
      {
        id: 'vch',
        label: 'VCH (Vertical Clitoral Hood)',
        description:
          'Perfuração vertical no capuz (prepúcio) do clítoris. É o piercing genital feminino mais comum.',
      },
      {
        id: 'hch',
        label: 'HCH (Horizontal Clitoral Hood)',
        description: 'Perfuração horizontal no capuz do clítoris.',
      },
      {
        id: 'triangle',
        label: 'Triangle (Triângulo)',
        description: 'Passa horizontalmente pela base profunda, por baixo do eixo do clítoris.',
      },
      {
        id: 'isabella',
        label: 'Isabella',
        description:
          'Passa verticalmente por trás do eixo clitoriano. É um piercing muito profundo e que depende estritamente da anatomia da cliente.',
      },
    ],
  },

  {
    bodyParts: ['Ânus'],
    notice: null,
    styles: [
      {
        id: 'anal',
        label: 'Piercing Anal',
        description:
          'Perfurado na pele ao redor das bordas do esfíncter anal ou na base do períneo (logo acima do ânus). É uma região de difícil cicatrização devido ao atrito e à presença constante de bactérias, exigindo higiene rigorosa.',
      },
    ],
  },
]

/** Todos os estilos, na ordem em que os grupos sao declarados. */
export const PIERCING_STYLES = GROUPS.flatMap((group) => group.styles)

export const STYLE_IDS = PIERCING_STYLES.map((style) => style.id)

function groupFor(bodyPart) {
  return GROUPS.find((group) => group.bodyParts.includes(bodyPart))
}

/**
 * Estilos visiveis para a parte do corpo escolhida.
 *
 * Sem parte selecionada ou com "Outro", nao ha como restringir — cai no catalogo
 * completo, que e o comportamento default da tela.
 */
export function stylesForBodyPart(bodyPart) {
  return groupFor(bodyPart)?.styles ?? PIERCING_STYLES
}

/** Aviso exibido acima dos botoes, quando a parte do corpo tem um. */
export function noticeForBodyPart(bodyPart) {
  return groupFor(bodyPart)?.notice ?? null
}

const LABEL_BY_ID = new Map(PIERCING_STYLES.map((style) => [style.id, style.label]))

/**
 * Nome legivel a partir do id gravado no banco.
 *
 * O painel administrativo le `piercing_style` cru do Postgres ("prince-albert")
 * e precisa mostrar o mesmo rotulo que o formulario mostrou. Ids desconhecidos
 * — linhas de versoes antigas do catalogo — aparecem como estao, em vez de
 * sumirem da tela.
 */
export function labelForStyle(styleId) {
  return LABEL_BY_ID.get(styleId) ?? styleId
}
