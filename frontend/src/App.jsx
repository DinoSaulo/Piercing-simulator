import { Route, Routes } from 'react-router-dom'
import { AdminSessionProvider } from './admin/AdminSessionProvider.jsx'
import { ProtectedRoute } from './admin/ProtectedRoute.jsx'
import { AdminDashboard } from './pages/AdminDashboard.jsx'
import { Simulator } from './pages/Simulator.jsx'

/**
 * O portão de idade e o erro 500 cenográfico pertencem ao simulador, não ao
 * site — por isso /secret/adm fica fora deles. O admin não deveria precisar
 * responder que é maior de idade nem cair numa tela de erro falsa.
 *
 * O AdminSessionProvider envolve só o ramo administrativo: a home pública não
 * tem por que consultar a sessão do painel a cada carregamento.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Simulator />} />
      <Route
        path="/secret/adm"
        element={
          <AdminSessionProvider>
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          </AdminSessionProvider>
        }
      />
      <Route path="*" element={<Simulator />} />
    </Routes>
  )
}
