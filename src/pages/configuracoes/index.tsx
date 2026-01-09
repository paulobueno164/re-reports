import { useNavigate } from 'react-router-dom';
import { Building2, FolderTree } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ConfiguracoesIndex() {
    const navigate = useNavigate();

    const modules = [
        {
            title: 'Departamentos',
            description: 'Gerencie os departamentos da empresa',
            icon: <Building2 className="h-12 w-12" />,
            path: '/configuracoes/departamentos',
        },
        {
            title: 'Grupos de Despesa',
            description: 'Gerencie os grupos de despesas',
            icon: <FolderTree className="h-12 w-12" />,
            path: '/configuracoes/grupos-despesa',
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Configurações</h1>
                <p className="text-muted-foreground">
                    Gerencie as configurações do sistema
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {modules.map((module) => (
                    <Card key={module.path} className="cursor-pointer hover:border-primary transition-colors">
                        <CardHeader>
                            <div className="mb-4 text-primary">{module.icon}</div>
                            <CardTitle>{module.title}</CardTitle>
                            <CardDescription>{module.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                onClick={() => navigate(module.path)}
                                variant="outline"
                                className="w-full"
                            >
                                Acessar
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
