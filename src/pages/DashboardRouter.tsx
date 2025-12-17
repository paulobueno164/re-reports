import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardColaborador from './DashboardColaborador';

const DashboardRouter = () => {
  const { hasRole } = useAuth();

  // Redirect FINANCEIRO to their dedicated dashboard
  if (hasRole('FINANCEIRO')) {
    return <Navigate to="/dashboard-financeiro" replace />;
  }

  // Redirect RH to their dedicated dashboard
  if (hasRole('RH')) {
    return <Navigate to="/dashboard-rh" replace />;
  }

  // COLABORADOR sees their own dashboard
  return <DashboardColaborador />;
};

export default DashboardRouter;
