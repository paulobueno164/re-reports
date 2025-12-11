import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/expense-validation';

interface Expense {
  id: string;
  colaboradorNome: string;
  tipoDespesaNome: string;
  valorLancado: number;
  status: string;
}

interface BatchApprovalPanelProps {
  expenses: Expense[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onComplete: () => void;
}

export function BatchApprovalPanel({
  expenses,
  selectedIds,
  onSelectionChange,
  onComplete,
}: BatchApprovalPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [batchRejectionReason, setBatchRejectionReason] = useState('');

  const pendingExpenses = expenses.filter(
    (e) => e.status === 'enviado' || e.status === 'em_analise'
  );

  const selectedExpenses = pendingExpenses.filter((e) => selectedIds.includes(e.id));
  const totalSelected = selectedExpenses.reduce((sum, e) => sum + e.valorLancado, 0);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(pendingExpenses.map((e) => e.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;

    setProcessing(true);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('lancamentos')
      .update({
        status: 'valido',
        validado_por: user?.id,
        validado_em: now,
      })
      .in('id', selectedIds);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Aprovação em lote concluída',
        description: `${selectedIds.length} despesa(s) foram aprovadas com sucesso.`,
      });
      onSelectionChange([]);
      onComplete();
    }
    setProcessing(false);
    setShowApproveDialog(false);
  };

  const handleBatchReject = async () => {
    if (selectedIds.length === 0 || !batchRejectionReason.trim()) return;

    setProcessing(true);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('lancamentos')
      .update({
        status: 'invalido',
        motivo_invalidacao: batchRejectionReason,
        validado_por: user?.id,
        validado_em: now,
      })
      .in('id', selectedIds);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Rejeição em lote concluída',
        description: `${selectedIds.length} despesa(s) foram rejeitadas.`,
      });
      onSelectionChange([]);
      setBatchRejectionReason('');
      onComplete();
    }
    setProcessing(false);
    setShowRejectDialog(false);
  };

  if (pendingExpenses.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Selection Controls */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="selectAllBatch"
              checked={selectedIds.length === pendingExpenses.length && pendingExpenses.length > 0}
              onCheckedChange={(checked) => handleSelectAll(!!checked)}
            />
            <Label htmlFor="selectAllBatch" className="font-medium">
              Selecionar Todos ({pendingExpenses.length})
            </Label>
          </div>

          {selectedIds.length > 0 && (
            <div className="text-sm text-muted-foreground pl-4 border-l">
              <span className="font-medium text-foreground">{selectedIds.length}</span> selecionado(s)
              {' • '}
              Total: <span className="font-mono font-medium text-foreground">{formatCurrency(totalSelected)}</span>
            </div>
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setShowRejectDialog(true)}
              disabled={processing}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Rejeitar Selecionados
            </Button>
            <Button
              className="bg-success hover:bg-success/90"
              onClick={() => setShowApproveDialog(true)}
              disabled={processing}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Aprovar Selecionados
            </Button>
          </div>
        )}
      </div>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Confirmar Aprovação em Lote
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Você está prestes a aprovar <strong>{selectedIds.length} despesa(s)</strong> totalizando:</p>
              <p className="text-2xl font-bold text-success">{formatCurrency(totalSelected)}</p>
              <p className="text-sm">Esta ação não pode ser desfeita.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchApprove}
              disabled={processing}
              className="bg-success hover:bg-success/90"
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Aprovação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Rejeitar Despesas em Lote
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4 mt-2">
                <p>
                  Você está prestes a rejeitar <strong>{selectedIds.length} despesa(s)</strong>.
                  Informe o motivo da rejeição que será aplicado a todas:
                </p>
                <div className="space-y-2">
                  <Label>Motivo da Rejeição</Label>
                  <Textarea
                    value={batchRejectionReason}
                    onChange={(e) => setBatchRejectionReason(e.target.value)}
                    placeholder="Descreva o motivo da rejeição em lote..."
                    rows={3}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchReject}
              disabled={processing || !batchRejectionReason.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Rejeição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
