import { useState } from 'react';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
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
import { mockExpenseTypes, formatCurrency, expenseGroups } from '@/lib/mock-data';
import { ExpenseType, ExpenseOrigin } from '@/types';

const TiposDespesas = () => {
  const { toast } = useToast();
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>(mockExpenseTypes);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ExpenseType | null>(null);

  const filteredTypes = expenseTypes.filter(
    (type) =>
      type.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.grupo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const originLabels: Record<ExpenseOrigin, string> = {
    proprio: 'Próprio',
    conjuge: 'Cônjuge',
    filhos: 'Filhos',
  };

  const columns = [
    { key: 'nome', header: 'Tipo de Despesa' },
    { key: 'grupo', header: 'Grupo' },
    {
      key: 'classificacao',
      header: 'Classificação',
      render: (item: ExpenseType) => (
        <Badge variant={item.classificacao === 'fixo' ? 'secondary' : 'default'}>
          {item.classificacao === 'fixo' ? 'Fixo' : 'Variável'}
        </Badge>
      ),
    },
    {
      key: 'valorPadraoTeto',
      header: 'Valor Padrão Teto',
      className: 'text-right font-mono',
      render: (item: ExpenseType) => formatCurrency(item.valorPadraoTeto),
    },
    {
      key: 'origemPermitida',
      header: 'Origem Permitida',
      render: (item: ExpenseType) => (
        <div className="flex gap-1 flex-wrap">
          {item.origemPermitida.map((origin) => (
            <Badge key={origin} variant="outline" className="text-xs">
              {originLabels[origin]}
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
      header: 'Ações',
      className: 'text-right',
      render: (item: ExpenseType) => (
        <div className="flex justify-end gap-1">
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

  const handleEdit = (type: ExpenseType) => {
    setSelectedType(type);
    setIsDialogOpen(true);
  };

  const handleDelete = (type: ExpenseType) => {
    if (confirm(`Deseja realmente excluir o tipo de despesa "${type.nome}"?`)) {
      setExpenseTypes(expenseTypes.filter((t) => t.id !== type.id));
      toast({
        title: 'Tipo de despesa excluído',
        description: `"${type.nome}" foi removido.`,
      });
    }
  };

  const handleNew = () => {
    setSelectedType(null);
    setIsDialogOpen(true);
  };

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
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou grupo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-48">
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
        <Select defaultValue="all">
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Classificação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="fixo">Fixo</SelectItem>
            <SelectItem value="variavel">Variável</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        data={filteredTypes}
        columns={columns}
        emptyMessage="Nenhum tipo de despesa encontrado"
      />

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedType ? 'Editar Tipo de Despesa' : 'Novo Tipo de Despesa'}
            </DialogTitle>
            <DialogDescription>
              Configure os parâmetros do tipo de despesa
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Tipo de Despesa</Label>
              <Input
                defaultValue={selectedType?.nome || ''}
                placeholder="Ex: Notebook, Previdência Privada"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Classificação</Label>
                <Select defaultValue={selectedType?.classificacao || 'variavel'}>
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
                <Select defaultValue={selectedType?.grupo || ''}>
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
                defaultValue={selectedType?.valorPadraoTeto || 0}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Este valor será sugerido ao cadastrar novos colaboradores
              </p>
            </div>

            <div className="space-y-3">
              <Label>Origem Permitida</Label>
              <p className="text-xs text-muted-foreground">
                Selecione quem pode ser beneficiário desta despesa
              </p>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="proprio"
                    defaultChecked={selectedType?.origemPermitida.includes('proprio') ?? true}
                  />
                  <Label htmlFor="proprio" className="font-normal">
                    Próprio (Colaborador)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="conjuge"
                    defaultChecked={selectedType?.origemPermitida.includes('conjuge') ?? false}
                  />
                  <Label htmlFor="conjuge" className="font-normal">
                    Cônjuge
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="filhos"
                    defaultChecked={selectedType?.origemPermitida.includes('filhos') ?? false}
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
            <Button
              onClick={() => {
                toast({
                  title: selectedType ? 'Tipo atualizado' : 'Tipo criado',
                  description: 'Os dados foram salvos com sucesso.',
                });
                setIsDialogOpen(false);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TiposDespesas;
