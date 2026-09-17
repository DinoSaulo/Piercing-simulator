import { useMemo } from 'react'

function randomHex(length) {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

// Stacktrace deliberadamente caotico — metade Node, metade Java, nenhuma das
// duas com muito nexo. E cenografia, nao diagnostico.
function buildStacktrace({ traceId, timestamp }) {
  return `${timestamp} ERROR 1 --- [nio-8443-exec-7] c.p.s.PiercingRenderOrchestrator
  : Unhandled exception while dispatching render job traceId=${traceId}

java.lang.IllegalStateException: Render pipeline returned a detached mesh handle
\tat com.piercing.sim.render.MeshBinder.bindOrThrow(MeshBinder.java:214)
\tat com.piercing.sim.render.PiercingRenderOrchestrator.submit(PiercingRenderOrchestrator.java:88)
\tat com.piercing.sim.api.SimulationController.create(SimulationController.java:143)
\tat jdk.internal.reflect.DirectMethodHandleAccessor.invoke(DirectMethodHandleAccessor.java:103)
\tat org.springframework.web.method.support.InvocableHandlerMethod.doInvoke(InvocableHandlerMethod.java:255)
\tat org.apache.catalina.core.ApplicationFilterChain.doFilter(ApplicationFilterChain.java:166)
\tat java.base/java.lang.Thread.run(Thread.java:1583)
Caused by: java.util.concurrent.TimeoutException: gpu-worker-03 did not ACK within 2500ms
\tat com.piercing.sim.gpu.WorkerPool.awaitAck(WorkerPool.java:401)
\t... 24 common frames omitted

node:internal/process/promises:289
            triggerUncaughtException(err, true /* fromPromise */);
            ^
TypeError [ERR_INVALID_ARG_TYPE]: The "chunk" argument must be of type string
    or an instance of Buffer. Received undefined
    at write_ (node:_http_outgoing:939:11)
    at ServerResponse.end (node:_http_outgoing:1055:5)
    at /srv/app/dist/render/streamPiercingOverlay.js:71:19
    at process.processTicksAndRejections (node:internal/process/task_queues.js:95:5) {
  code: 'ERR_INVALID_ARG_TYPE'
}

Segmentation fault (core dumped) -- render-worker exited with signal SIGSEGV (11)`
}

/**
 * Tela de erro 500 ficticia que encerra o fluxo.
 *
 * Isto e cenario de brincadeira, nao um erro real: o envio anterior foi
 * concluido normalmente e a pessoa ja tinha aceitado o armazenamento no
 * formulario, entao o "erro" nao esconde nada do que aconteceu com os dados.
 */
export function FakeErrorScreen() {
  const { traceId, timestamp } = useMemo(
    () => ({ traceId: randomHex(16), timestamp: new Date().toISOString().replace('T', ' ').slice(0, 23) }),
    []
  )

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink-950">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-12">
        <p className="font-mono text-sm text-accent-500">HTTP 500</p>

        <h2 className="mt-2 text-3xl font-bold text-steel-200 sm:text-4xl">
          Internal Server Error
        </h2>

        <p className="mt-3 text-steel-400">
          A simulação não pôde ser renderizada. O serviço de processamento encerrou de forma
          inesperada.
        </p>

        <dl className="mt-5 grid gap-x-6 gap-y-1 font-mono text-xs text-steel-400/80 sm:grid-cols-[auto_1fr]">
          <dt className="text-steel-400/60">trace-id</dt>
          <dd>{traceId}</dd>
          <dt className="text-steel-400/60">timestamp</dt>
          <dd>{timestamp}</dd>
          <dt className="text-steel-400/60">upstream</dt>
          <dd>render-worker-03.piercing-sim.svc.cluster.local:8443</dd>
        </dl>

        <pre className="mt-6 max-h-96 overflow-auto rounded-xl border border-ink-800 bg-black/60 p-4 font-mono text-[11px] leading-relaxed text-steel-400 sm:text-xs">
          {buildStacktrace({ traceId, timestamp })}
        </pre>

        <div className="mt-8">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-lg bg-accent-500 px-6 py-3.5 font-semibold text-ink-950 transition-colors hover:bg-accent-400 focus-visible:ring-2 focus-visible:ring-accent-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 focus-visible:outline-none sm:w-auto"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  )
}
