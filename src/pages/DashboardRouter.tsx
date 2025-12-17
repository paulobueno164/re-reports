import { useAuth } from '@/contexts/AuthContext';
import Dashboard from './Dashboard';
import DashboardColaborador from './DashboardColaborador';

const DashboardRouter = () => {
  const { hasRole } = useAuth();

  // COLABORADOR only sees their own dashboard
  // RH and FINANCEIRO have their own dedicated dashboards via sidebar
  // This route is the default "/" which is only for COLABORADOR now
  if (hasRole('RH') || hasRole('FINANCEIRO')) {
    // RH/FINANCEIRO shouldn't land here as they have dedicated dashboards
    // But if they do, show the generic dashboard
    return <Dashboard />;
  }

  return <DashboardColaborador />;
};

export default DashboardRouter;
