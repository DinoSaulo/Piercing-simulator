import { useState } from 'react'
import { AgeGateModal } from './components/AgeGateModal.jsx'
import { FakeErrorScreen } from './components/FakeErrorScreen.jsx'
import { LoadingModal } from './components/LoadingModal.jsx'
import { SimulationForm } from './components/SimulationForm.jsx'
import { createSimulation } from './api/createSimulation.js'

const PHASES = {
  ageGate: 'age-gate',
  form: 'form',
  loading: 'loading',
  error: 'error',
}

export default function App() {
  const [phase, setPhase] = useState(PHASES.ageGate)

  function handleSubmit(values) {
    setPhase(PHASES.loading)

    // O envio corre em paralelo com a barra de 4s. A tela nao espera a resposta:
    // o desfecho e sempre o mesmo, e o resultado real so vai para o console.
    createSimulation(values)
      .then((result) => console.info('[simulacao] gravada', result))
      .catch((error) => console.error('[simulacao] falhou', error))
  }

  const locked = phase === PHASES.ageGate

  return (
    <>
      <div
        inert={locked}
        className={`min-h-screen px-4 py-10 transition-all duration-500 sm:py-16 ${
          locked ? 'pointer-events-none blur-md select-none' : ''
        }`}
      >
        <main className="mx-auto w-full max-w-2xl">
          <header className="mb-10 text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-accent-500 uppercase">
              Conteúdo adulto
            </p>
            <h1 className="mt-3 text-3xl leading-tight font-bold text-balance text-steel-200 sm:text-4xl">
              Simulador de piercings corporais +18
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-steel-400">
              Escolha o gênero, a região e o estilo, envie uma foto e veja como o piercing ficaria.
            </p>
          </header>

          <div className="rounded-2xl border border-ink-800 bg-ink-900/40 p-5 sm:p-8">
            <SimulationForm onSubmit={handleSubmit} />
          </div>

          <footer className="mt-8 text-center text-xs text-steel-400/50">
            Projeto de demonstração. Não é aconselhamento médico nem de body piercing.
          </footer>
        </main>
      </div>

      {phase === PHASES.ageGate && <AgeGateModal onConfirm={() => setPhase(PHASES.form)} />}
      {phase === PHASES.loading && <LoadingModal onComplete={() => setPhase(PHASES.error)} />}
      {phase === PHASES.error && <FakeErrorScreen />}
    </>
  )
}
