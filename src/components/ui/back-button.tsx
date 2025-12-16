import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from './button';

interface BackButtonProps {
  to?: string;
  label?: string;
}

export const BackButton = ({ to, label = 'Voltar' }: BackButtonProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} className="gap-2">
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
};
