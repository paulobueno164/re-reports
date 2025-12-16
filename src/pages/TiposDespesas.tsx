import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Loader2, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/expense-validation';

interface ExpenseType {
  id: string;
  nome: string;
  classificacao: 'fixo' | 'variavel';
  valorPadraoTeto: number;
  grupo: string;
  origemPermitida: string[];
  ativo: boolean;
}

const expenseGroups = ['Equipamentos', 'Seguros', 'Educação', 'Saúde', 'Cultura'];

const TiposDespesas = () => {
  const { toast } = useToast();
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrupo, setFilterGrupo] = useState('all');
  const [filterClassificacao, setFilterClassificacao] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ExpenseType | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
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
    fetchExpenseTypes();
  }, []);

  const fetchExpenseTypes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tipos_despesas')
      .select('*')
      .order('nome');

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else if (data) {
      setExpenseTypes(
        data.map((t) => ({
          id: t.id,
          nome: t.nome,
          classificacao: t.classificacao as 'fixo' | 'variavel',
          valorPadraoTeto: Number(t.valor_padrao_teto),
          grupo: t.grupo,
          origemPermitida: t.origem_permitida as string[],
          ativo: t.ativo,
        }))
      );
    }
    setLoading(false);
  };

  const filteredTypes = expenseTypes.filter((type) => {
    const matchesSearch =
      type.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.grupo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrupo = filterGrupo === 'all' || type.grupo === filterGrupo;
    const matchesClassificacao = filterClassificacao === 'all' || type.classificacao === filterClassificacao;
    return matchesSearch && matchesGrupo && matchesClassificacao;
  });

  const originLabels: Record<string, string> = {
    proprio: 'Próprio',
    conjuge: 'Cônjuge',
    filhos: 'Filhos',
  };

  const columns = [
    { key: 'nome', header: 'Tipo de Despesa' },
    { key: 'grupo', header: 'Grupo', hideOnMobile: true },
    {
      key: 'classificacao',
      header: 'Classe',
      render: (item: ExpenseType) => (
        <Badge variant={item.classificacao === 'fixo' ? 'secondary' : 'default'}>
          {item.classificacao === 'fixo' ? 'Fixo' : 'Var'}
        </Badge>
      ),
    },
    {
      key: 'valorPadraoTeto',
      header: 'Teto',
      className: 'text-right font-mono',
      hideOnMobile: true,
      render: (item: ExpenseType) => formatCurrency(item.valorPadraoTeto),
    },
    {
      key: 'origemPermitida',
      header: 'Origem',
      hideOnMobile: true,
      render: (item: ExpenseType) => (
        <div className="flex gap-1 flex-wrap">
          {item.origemPermitida.map((origin) => (
            <Badge key={origin} variant="outline" className="text-xs">
              {originLabels[origin] || origin}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'ativo',
      header: 'Status',
      render: (item: ExpenseType) =>
        item.ativo ? (
          <span className="status-badge status-valid">Ativo</span>
        ) : (
          <span className="status-badge status-draft">Inativo</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (item: ExpenseType) => (
        <div className="flex justify-end gap-1">
          {/* Desktop: botões individuais */}
          <div className="hidden sm:flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(item)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          {/* Mobile: dropdown menu */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(item)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(item)} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ),
    },
  ];

  const handleEdit = (type: ExpenseType) => {
    setSelectedType(type);
    setFormData({
      nome: type.nome,
      classificacao: type.classificacao,
      valorPadraoTeto: type.valorPadraoTeto,
      grupo: type.grupo,
      origemPropio: type.origemPermitida.includes('proprio'),
      origemConjuge: type.origemPermitida.includes('conjuge'),
      origemFilhos: type.origemPermitida.includes('filhos'),
      ativo: type.ativo,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (type: ExpenseType) => {
    if (!confirm(`Deseja realmente excluir o tipo de despesa "${type.nome}"?`)) return;

    const { error } = await supabase.from('tipos_despesas').delete().eq('id', type.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Tipo excluído', description: `"${type.nome}" foi removido.` });
      fetchExpenseTypes();
    }
  };

  const handleNew = () => {
    setSelectedType(null);
    setFormData({
      nome: '',
      classificacao: 'variavel',
      valorPadraoTeto: 0,
      grupo: '',
      origemPropio: true,
      origemConjuge: false,
      origemFilhos: false,
      ativo: true,
    });
    setIsDialogOpen(true);
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
      if (selectedType) {
        const { error } = await supabase.from('tipos_despesas').update(dbData).eq('id', selectedType.id);
        if (error) throw error;
        toast({ title: 'Tipo atualizado', description: 'Os dados foram salvos com sucesso.' });
      } else {
        const { error } = await supabase.from('tipos_despesas').insert([dbData]);
        if (error) throw error;
        toast({ title: 'Tipo criado', description: 'O tipo de despesa foi cadastrado.' });
      }
      setIsDialogOpen(false);
      fetchExpenseTypes();
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
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tipos de Despesas"
        description="Gerencie os tipos de despesas disponíveis para a Remuneração Estratégica"
      >
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Tipo
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterGrupo} onValueChange={setFilterGrupo}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="Grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {expenseGroups.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterClassificacao} onValueChange={setFilterClassificacao}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="fixo">Fixo</SelectItem>
              <SelectItem value="variavel">Variável</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <DataTable data={filteredTypes} columns={columns} emptyMessage="Nenhum tipo de despesa encontrado" />

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedType ? 'Editar Tipo de Despesa' : 'Novo Tipo de Despesa'}</DialogTitle>
            <DialogDescription>Configure os parâmetros do tipo de despesa</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Valor Padrão para Teto (R$)</Label>
              <Input
                type="number"
                value={formData.valorPadraoTeto}
                onChange={(e) => setFormData({ ...formData, valorPadraoTeto: parseFloat(e.target.value) || 0 })}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">Este valor será sugerido ao cadastrar novos colaboradores</p>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TiposDespesas;
