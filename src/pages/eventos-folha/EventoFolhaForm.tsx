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
import { supabase } from '@/integrations/supabase/client';

interface ExpenseType {
  id: string;
  nome: string;
}

const EventoFolhaForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unlinkedTypes, setUnlinkedTypes] = useState<ExpenseType[]>([]);
  const [currentTypeName, setCurrentTypeName] = useState('');
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    tipoDespesaId: '',
    codigoEvento: '',
    descricaoEvento: '',
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch all linked type IDs
    const { data: eventsData } = await supabase
      .from('tipos_despesas_eventos')
      .select('tipo_despesa_id');

    const linkedIds = eventsData?.map((e) => e.tipo_despesa_id) || [];

    // Fetch unlinked types
    const { data: typesData } = await supabase
      .from('tipos_despesas')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome');

    if (typesData) {
      setUnlinkedTypes(typesData.filter((t) => !linkedIds.includes(t.id)));
    }

    // If editing, fetch event data
    if (id) {
      const { data, error } = await supabase
        .from('tipos_despesas_eventos')
        .select(`
          id,
          tipo_despesa_id,
          codigo_evento,
          descricao_evento,
          tipos_despesas (nome)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        navigate('/eventos-folha');
      } else if (data) {
        setFormData({
          tipoDespesaId: data.tipo_despesa_id,
          codigoEvento: data.codigo_evento,
          descricaoEvento: data.descricao_evento,
        });
        setCurrentTypeName((data as any).tipos_despesas?.nome || '');
      } else {
        toast({ title: 'Erro', description: 'Vínculo não encontrado', variant: 'destructive' });
        navigate('/eventos-folha');
      }
    }

    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.tipoDespesaId || !formData.codigoEvento || !formData.descricaoEvento) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const dbData = {
      tipo_despesa_id: formData.tipoDespesaId,
      codigo_evento: formData.codigoEvento,
      descricao_evento: formData.descricaoEvento,
    };

    try {
      if (isEditing) {
        const { error } = await supabase
          .from('tipos_despesas_eventos')
          .update(dbData)
          .eq('id', id);
        if (error) throw error;
        toast({ title: 'Vínculo atualizado', description: 'Os dados foram salvos com sucesso.' });
      } else {
        const { error } = await supabase.from('tipos_despesas_eventos').insert([dbData]);
        if (error) throw error;
        toast({ title: 'Vínculo criado', description: 'O vínculo foi cadastrado com sucesso.' });
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
      title={isEditing ? 'Editar Vínculo' : 'Novo Vínculo'}
      description="Vincule um tipo de despesa a um evento de folha de pagamento"
      backTo="/eventos-folha"
      backLabel="Voltar"
      onSave={handleSave}
      onCancel={() => navigate('/eventos-folha')}
      saving={saving}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo de Despesa</Label>
          <Select
            value={formData.tipoDespesaId}
            onValueChange={(value) => setFormData({ ...formData, tipoDespesaId: value })}
            disabled={isEditing}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de despesa" />
            </SelectTrigger>
            <SelectContent>
              {isEditing ? (
                <SelectItem value={formData.tipoDespesaId}>
                  {currentTypeName}
                </SelectItem>
              ) : (
                unlinkedTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.nome}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {!isEditing && unlinkedTypes.length === 0 && (
            <p className="text-xs text-warning">Todos os tipos de despesa já possuem vínculo.</p>
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
            placeholder="Ex: Equipamentos de uso"
          />
          <p className="text-xs text-muted-foreground">Nome do evento conforme cadastrado na folha</p>
        </div>
      </div>
    </PageFormLayout>
  );
};

export default EventoFolhaForm;
