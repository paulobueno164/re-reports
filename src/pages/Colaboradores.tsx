import { useState } from 'react';
import { Plus, Search, Edit, Trash2, Eye, Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { mockEmployees, formatCurrency, departments } from '@/lib/mock-data';
import { EligibleEmployee } from '@/types';

const Colaboradores = () => {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<EligibleEmployee[]>(mockEmployees);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EligibleEmployee | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.matricula.includes(searchTerm) ||
      emp.departamento.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { key: 'matricula', header: 'Matrícula', className: 'font-mono' },
    { key: 'nome', header: 'Nome' },
    { key: 'departamento', header: 'Departamento' },
    {
      key: 'cestaBeneficiosTeto',
      header: 'Teto Cesta',
      className: 'text-right font-mono',
      render: (item: EligibleEmployee) => formatCurrency(item.cestaBeneficiosTeto),
    },
    {
      key: 'temPida',
      header: 'PI/DA',
      render: (item: EligibleEmployee) =>
        item.temPida ? (
          <span className="text-success font-medium">Sim</span>
        ) : (
          <span className="text-muted-foreground">Não</span>
        ),
    },
    {
      key: 'ativo',
      header: 'Status',
      render: (item: EligibleEmployee) =>
        item.ativo ? (
          <span className="status-badge status-valid">Ativo</span>
        ) : (
          <span className="status-badge status-draft">Inativo</span>
        ),
    },
    {
      key: 'actions',
      header: 'Ações',
      className: 'text-right',
      render: (item: EligibleEmployee) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleView(item);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleView = (employee: EligibleEmployee) => {
    setSelectedEmployee(employee);
    setIsViewMode(true);
    setIsDialogOpen(true);
  };

  const handleEdit = (employee: EligibleEmployee) => {
    setSelectedEmployee(employee);
    setIsViewMode(false);
    setIsDialogOpen(true);
  };

  const handleDelete = (employee: EligibleEmployee) => {
    if (confirm(`Deseja realmente excluir o colaborador ${employee.nome}?`)) {
      setEmployees(employees.filter((e) => e.id !== employee.id));
      toast({
        title: 'Colaborador excluído',
        description: `${employee.nome} foi removido da lista de elegíveis.`,
      });
    }
  };

  const handleNewEmployee = () => {
    setSelectedEmployee(null);
    setIsViewMode(false);
    setIsDialogOpen(true);
  };

  const calculateRendimentoTotal = (emp: EligibleEmployee | null) => {
    if (!emp) return 0;
    return (
      emp.salarioBase +
      emp.valeAlimentacao +
      emp.valeRefeicao +
      emp.ajudaCusto +
      emp.mobilidade +
      emp.transporte +
      emp.cestaBeneficiosTeto +
      emp.pidaTeto
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Colaboradores Elegíveis"
        description="Gerencie os colaboradores que utilizam a Remuneração Estratégica"
      >
        <Button onClick={handleNewEmployee}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Colaborador
        </Button>
      </PageHeader>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, matrícula ou departamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-48">
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

      {/* Table */}
      <DataTable
        data={filteredEmployees}
        columns={columns}
        emptyMessage="Nenhum colaborador encontrado"
      />

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isViewMode
                ? 'Visualizar Colaborador'
                : selectedEmployee
                ? 'Editar Colaborador'
                : 'Novo Colaborador'}
            </DialogTitle>
            <DialogDescription>
              {isViewMode
                ? 'Detalhes da parametrização do colaborador'
                : 'Preencha os dados do colaborador e sua parametrização de remuneração'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Dados Básicos */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Dados Básicos</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Matrícula</Label>
                  <Input
                    defaultValue={selectedEmployee?.matricula || ''}
                    disabled={isViewMode}
                    placeholder="Ex: 12345"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input
                    defaultValue={selectedEmployee?.nome || ''}
                    disabled={isViewMode}
                    placeholder="Nome do colaborador"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    defaultValue={selectedEmployee?.email || ''}
                    disabled={isViewMode}
                    placeholder="email@empresa.com.br"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select
                    defaultValue={selectedEmployee?.departamento || ''}
                    disabled={isViewMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Componentes Fixos */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Componentes Fixos</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Salário Base (R$)</Label>
                  <Input
                    type="number"
                    defaultValue={selectedEmployee?.salarioBase || 0}
                    disabled={isViewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vale Alimentação (R$)</Label>
                  <Input
                    type="number"
                    defaultValue={selectedEmployee?.valeAlimentacao || 0}
                    disabled={isViewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vale Refeição (R$)</Label>
                  <Input
                    type="number"
                    defaultValue={selectedEmployee?.valeRefeicao || 0}
                    disabled={isViewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ajuda de Custo (R$)</Label>
                  <Input
                    type="number"
                    defaultValue={selectedEmployee?.ajudaCusto || 0}
                    disabled={isViewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mobilidade (R$)</Label>
                  <Input
                    type="number"
                    defaultValue={selectedEmployee?.mobilidade || 0}
                    disabled={isViewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Transporte (R$)</Label>
                  <Input
                    type="number"
                    defaultValue={selectedEmployee?.transporte || 0}
                    disabled={isViewMode}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Componentes Variáveis */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Componentes Variáveis</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cesta de Benefícios - Teto (R$)</Label>
                  <Input
                    type="number"
                    defaultValue={selectedEmployee?.cestaBeneficiosTeto || 0}
                    disabled={isViewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>PI/DA - Teto (R$)</Label>
                  <Input
                    type="number"
                    defaultValue={selectedEmployee?.pidaTeto || 0}
                    disabled={isViewMode || !selectedEmployee?.temPida}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="temPida"
                  checked={selectedEmployee?.temPida || false}
                  disabled={isViewMode}
                />
                <Label htmlFor="temPida">Possui PI/DA (Propriedade Intelectual / Direitos Autorais)</Label>
              </div>
            </div>

            <Separator />

            {/* Simulação */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  Simulação da Remuneração Estratégica
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Exportar PDF
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
                    <span>Componente</span>
                    <span className="text-right">Valor</span>
                    <span className="text-right">Tipo</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span>Salário Base</span>
                    <span className="text-right font-mono">{formatCurrency(selectedEmployee?.salarioBase || 0)}</span>
                    <span className="text-right text-muted-foreground">Fixo</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span>Vale Alimentação</span>
                    <span className="text-right font-mono">{formatCurrency(selectedEmployee?.valeAlimentacao || 0)}</span>
                    <span className="text-right text-muted-foreground">Fixo</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span>Vale Refeição</span>
                    <span className="text-right font-mono">{formatCurrency(selectedEmployee?.valeRefeicao || 0)}</span>
                    <span className="text-right text-muted-foreground">Fixo</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span>Ajuda de Custo</span>
                    <span className="text-right font-mono">{formatCurrency(selectedEmployee?.ajudaCusto || 0)}</span>
                    <span className="text-right text-muted-foreground">Fixo</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span>Mobilidade</span>
                    <span className="text-right font-mono">{formatCurrency(selectedEmployee?.mobilidade || 0)}</span>
                    <span className="text-right text-muted-foreground">Fixo</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span>Transporte</span>
                    <span className="text-right font-mono">{formatCurrency(selectedEmployee?.transporte || 0)}</span>
                    <span className="text-right text-muted-foreground">Fixo</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span>Cesta de Benefícios</span>
                    <span className="text-right font-mono">{formatCurrency(selectedEmployee?.cestaBeneficiosTeto || 0)}</span>
                    <span className="text-right text-muted-foreground">Teto Variável</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span>PI/DA</span>
                    <span className="text-right font-mono">{formatCurrency(selectedEmployee?.pidaTeto || 0)}</span>
                    <span className="text-right text-muted-foreground">Teto Variável</span>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-3 gap-2 text-sm font-bold">
                    <span>Rendimento Total</span>
                    <span className="text-right font-mono text-primary">
                      {formatCurrency(calculateRendimentoTotal(selectedEmployee))}
                    </span>
                    <span></span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {isViewMode ? 'Fechar' : 'Cancelar'}
            </Button>
            {!isViewMode && (
              <Button
                onClick={() => {
                  toast({
                    title: selectedEmployee ? 'Colaborador atualizado' : 'Colaborador criado',
                    description: 'Os dados foram salvos com sucesso.',
                  });
                  setIsDialogOpen(false);
                }}
              >
                Salvar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Colaboradores;
