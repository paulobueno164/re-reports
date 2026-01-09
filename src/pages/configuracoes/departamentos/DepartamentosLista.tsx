import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { departamentoService, Departamento } from '@/services/departamento.service';

export default function DepartamentosLista() {
    const navigate = useNavigate();
    const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('todos');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [departamentoToDelete, setDepartamentoToDelete] = useState<string | null>(null);

    useEffect(() => {
        fetchDepartamentos();
    }, []);

    const fetchDepartamentos = async () => {
        try {
            setLoading(true);
            const data = await departamentoService.getAll();
            setDepartamentos(data);
        } catch (error) {
            toast.error('Erro ao carregar departamentos');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!departamentoToDelete) return;

        try {
            await departamentoService.delete(departamentoToDelete);
            toast.success('Departamento excluído com sucesso');
            fetchDepartamentos();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao excluir departamento');
            console.error(error);
        } finally {
            setDeleteDialogOpen(false);
            setDepartamentoToDelete(null);
        }
    };

    const filteredDepartamentos = departamentos.filter((dept) => {
        const matchesSearch = dept.nome.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus =
            statusFilter === 'todos' ||
            (statusFilter === 'ativo' && dept.ativo) ||
            (statusFilter === 'inativo' && !dept.ativo);
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Departamentos</h1>
                    <p className="text-muted-foreground">Gerencie os departamentos da empresa</p>
                </div>
                <Button onClick={() => navigate('/configuracoes/departamentos/novo')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Departamento
                </Button>
            </div>

            <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                        placeholder="Buscar departamento..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center">
                                    Carregando...
                                </TableCell>
                            </TableRow>
                        ) : filteredDepartamentos.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center">
                                    Nenhum departamento encontrado
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredDepartamentos.map((dept) => (
                                <TableRow key={dept.id}>
                                    <TableCell className="font-medium">{dept.nome}</TableCell>
                                    <TableCell>
                                        <Badge variant={dept.ativo ? 'success' : 'secondary'}>
                                            {dept.ativo ? 'Ativo' : 'Inativo'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => navigate(`/configuracoes/departamentos/${dept.id}`)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setDepartamentoToDelete(dept.id);
                                                    setDeleteDialogOpen(true);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este departamento? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
