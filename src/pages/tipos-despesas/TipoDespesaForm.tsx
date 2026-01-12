import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PageFormLayout } from '@/components/ui/page-form-layout';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { tiposDespesasService } from '@/services/tipos-despesas.service';
import { grupoDespesaService } from '@/services/grupo-despesa.service';

const TipoDespesaForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const isEditing = !!id;
  const [expenseGroups, setExpenseGroups] = useState<{id: string, nome: string}[]>([]);

  const [formData, setFormData] = useState({
    nome: '',
    classificacao: 'variavel' as 'fixo' | 'variavel',
    valorPadraoTeto: 0,
    grupo: '',
    origemPropio: true,
    origemConjuge: false,
    origemFilhos: false,
    ativo: true,
  });

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const data = await grupoDespesaService.getAll({ ativo: true });
        setExpenseGroups(data.map(g => ({ id: g.id, nome: g.nome })));
      } catch (error) {
        console.error('Erro ao buscar grupos de despesa:', error);
      }
    };
    fetchGroups();
  }, []);

  useEffect(() => {
    if (id) fetchExpenseType();
  }, [id]);

  const fetchExpenseType = async () => {
    setLoading(true);
    try {
      const data = await tiposDespesasService.getById(id!);
      const origens = data.origem_permitida as string[];
      setFormData({
        nome: data.nome,
        classificacao: data.classificacao as 'fixo' | 'variavel',
        valorPadraoTeto: Number(data.valor_padrao_teto),
        grupo: data.grupo,
        origemPropio: origens.includes('proprio'),
        origemConjuge: origens.includes('conjuge'),
        origemFilhos: origens.includes('filhos'),
        ativo: data.ativo,
      });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      navigate('/tipos-despesas');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.grupo) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    const origemPermitida: string[] = [];
    if (formData.origemPropio) origemPermitida.push('proprio');
    if (formData.origemConjuge) origemPermitida.push('conjuge');
    if (formData.origemFilhos) origemPermitida.push('filhos');

    if (origemPermitida.length === 0) {
      toast({ title: 'Erro', description: 'Selecione pelo menos uma origem permitida.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const dbData = {
      nome: formData.nome,
      classificacao: formData.classificacao,
      valor_padrao_teto: formData.valorPadraoTeto,
      grupo: formData.grupo,
      origem_permitida: origemPermitida as ('proprio' | 'conjuge' | 'filhos')[],
      ativo: formData.ativo,
    };

    try {
      if (isEditing) {
        await tiposDespesasService.update(id!, dbData);
        toast({ title: 'Tipo atualizado', description: 'Os dados foram salvos com sucesso.' });
      } else {
        await tiposDespesasService.create(dbData);
        toast({ title: 'Tipo criado', description: 'O tipo de despesa foi cadastrado.' });
      }
      navigate('/tipos-despesas');
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
      title={isEditing ? 'Editar Tipo de Despesa' : 'Novo Tipo de Despesa'}
      description="Configure os parâmetros do tipo de despesa"
      backTo="/tipos-despesas"
      backLabel="Voltar"
      onSave={handleSave}
      onCancel={() => navigate('/tipos-despesas')}
      saving={saving}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome do Tipo de Despesa</Label>
          <Input
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            placeholder="Ex: Notebook, Previdência Privada"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Classificação</Label>
            <Select
              value={formData.classificacao}
              onValueChange={(value: 'fixo' | 'variavel') => setFormData({ ...formData, classificacao: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixo">Fixo</SelectItem>
                <SelectItem value="variavel">Variável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Grupo</Label>
            <Select value={formData.grupo} onValueChange={(value) => setFormData({ ...formData, grupo: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {expenseGroups.map((group) => (
                  <SelectItem key={group.id} value={group.nome}>
                    {group.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Origem Permitida</Label>
          <p className="text-xs text-muted-foreground">Selecione quem pode ser beneficiário desta despesa</p>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="proprio"
                checked={formData.origemPropio}
                onCheckedChange={(checked) => setFormData({ ...formData, origemPropio: !!checked })}
              />
              <Label htmlFor="proprio" className="font-normal">
                Próprio (Colaborador)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="conjuge"
                checked={formData.origemConjuge}
                onCheckedChange={(checked) => setFormData({ ...formData, origemConjuge: !!checked })}
              />
              <Label htmlFor="conjuge" className="font-normal">
                Cônjuge
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="filhos"
                checked={formData.origemFilhos}
                onCheckedChange={(checked) => setFormData({ ...formData, origemFilhos: !!checked })}
              />
              <Label htmlFor="filhos" className="font-normal">
                Filhos
              </Label>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-4">
          <Switch
            id="ativo"
            checked={formData.ativo}
            onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
          />
          <Label htmlFor="ativo" className="font-normal">
            Tipo de despesa ativo (disponível para uso)
          </Label>
        </div>
      </div>
    </PageFormLayout>
  );
};

export default TipoDespesaForm;
