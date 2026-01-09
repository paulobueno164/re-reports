import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PageFormLayout } from '@/components/ui/page-form-layout';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { eventosFolhaService, ComponenteRemuneracao } from '@/services/eventos-folha.service';

const COMPONENTES_REMUNERACAO = [
  { value: 'vale_alimentacao', label: 'Vale Alimentação' },
  { value: 'vale_refeicao', label: 'Vale Refeição' },
  { value: 'ajuda_custo', label: 'Ajuda de Custo' },
  { value: 'mobilidade', label: 'Mobilidade' },
  { value: 'cesta_beneficios', label: 'Cesta de Benefícios' },
  { value: 'pida', label: 'PI/DA' },
] as const;

const getComponenteLabel = (componente: string): string => {
  const found = COMPONENTES_REMUNERACAO.find(c => c.value === componente);
  return found?.label || componente;
};

const EventoFolhaForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableComponentes, setAvailableComponentes] = useState<typeof COMPONENTES_REMUNERACAO[number][]>([]);
  const [currentComponenteLabel, setCurrentComponenteLabel] = useState('');
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    componente: '' as ComponenteRemuneracao | '',
    codigoEvento: '',
    descricaoEvento: '',
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const eventsData = await eventosFolhaService.getAll();
      const usedComponentes = eventsData.map((e) => e.componente);

      setAvailableComponentes(
        COMPONENTES_REMUNERACAO.filter((c) => !usedComponentes.includes(c.value))
      );

      if (id) {
        const data = await eventosFolhaService.getById(id);
        setFormData({
          componente: data.componente,
          codigoEvento: data.codigo_evento,
          descricaoEvento: data.descricao_evento,
        });
        setCurrentComponenteLabel(getComponenteLabel(data.componente));
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      navigate('/eventos-folha');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.componente || !formData.codigoEvento || !formData.descricaoEvento) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await eventosFolhaService.update(id!, {
          codigo_evento: formData.codigoEvento,
          descricao_evento: formData.descricaoEvento,
        });
        toast({ title: 'Evento atualizado', description: 'Os dados foram salvos com sucesso.' });
      } else {
        await eventosFolhaService.create({
          componente: formData.componente as ComponenteRemuneracao,
          codigo_evento: formData.codigoEvento,
          descricao_evento: formData.descricaoEvento,
        });
        toast({ title: 'Evento criado', description: 'O evento foi cadastrado com sucesso.' });
      }
      navigate('/eventos-folha');
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageFormLayout
      title={isEditing ? 'Editar Evento' : 'Novo Evento'}
      description="Configure o código de evento da folha para um componente de remuneração"
      backTo="/eventos-folha"
      backLabel="Voltar"
      onSave={handleSave}
      onCancel={() => navigate('/eventos-folha')}
      saving={saving}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Componente de Remuneração</Label>
          <Select
            value={formData.componente}
            onValueChange={(value) => setFormData({ ...formData, componente: value as ComponenteRemuneracao })}
            disabled={isEditing}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o componente" />
            </SelectTrigger>
            <SelectContent>
              {isEditing ? (
                <SelectItem value={formData.componente}>
                  {currentComponenteLabel}
                </SelectItem>
              ) : (
                availableComponentes.map((comp) => (
                  <SelectItem key={comp.value} value={comp.value}>
                    {comp.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {!isEditing && availableComponentes.length === 0 && (
            <p className="text-xs text-warning">Todos os componentes já possuem evento cadastrado.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Código do Evento</Label>
          <Input
            value={formData.codigoEvento}
            onChange={(e) => setFormData({ ...formData, codigoEvento: e.target.value })}
            placeholder="Ex: 108930"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Código numérico utilizado pelo sistema de folha de pagamentos
          </p>
        </div>

        <div className="space-y-2">
          <Label>Descrição do Evento</Label>
          <Input
            value={formData.descricaoEvento}
            onChange={(e) => setFormData({ ...formData, descricaoEvento: e.target.value })}
            placeholder="Ex: Vale Alimentação"
          />
          <p className="text-xs text-muted-foreground">Nome do evento conforme cadastrado na folha</p>
        </div>
      </div>
    </PageFormLayout>
  );
};

export default EventoFolhaForm;
