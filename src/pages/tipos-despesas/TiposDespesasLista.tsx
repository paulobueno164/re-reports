import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { tiposDespesasService, TipoDespesa } from '@/services/tipos-despesas.service';

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

const TiposDespesasLista = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrupo, setFilterGrupo] = useState('all');
  const [filterClassificacao, setFilterClassificacao] = useState('all');

  useEffect(() => {
    fetchExpenseTypes();
  }, []);

  const fetchExpenseTypes = async () => {
    setLoading(true);
    try {
      const data = await tiposDespesasService.getAll();
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
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const filteredTypes = expenseTypes.filter((type) => {
    const matchesSearch =
      type.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.grupo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrupo = filterGrupo === 'all' || type.grupo === filterGrupo;
    const matchesClassificacao =
      filterClassificacao === 'all' ||
      type.classificacao === filterClassificacao;
    return matchesSearch && matchesGrupo && matchesClassificacao;
  });

  const originLabels: Record<string, string> = {
    proprio: 'Próprio',
    conjuge: 'Cônjuge',
    filhos: 'Filhos',
  };

  const handleDelete = async (type: ExpenseType) => {
    if (!confirm(`Deseja realmente excluir o tipo de despesa "${type.nome}"?`)) return;

    try {
      await tiposDespesasService.delete(type.id);
      toast({ title: 'Tipo excluído', description: `"${type.nome}" foi removido.` });
      fetchExpenseTypes();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const columns = [
    { key: 'nome', header: 'Tipo de Despesa' },
    { key: 'grupo', header: 'Grupo', hideOnMobile: true },
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
      key: 'classificacao',
      header: 'Tipo',
      hideOnMobile: true,
      render: (item: ExpenseType) => (
        <Badge variant="outline" className={item.classificacao === 'variavel' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
          {item.classificacao === 'variavel' ? 'Variável' : 'Fixa'}
        </Badge>
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
          <div className="hidden sm:flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/tipos-despesas/${item.id}/editar`)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(item)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/tipos-despesas/${item.id}/editar`)}>
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
        <Button onClick={() => navigate('/tipos-despesas/novo')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Tipo
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-row gap-4 items-end flex-wrap">
        <div className="space-y-1.5 flex-1 min-w-[200px] max-w-md">
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Grupo</Label>
          <Select value={filterGrupo} onValueChange={setFilterGrupo}>
            <SelectTrigger className="w-[150px]">
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
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tipo de despesa</Label>
          <Select value={filterClassificacao} onValueChange={setFilterClassificacao}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="fixo">Fixa</SelectItem>
              <SelectItem value="variavel">Variável</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <DataTable data={filteredTypes} columns={columns} emptyMessage="Nenhum tipo de despesa encontrado" />
    </div>
  );
};

export default TiposDespesasLista;
