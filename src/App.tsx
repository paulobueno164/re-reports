import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import DashboardRH from "./pages/DashboardRH";
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import { ColaboradoresLista, ColaboradorForm, ColaboradorDetalhe } from "./pages/colaboradores";
import TiposDespesas from "./pages/TiposDespesas";
import Calendario from "./pages/Calendario";
import EventosFolha from "./pages/EventosFolha";
import Lancamentos from "./pages/Lancamentos";
import Validacao from "./pages/Validacao";
import Fechamento from "./pages/Fechamento";
import Relatorios from "./pages/Relatorios";
import HistoricoAuditoria from "./pages/HistoricoAuditoria";
import Instalar from "./pages/Instalar";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import GerenciarUsuarios from "./pages/GerenciarUsuarios";
import Perfil from "./pages/Perfil";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/instalar" element={<Instalar />} />
            <Route path="/auth" element={<Auth />} />
            <Route element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard-rh" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <DashboardRH />
                </ProtectedRoute>
              } />
              <Route path="/dashboard-financeiro" element={
                <ProtectedRoute requiredRoles={['FINANCEIRO']}>
                  <DashboardFinanceiro />
                </ProtectedRoute>
              } />
              {/* Colaboradores */}
              <Route path="/colaboradores" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <ColaboradoresLista />
                </ProtectedRoute>
              } />
              <Route path="/colaboradores/novo" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <ColaboradorForm />
                </ProtectedRoute>
              } />
              <Route path="/colaboradores/:id" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <ColaboradorDetalhe />
                </ProtectedRoute>
              } />
              <Route path="/colaboradores/:id/editar" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <ColaboradorForm />
                </ProtectedRoute>
              } />
              <Route path="/tipos-despesas" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <TiposDespesas />
                </ProtectedRoute>
              } />
              <Route path="/calendario" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <Calendario />
                </ProtectedRoute>
              } />
              <Route path="/eventos-folha" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <EventosFolha />
                </ProtectedRoute>
              } />
              <Route path="/lancamentos" element={<Lancamentos />} />
              <Route path="/validacao" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <Validacao />
                </ProtectedRoute>
              } />
              <Route path="/fechamento" element={
                <ProtectedRoute requiredRoles={['RH', 'FINANCEIRO']}>
                  <Fechamento />
                </ProtectedRoute>
              } />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/auditoria" element={
                <ProtectedRoute requiredRoles={['RH', 'FINANCEIRO']}>
                  <HistoricoAuditoria />
                </ProtectedRoute>
              } />
              <Route path="/gerenciar-usuarios" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <GerenciarUsuarios />
                </ProtectedRoute>
              } />
              <Route path="/perfil" element={<Perfil />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
