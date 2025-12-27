import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PageFormLayout } from '@/components/ui/page-form-layout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { periodosService } from '@/services/periodos.service';

const PeriodoForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    periodo: '',
    dataInicio: '',
    dataFinal: '',
    abreLancamento: '',
    fechaLancamento: '',
  });

  useEffect(() => {
    if (id) fetchPeriod();
  }, [id]);

  const fetchPeriod = async () => {
    setLoading(true);
    try {
      const data = await periodosService.getById(id!);
      setFormData({
        periodo: data.periodo,
        dataInicio: new Date(data.data_inicio).toISOString().split('T')[0],
        dataFinal: new Date(data.data_final).toISOString().split('T')[0],
        abreLancamento: new Date(data.abre_lancamento).toISOString().split('T')[0],
        fechaLancamento: new Date(data.fecha_lancamento).toISOString().split('T')[0],
      });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      navigate('/calendario');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.periodo || !formData.dataInicio || !formData.dataFinal || !formData.abreLancamento || !formData.fechaLancamento) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const dbData = {
      periodo: formData.periodo,
      data_inicio: formData.dataInicio,
      data_final: formData.dataFinal,
      abre_lancamento: formData.abreLancamento,
      fecha_lancamento: formData.fechaLancamento,
      status: 'aberto' as const,
    };

    try {
      if (isEditing) {
        await periodosService.update(id!, dbData);
        toast({ title: 'Período atualizado', description: 'Os dados foram salvos com sucesso.' });
      } else {
        await periodosService.create(dbData);
        toast({ title: 'Período criado', description: 'O período foi cadastrado.' });
      }
      navigate('/calendario');
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
      title={isEditing ? 'Editar Período' : 'Novo Período'}
      description="Configure as datas do período de remuneração"
      backTo="/calendario"
      backLabel="Voltar"
      onSave={handleSave}
      onCancel={() => navigate('/calendario')}
      saving={saving}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Período (MM/AAAA)</Label>
          <Input
            value={formData.periodo}
            onChange={(e) => setFormData({ ...formData, periodo: e.target.value })}
            placeholder="Ex: 01/2026"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data Início Acúmulo</Label>
            <Input
              type="date"
              value={formData.dataInicio}
              onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Data Final Acúmulo</Label>
            <Input
              type="date"
              value={formData.dataFinal}
              onChange={(e) => setFormData({ ...formData, dataFinal: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Abre Lançamento</Label>
            <Input
              type="date"
              value={formData.abreLancamento}
              onChange={(e) => setFormData({ ...formData, abreLancamento: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Dia em que colaboradores podem começar a lançar</p>
          </div>
          <div className="space-y-2">
            <Label>Fecha Lançamento</Label>
            <Input
              type="date"
              value={formData.fechaLancamento}
              onChange={(e) => setFormData({ ...formData, fechaLancamento: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Última data para lançamentos do período</p>
          </div>
        </div>
      </div>
    </PageFormLayout>
  );
};

export default PeriodoForm;
