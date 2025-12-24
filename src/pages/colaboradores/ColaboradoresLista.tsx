import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye, Loader2, MoreVertical } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { colaboradoresService, Colaborador } from '@/services/colaboradores.service';
import { formatCurrency } from '@/lib/expense-validation';
import { useNameInconsistency } from '@/hooks/use-name-inconsistency';
import { NameInconsistencyAlert } from '@/components/ui/name-inconsistency-alert';

const departments = [
  'Tecnologia da Informação',
  'Financeiro',
  'Recursos Humanos',
  'Marketing',
  'Comercial',
  'Operações',
  'Jurídico',
];

const ColaboradoresLista = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { hasInconsistency } = useNameInconsistency();
  const [employees, setEmployees] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartamento, setFilterDepartamento] = useState('all');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const data = await colaboradoresService.getAll();
      setEmployees(data);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const filteredEmployees = employees.filter((emp) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      emp.nome.toLowerCase().includes(searchLower) ||
      emp.matricula.toLowerCase().includes(searchLower) ||
      emp.departamento.toLowerCase().includes(searchLower);
    const matchesDept = filterDepartamento === 'all' || emp.departamento === filterDepartamento;
    return matchesSearch && matchesDept;
  });

  const handleDelete = async (employee: Colaborador) => {
    if (!confirm(`Deseja realmente excluir o colaborador ${employee.nome}?`)) return;

    try {
      await colaboradoresService.delete(employee.id);
      toast({ title: 'Colaborador excluído', description: `${employee.nome} foi removido.` });
      fetchEmployees();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const columns = [
    { key: 'matricula', header: 'Matrícula', className: 'font-mono', hideOnMobile: true },
    { 
      key: 'nome', 
      header: 'Nome',
      render: (item: Colaborador) => {
        const inconsistency = hasInconsistency(item.id);
        return (
          <span className="inline-flex items-center gap-1">
            <span className="truncate max-w-[120px] sm:max-w-none">{item.nome}</span>
            {inconsistency && (
              <NameInconsistencyAlert 
                colaboradorNome={inconsistency.colaboradorNome} 
                profileNome={inconsistency.profileNome} 
              />
            )}
          </span>
        );
      },
    },
    { key: 'departamento', header: 'Depto', hideOnMobile: true },
    {
      key: 'tem_pida',
      header: 'PI/DA',
      hideOnMobile: true,
      render: (item: Colaborador) =>
        item.tem_pida ? (
          <span className="text-success font-medium">Sim</span>
        ) : (
          <span className="text-muted-foreground">Não</span>
        ),
    },
    {
      key: 'ativo',
      header: 'Status',
      render: (item: Colaborador) =>
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
      render: (item: Colaborador) => (
        <div className="flex justify-end gap-1">
          <div className="hidden sm:flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/colaboradores/${item.id}`)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/colaboradores/${item.id}/editar`)}>
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
                <DropdownMenuItem onClick={() => navigate(`/colaboradores/${item.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Visualizar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/colaboradores/${item.id}/editar`)}>
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
        title="Colaboradores Elegíveis"
        description="Gerencie os colaboradores que utilizam a Remuneração Estratégica"
      >
        <Button onClick={() => navigate('/colaboradores/novo')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Colaborador
        </Button>
      </PageHeader>

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
          <Label className="text-xs text-muted-foreground">Departamento</Label>
          <Select value={filterDepartamento} onValueChange={setFilterDepartamento}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable data={filteredEmployees} columns={columns} emptyMessage="Nenhum colaborador encontrado" />
    </div>
  );
};

export default ColaboradoresLista;
