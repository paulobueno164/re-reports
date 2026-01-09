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
import { grupoDespesaService, GrupoDespesa } from '@/services/grupo-despesa.service';

export default function GrupoDespesaForm() {
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
            fetchGrupo(id);
        }
    }, [isEditing, id]);

    const fetchGrupo = async (grupoId: string) => {
        try {
            setLoading(true);
            const data = await grupoDespesaService.getById(grupoId);
            setFormData({
                nome: data.nome,
                ativo: data.ativo,
            });
        } catch (error) {
            toast.error('Erro ao carregar grupo de despesa');
            console.error(error);
            navigate('/configuracoes/grupos-despesa');
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
                await grupoDespesaService.update(id, formData);
                toast.success('Grupo de despesa atualizado com sucesso');
            } else {
                await grupoDespesaService.create(formData);
                toast.success('Grupo de despesa criado com sucesso');
            }

            navigate('/configuracoes/grupos-despesa');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao salvar grupo de despesa');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/configuracoes/grupos-despesa')}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">
                        {isEditing ? 'Editar Grupo de Despesa' : 'Novo Grupo de Despesa'}
                    </h1>
                    <p className="text-muted-foreground">
                        {isEditing
                            ? 'Altere os dados do grupo de despesa'
                            : 'Cadastre um novo grupo de despesa'}
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Dados do Grupo</CardTitle>
                    <CardDescription>
                        Preencha as informações do grupo de despesa
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="nome">Nome do Grupo *</Label>
                            <Input
                                id="nome"
                                value={formData.nome}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                placeholder="Ex: Cesta de Benefícios"
                                required
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <Switch
                                id="ativo"
                                checked={formData.ativo}
                                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                            />
                            <Label htmlFor="ativo">Grupo ativo</Label>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate('/configuracoes/grupos-despesa')}
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
