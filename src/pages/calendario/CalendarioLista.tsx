import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, CalendarDays, Loader2, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { periodosService, CalendarioPeriodo } from "@/services/periodos.service";
import { formatDate } from "@/lib/expense-validation";

interface CalendarPeriod {
  id: string;
  periodo: string;
  dataInicio: Date;
  dataFinal: Date;
  abreLancamento: Date;
  fechaLancamento: Date;
  status: "aberto" | "fechado";
}

const CalendarioLista = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [periods, setPeriods] = useState<CalendarPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const data = await periodosService.getAll();
      setPeriods(
        data.map((p) => ({
          id: p.id,
          periodo: p.periodo,
          dataInicio: new Date(p.data_inicio),
          dataFinal: new Date(p.data_final),
          abreLancamento: new Date(p.abre_lancamento),
          fechaLancamento: new Date(p.fecha_lancamento),
          status: p.status as "aberto" | "fechado",
        })),
      );
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const currentPeriod = periods.find((p) => p.status === "aberto");

  const handleDelete = async (period: CalendarPeriod) => {
    if (!confirm(`Deseja realmente excluir o período ${period.periodo}?`)) return;

    try {
      await periodosService.delete(period.id);
      toast({ title: "Período excluído", description: `Período ${period.periodo} foi removido.` });
      fetchPeriods();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const columns = [
    { key: "periodo", header: "Período", className: "font-medium" },
    {
      key: "dataInicio",
      header: "Início",
      hideOnMobile: true,
      render: (item: CalendarPeriod) => formatDate(item.dataInicio),
    },
    {
      key: "dataFinal",
      header: "Fim",
      hideOnMobile: true,
      render: (item: CalendarPeriod) => formatDate(item.dataFinal),
    },
    {
      key: "abreLancamento",
      header: "Abre",
      render: (item: CalendarPeriod) => formatDate(item.abreLancamento),
    },
    {
      key: "fechaLancamento",
      header: "Fecha",
      render: (item: CalendarPeriod) => formatDate(item.fechaLancamento),
    },
    {
      key: "status",
      header: "Status",
      render: (item: CalendarPeriod) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (item: CalendarPeriod) => (
        <div className="flex justify-end gap-1">
          <div className="hidden sm:flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate(`/calendario/${item.id}/editar`)}
              disabled={item.status === "fechado"}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleDelete(item)}
              disabled={item.status === "fechado"}
            >
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
                <DropdownMenuItem
                  onClick={() => navigate(`/calendario/${item.id}/editar`)}
                  disabled={item.status === "fechado"}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDelete(item)}
                  className="text-destructive"
                  disabled={item.status === "fechado"}
                >
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
        title="Calendário de Períodos"
        description="Defina os períodos mensais e as janelas de lançamento para colaboradores"
      >
        <Button onClick={() => navigate("/calendario/novo")}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Período
        </Button>
      </PageHeader>

      {/* Current Period Card */}
      {currentPeriod && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Período Atual em Aberto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Período</p>
                <p className="text-lg font-semibold">{currentPeriod.periodo}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Acúmulo de Despesas</p>
                <p className="font-medium">
                  {formatDate(currentPeriod.dataInicio)} - {formatDate(currentPeriod.dataFinal)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Janela de Lançamento</p>
                <p className="font-medium">
                  {formatDate(currentPeriod.abreLancamento)} - {formatDate(currentPeriod.fechaLancamento)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <StatusBadge status={currentPeriod.status} />
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={() => navigate(`/calendario/${currentPeriod.id}/editar`)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <DataTable data={periods} columns={columns} emptyMessage="Nenhum período cadastrado" />
    </div>
  );
};

export default CalendarioLista;
