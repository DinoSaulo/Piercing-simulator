import { useEffect, useRef } from 'react'

const SECTIONS = [
  {
    title: '1. Aceitação dos Termos',
    paragraphs: [
      'Ao acessar, navegar ou utilizar este site e quaisquer de suas funcionalidades, incluindo, sem limitação, o envio de imagens para fins de simulação visual, você declara ter lido, compreendido e concordado integralmente com os termos e condições descritos neste documento, doravante denominado "Termos de Uso".',
      'Caso você não concorde, no todo ou em parte, com qualquer disposição destes Termos de Uso, você deverá interromper imediatamente o uso do site e de todos os seus serviços, funcionalidades, ferramentas e conteúdos associados, não sendo cabível qualquer reclamação posterior relativa à falta de concordância.',
      'A utilização continuada do site, mesmo após eventuais alterações destes Termos de Uso, será interpretada como aceitação tácita e irrevogável das novas condições, cabendo ao usuário a responsabilidade de consultar periodicamente esta página para verificar atualizações.',
    ],
  },
  {
    title: '2. Elegibilidade e Idade Mínima',
    paragraphs: [
      'O uso deste site é restrito a pessoas maiores de 18 (dezoito) anos completos na data do acesso. Ao utilizar o site, o usuário declara, sob as penas da lei, possuir capacidade civil plena e idade igual ou superior à mínima exigida.',
      'É expressamente vedado o acesso, cadastro ou envio de qualquer conteúdo por menores de idade, ainda que com autorização de responsáveis legais, cabendo exclusivamente ao usuário a responsabilidade por eventuais declarações falsas quanto à sua idade.',
    ],
  },
  {
    title: '3. Cadastro e Responsabilidade pelo Conteúdo Enviado',
    paragraphs: [
      'O usuário é integral e exclusivamente responsável pela veracidade, licitude e titularidade de qualquer imagem, fotografia ou arquivo enviado através das funcionalidades do site, isentando o site e seus operadores de qualquer responsabilidade decorrente do envio de conteúdo de terceiros sem autorização.',
      'O usuário declara, ainda, que a imagem enviada não viola direitos de imagem, direitos autorais, direitos de personalidade ou quaisquer outros direitos de terceiros, e que possui plena autorização para o envio e processamento da imagem nos termos aqui descritos.',
      'O envio de conteúdo ilegal, ofensivo, difamatório, que viole direitos de terceiros ou que de qualquer forma infrinja a legislação vigente poderá acarretar a exclusão imediata do conteúdo e do acesso do usuário, sem prejuízo de outras medidas cabíveis.',
    ],
  },
  {
    title: '4. Armazenamento e Processamento de Dados',
    paragraphs: [
      'As imagens enviadas pelo usuário, juntamente com os metadados associados (tais como gênero, parte do corpo e estilo selecionados), são transmitidas ao servidor do site e ali armazenadas para fins de processamento, geração da simulação visual e manutenção do histórico de uso.',
      'O conteúdo armazenado poderá ser acessado pela equipe de administração do site para fins de manutenção, auditoria, moderação de conteúdo, controle de qualidade e demais finalidades operacionais associadas à prestação do serviço.',
      'O site adota medidas razoáveis de segurança da informação, mas não garante a inviolabilidade absoluta dos dados armazenados, não se responsabilizando por acessos não autorizados decorrentes de falhas alheias à sua esfera de controle direto.',
      'Não há prazo definido para a retenção das imagens enviadas, podendo o site mantê-las armazenadas por tempo indeterminado para os fins descritos nestes Termos de Uso, ressalvadas eventuais solicitações de exclusão que poderão ser avaliadas a critério do site.',
    ],
  },
  {
    title: '5. Licença sobre o Conteúdo Enviado',
    paragraphs: [
      'Ao enviar uma imagem, o usuário concede ao site uma licença não exclusiva, mundial, gratuita e por prazo indeterminado para reproduzir, armazenar, processar e exibir o conteúdo enviado, exclusivamente para os fins de funcionamento, operação e melhoria do serviço.',
      'Essa licença não implica cessão de titularidade da imagem, que permanece de propriedade do usuário, mas autoriza o site a realizar os processamentos técnicos necessários à geração da simulação visual e ao armazenamento correspondente.',
    ],
  },
  {
    title: '6. Propriedade Intelectual',
    paragraphs: [
      'Todos os elementos visuais, textuais, gráficos, códigos-fonte, layouts, marcas e demais componentes do site são de propriedade do site ou de seus licenciantes, sendo protegidos pela legislação de propriedade intelectual aplicável.',
      'É vedada a reprodução, distribuição, modificação, engenharia reversa ou exploração comercial de qualquer elemento do site sem autorização prévia e expressa, sob pena de responsabilização civil e criminal cabível.',
    ],
  },
  {
    title: '7. Conduta do Usuário',
    paragraphs: [
      'O usuário compromete-se a utilizar o site de forma ética, lícita e em conformidade com estes Termos de Uso, abstendo-se de praticar qualquer conduta que possa comprometer a segurança, integridade, disponibilidade ou reputação do site.',
      'É vedado o uso de mecanismos automatizados, scripts, robôs ou quaisquer ferramentas destinadas a burlar limitações técnicas do site, extrair dados em massa ou sobrecarregar a infraestrutura do serviço.',
    ],
  },
  {
    title: '8. Isenção de Garantias',
    paragraphs: [
      'O site é fornecido "no estado em que se encontra" e "conforme disponibilidade", sem garantias de qualquer natureza, expressas ou implícitas, incluindo, sem limitação, garantias de adequação a uma finalidade específica, precisão dos resultados gerados ou ausência de erros.',
      'Não há garantia de que o serviço funcionará de forma ininterrupta, segura ou livre de falhas, nem que eventuais defeitos serão corrigidos, sendo a utilização do site de inteira responsabilidade e risco do usuário.',
    ],
  },
  {
    title: '9. Limitação de Responsabilidade',
    paragraphs: [
      'Em nenhuma hipótese o site, seus operadores, administradores ou colaboradores serão responsáveis por danos diretos, indiretos, incidentais, especiais, punitivos ou consequenciais decorrentes do uso ou da impossibilidade de uso do site.',
      'A responsabilidade total do site perante o usuário, caso venha a ser reconhecida judicialmente, estará limitada ao menor valor permitido pela legislação aplicável, sendo certo que o serviço é disponibilizado sem qualquer cobrança direta ao usuário.',
    ],
  },
  {
    title: '10. Indenização',
    paragraphs: [
      'O usuário concorda em indenizar e isentar o site e seus operadores de quaisquer reclamações, perdas, danos, responsabilidades e despesas, incluindo honorários advocatícios, decorrentes do uso indevido do site ou da violação destes Termos de Uso.',
    ],
  },
  {
    title: '11. Privacidade',
    paragraphs: [
      'O tratamento de dados pessoais realizado pelo site observa a legislação de proteção de dados aplicável, sendo as informações coletadas utilizadas exclusivamente para os fins de operação, melhoria e segurança do serviço.',
      'Para informações adicionais sobre o tratamento de dados pessoais, o usuário deve consultar a Política de Privacidade do site, que complementa e integra estes Termos de Uso para todos os efeitos.',
    ],
  },
  {
    title: '12. Links e Serviços de Terceiros',
    paragraphs: [
      'O site pode conter referências ou links para serviços de terceiros, sobre os quais não exerce qualquer controle, não se responsabilizando por seu conteúdo, disponibilidade, práticas de privacidade ou eventuais danos decorrentes de sua utilização.',
    ],
  },
  {
    title: '13. Modificações do Serviço e Destes Termos',
    paragraphs: [
      'O site reserva-se o direito de, a qualquer tempo e sem aviso prévio, modificar, suspender ou descontinuar, total ou parcialmente, qualquer funcionalidade do serviço, bem como alterar estes Termos de Uso.',
      'As alterações entram em vigor imediatamente após sua publicação nesta página, sendo de responsabilidade do usuário a consulta periódica ao presente documento para verificar eventuais atualizações.',
    ],
  },
  {
    title: '14. Rescisão',
    paragraphs: [
      'O site poderá, a seu exclusivo critério e a qualquer momento, suspender ou encerrar o acesso do usuário ao serviço, com ou sem justa causa, incluindo, sem limitação, em caso de violação destes Termos de Uso.',
    ],
  },
  {
    title: '15. Lei Aplicável e Foro',
    paragraphs: [
      'Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil, elegendo as partes o foro da comarca do domicílio do site para dirimir quaisquer controvérsias decorrentes destes Termos, com renúncia expressa a qualquer outro, por mais privilegiado que seja.',
    ],
  },
  {
    title: '16. Disposições Gerais',
    paragraphs: [
      'Caso qualquer disposição destes Termos de Uso seja considerada nula ou inexequível, as demais disposições permanecerão em pleno vigor e efeito, devendo a disposição inválida ser substituída por outra que reflita, na maior medida possível, a intenção original das partes.',
      'A tolerância quanto ao eventual descumprimento de qualquer disposição destes Termos de Uso não será interpretada como renúncia ao direito de exigir o cumprimento integral das demais disposições.',
      'Estes Termos de Uso constituem o acordo integral entre o usuário e o site no que se refere ao seu objeto, substituindo quaisquer entendimentos anteriores, verbais ou escritos, sobre a mesma matéria.',
    ],
  },
]

export function TermsOfUseModal({ isOpen, onClose }) {
  const closeButtonRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/90 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-ink-800 bg-ink-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-800 p-4 sm:p-6">
          <h2 id="terms-modal-title" className="text-lg font-semibold text-steel-200">
            Termos de Uso
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar termos de uso"
            autoFocus
            className="rounded-lg p-1.5 text-steel-400 transition-colors hover:bg-ink-800 hover:text-steel-200 focus-visible:ring-2 focus-visible:ring-accent-500/60 focus-visible:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-4 text-sm leading-relaxed text-steel-400 sm:p-6">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="mb-2 font-semibold text-steel-200">{section.title}</h3>
              {section.paragraphs.map((paragraph, index) => (
                <p key={index} className="mb-2 last:mb-0">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="border-t border-ink-800 p-4 sm:p-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-accent-500 px-5 py-3 font-semibold text-ink-950 transition-colors hover:bg-accent-400 focus-visible:ring-2 focus-visible:ring-accent-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 focus-visible:outline-none"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
