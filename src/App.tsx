import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Colaboradores from "./pages/Colaboradores";
import TiposDespesas from "./pages/TiposDespesas";
import Calendario from "./pages/Calendario";
import EventosFolha from "./pages/EventosFolha";
import Lancamentos from "./pages/Lancamentos";
import Validacao from "./pages/Validacao";
import Fechamento from "./pages/Fechamento";
import Relatorios from "./pages/Relatorios";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/colaboradores" element={<Colaboradores />} />
            <Route path="/tipos-despesas" element={<TiposDespesas />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/eventos-folha" element={<EventosFolha />} />
            <Route path="/lancamentos" element={<Lancamentos />} />
            <Route path="/validacao" element={<Validacao />} />
            <Route path="/fechamento" element={<Fechamento />} />
            <Route path="/relatorios" element={<Relatorios />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
