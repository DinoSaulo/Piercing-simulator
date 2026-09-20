import { Blob, File } from 'node:buffer'
import { ReadableStream, TransformStream } from 'node:stream/web'
import { FormData, Headers, Request, Response, fetch } from 'undici'

/**
 * Globais da familia fetch vindos do Node, nao do jsdom.
 *
 * O jsdom nao implementa fetch, mas implementa FormData, Blob, Request e
 * Response. Resultado: o fetch do Node recebia um FormData de outro realm, nao
 * o reconhecia como corpo multipart e mandava a requisicao sem o boundary — o
 * envio do formulario chegava ao MSW como corpo ilegivel.
 *
 * Unificar as duas pontas no mesmo realm resolve. Precisa rodar antes de
 * qualquer import que capture esses globais, por isso vem no topo do arquivo.
 *
 * Efeito colateral a lembrar: File aqui e o do Node. Testes que colocam arquivo
 * num <input type="file"> usam fireEvent.change com a lista pronta, em vez de
 * userEvent.upload, que passaria pela validacao de tipo do jsdom.
 */
Object.defineProperties(globalThis, {
  fetch: { value: fetch, writable: true, configurable: true },
  Blob: { value: Blob, writable: true, configurable: true },
  File: { value: File, writable: true, configurable: true },
  Headers: { value: Headers, writable: true, configurable: true },
  FormData: { value: FormData, writable: true, configurable: true },
  Request: { value: Request, writable: true, configurable: true },
  Response: { value: Response, writable: true, configurable: true },
  ReadableStream: { value: ReadableStream, writable: true, configurable: true },
  TransformStream: { value: TransformStream, writable: true, configurable: true },
})

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from './msw/server.js'

// O MSW sobe uma vez para toda a suite. `error` em vez do default: uma chamada
// que nenhum handler cobre e quase sempre um teste incompleto, nao um caso
// legitimo — melhor falhar do que deixar passar em branco.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  cleanup()
  // Handlers registrados dentro de um teste valem so para ele.
  server.resetHandlers()
})

afterAll(() => server.close())

// O jsdom nao implementa a API de object URL, e ImageUploadField depende dela
// para a pre-visualizacao. Os stubs devolvem algo estavel e contavel, para os
// testes verificarem que criacao e revogacao andam em par.
let contador = 0
vi.stubGlobal('URL', Object.assign(URL, {
  createObjectURL: vi.fn(() => `blob:teste/${++contador}`),
  revokeObjectURL: vi.fn(),
}))
