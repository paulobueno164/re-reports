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
import { grupoDespesaService, GrupoDespesa } from '@/services/grupo-despesa.service';

export default function GruposDespesaLista() {
    const navigate = useNavigate();
    const [grupos, setGrupos] = useState<GrupoDespesa[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('todos');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [grupoToDelete, setGrupoToDelete] = useState<string | null>(null);

    useEffect(() => {
        fetchGrupos();
    }, []);

    const fetchGrupos = async () => {
        try {
            setLoading(true);
            const data = await grupoDespesaService.getAll();
            setGrupos(data);
        } catch (error) {
            toast.error('Erro ao carregar grupos de despesa');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!grupoToDelete) return;

        try {
            await grupoDespesaService.delete(grupoToDelete);
            toast.success('Grupo de despesa excluído com sucesso');
            fetchGrupos();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao excluir grupo de despesa');
            console.error(error);
        } finally {
            setDeleteDialogOpen(false);
            setGrupoToDelete(null);
        }
    };

    const filteredGrupos = grupos.filter((grupo) => {
        const matchesSearch = grupo.nome.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus =
            statusFilter === 'todos' ||
            (statusFilter === 'ativo' && grupo.ativo) ||
            (statusFilter === 'inativo' && !grupo.ativo);
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Grupos de Despesa</h1>
                    <p className="text-muted-foreground">
                        Gerencie os grupos utilizados nos tipos de despesa
                    </p>
                </div>
                <Button onClick={() => navigate('/configuracoes/grupos-despesa/novo')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Grupo
                </Button>
            </div>

            <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                        placeholder="Buscar grupo..."
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
                        ) : filteredGrupos.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center">
                                    Nenhum grupo de despesa encontrado
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredGrupos.map((grupo) => (
                                <TableRow key={grupo.id}>
                                    <TableCell className="font-medium">{grupo.nome}</TableCell>
                                    <TableCell>
                                        <Badge variant={grupo.ativo ? 'success' : 'secondary'}>
                                            {grupo.ativo ? 'Ativo' : 'Inativo'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => navigate(`/configuracoes/grupos-despesa/${grupo.id}`)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setGrupoToDelete(grupo.id);
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
                            Tem certeza que deseja excluir este grupo de despesa? Esta ação não pode ser desfeita.
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
