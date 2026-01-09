import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { departamentoService, Departamento } from '@/services/departamento.service';

export default function DepartamentoForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = !!id;

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nome: '',
        ativo: true,
    });

    useEffect(() => {
        if (isEditing && id) {
            fetchDepartamento(id);
        }
    }, [isEditing, id]);

    const fetchDepartamento = async (departamentoId: string) => {
        try {
            setLoading(true);
            const data = await departamentoService.getById(departamentoId);
            setFormData({
                nome: data.nome,
                ativo: data.ativo,
            });
        } catch (error) {
            toast.error('Erro ao carregar departamento');
            console.error(error);
            navigate('/configuracoes/departamentos');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nome.trim()) {
            toast.error('Nome é obrigatório');
            return;
        }

        try {
            setLoading(true);

            if (isEditing && id) {
                await departamentoService.update(id, formData);
                toast.success('Departamento atualizado com sucesso');
            } else {
                await departamentoService.create(formData);
                toast.success('Departamento criado com sucesso');
            }

            navigate('/configuracoes/departamentos');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao salvar departamento');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/configuracoes/departamentos')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">
                        {isEditing ? 'Editar Departamento' : 'Novo Departamento'}
                    </h1>
                    <p className="text-muted-foreground">
                        {isEditing ? 'Altere os dados do departamento' : 'Cadastre um novo departamento'}
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Dados do Departamento</CardTitle>
                    <CardDescription>
                        Preencha as informações do departamento
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="nome">Nome do Departamento *</Label>
                            <Input
                                id="nome"
                                value={formData.nome}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                placeholder="Ex: Recursos Humanos"
                                required
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <Switch
                                id="ativo"
                                checked={formData.ativo}
                                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                            />
                            <Label htmlFor="ativo">Departamento ativo</Label>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate('/configuracoes/departamentos')}
                                disabled={loading}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? 'Salvando...' : 'Salvar'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
