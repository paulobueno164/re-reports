import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import DashboardRouter from "./pages/DashboardRouter";
import DashboardRH from "./pages/DashboardRH";
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import { ColaboradoresLista, ColaboradorForm, ColaboradorDetalhe } from "./pages/colaboradores";
import { TiposDespesasLista, TipoDespesaForm } from "./pages/tipos-despesas";
import { CalendarioLista, PeriodoForm } from "./pages/calendario";
import { EventosFolhaLista, EventoFolhaForm } from "./pages/eventos-folha";
import { LancamentosLista, LancamentoForm, LancamentoDetalhe, ColaboradorLancamentos } from "./pages/lancamentos";

import Fechamento from "./pages/Fechamento";
import Relatorios from "./pages/Relatorios";
import HistoricoAuditoria from "./pages/HistoricoAuditoria";
import Instalar from "./pages/Instalar";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { UsuariosLista, UsuarioRoles, UsuarioForm } from "./pages/gerenciar-usuarios";
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
              <Route path="/" element={<DashboardRouter />} />
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
              {/* Tipos de Despesas */}
              <Route path="/tipos-despesas" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <TiposDespesasLista />
                </ProtectedRoute>
              } />
              <Route path="/tipos-despesas/novo" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <TipoDespesaForm />
                </ProtectedRoute>
              } />
              <Route path="/tipos-despesas/:id/editar" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <TipoDespesaForm />
                </ProtectedRoute>
              } />
              {/* Calendário */}
              <Route path="/calendario" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <CalendarioLista />
                </ProtectedRoute>
              } />
              <Route path="/calendario/novo" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <PeriodoForm />
                </ProtectedRoute>
              } />
              <Route path="/calendario/:id/editar" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <PeriodoForm />
                </ProtectedRoute>
              } />
              {/* Eventos Folha */}
              <Route path="/eventos-folha" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <EventosFolhaLista />
                </ProtectedRoute>
              } />
              <Route path="/eventos-folha/novo" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <EventoFolhaForm />
                </ProtectedRoute>
              } />
              <Route path="/eventos-folha/:id/editar" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <EventoFolhaForm />
                </ProtectedRoute>
              } />
              {/* Lançamentos */}
              <Route path="/lancamentos" element={<LancamentosLista />} />
              <Route path="/lancamentos/colaborador/:id" element={<ColaboradorLancamentos />} />
              <Route path="/lancamentos/novo" element={<LancamentoForm />} />
              <Route path="/lancamentos/:id" element={<LancamentoDetalhe />} />
              <Route path="/lancamentos/:id/editar" element={<LancamentoForm />} />
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
              {/* Gerenciar Usuários */}
              <Route path="/gerenciar-usuarios" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <UsuariosLista />
                </ProtectedRoute>
              } />
              <Route path="/gerenciar-usuarios/novo" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <UsuarioForm />
                </ProtectedRoute>
              } />
              <Route path="/gerenciar-usuarios/:id/roles" element={
                <ProtectedRoute requiredRoles={['RH']}>
                  <UsuarioRoles />
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
