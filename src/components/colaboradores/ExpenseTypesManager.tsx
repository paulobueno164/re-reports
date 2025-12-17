import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Package, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/expense-validation';
import { toast } from 'sonner';

interface ExpenseType {
  id: string;
  nome: string;
  grupo: string;
  classificacao: string;
  valor_padrao_teto: number;
}

interface ColaboradorTipoDespesa {
  id: string;
  tipo_despesa_id: string;
  teto_individual: number | null;
  ativo: boolean;
}

export interface ExpenseTypeSelection {
  tipo_despesa_id: string;
  teto_individual: number | null;
}

export interface ExpenseTypesManagerRef {
  getSelectedTypes: () => ExpenseTypeSelection[];
}

interface ExpenseTypesManagerProps {
  colaboradorId?: string;
  disabled?: boolean;
  standalone?: boolean;
  onSelectionChange?: (selections: ExpenseTypeSelection[]) => void;
}

export const ExpenseTypesManager = forwardRef<ExpenseTypesManagerRef, ExpenseTypesManagerProps>(
  ({ colaboradorId, disabled = false, standalone = false, onSelectionChange }, ref) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
    const [linkedTypes, setLinkedTypes] = useState<Map<string, ColaboradorTipoDespesa>>(new Map());
    const [changes, setChanges] = useState<Map<string, { selected: boolean; teto: number | null }>>(new Map());

    useImperativeHandle(ref, () => ({
      getSelectedTypes: () => {
        const selections: ExpenseTypeSelection[] = [];
        for (const [typeId, change] of changes.entries()) {
          if (change.selected) {
            selections.push({
              tipo_despesa_id: typeId,
              teto_individual: change.teto,
            });
          }
        }
        return selections;
      },
    }));

    useEffect(() => {
      fetchData();
    }, [colaboradorId]);

    useEffect(() => {
      if (onSelectionChange) {
        const selections: ExpenseTypeSelection[] = [];
        for (const [typeId, change] of changes.entries()) {
          if (change.selected) {
            selections.push({
              tipo_despesa_id: typeId,
              teto_individual: change.teto,
            });
          }
        }
        onSelectionChange(selections);
      }
    }, [changes, onSelectionChange]);

    const fetchData = async () => {
      setLoading(true);

      // Fetch all variable expense types
      const { data: types, error: typesError } = await supabase
        .from('tipos_despesas')
        .select('*')
        .eq('ativo', true)
        .eq('classificacao', 'variavel')
        .order('grupo', { ascending: true })
        .order('nome', { ascending: true });

      if (typesError) {
        toast.error('Erro ao carregar tipos de despesa');
        setLoading(false);
        return;
      }

      let linkedMap = new Map<string, ColaboradorTipoDespesa>();

      // Only fetch linked types if we have a colaboradorId
      if (colaboradorId) {
        const { data: links, error: linksError } = await supabase
          .from('colaborador_tipos_despesas')
          .select('*')
          .eq('colaborador_id', colaboradorId);

        if (linksError) {
          toast.error('Erro ao carregar vínculos');
          setLoading(false);
          return;
        }

        links?.forEach(link => {
          linkedMap.set(link.tipo_despesa_id, link);
        });
      }

      setExpenseTypes(types || []);
      setLinkedTypes(linkedMap);

      // Initialize changes with current state
      const initialChanges = new Map<string, { selected: boolean; teto: number | null }>();
      types?.forEach(type => {
        const link = linkedMap.get(type.id);
        initialChanges.set(type.id, {
          selected: !!link?.ativo,
          teto: link?.teto_individual ?? null,
        });
      });
      setChanges(initialChanges);

      setLoading(false);
    };

    const handleToggleType = (typeId: string, checked: boolean) => {
      const current = changes.get(typeId) || { selected: false, teto: null };
      setChanges(prev => new Map(prev).set(typeId, { ...current, selected: checked }));
    };

    const handleTetoChange = (typeId: string, value: string) => {
      const current = changes.get(typeId) || { selected: false, teto: null };
      const teto = value === '' ? null : parseFloat(value);
      setChanges(prev => new Map(prev).set(typeId, { ...current, teto }));
    };

    const handleSave = async () => {
      if (!colaboradorId) return;
      
      setSaving(true);

      try {
        for (const [typeId, change] of changes.entries()) {
          const existingLink = linkedTypes.get(typeId);

          if (change.selected) {
            if (existingLink) {
              // Update existing link
              await supabase
                .from('colaborador_tipos_despesas')
                .update({
                  ativo: true,
                  teto_individual: change.teto,
                })
                .eq('id', existingLink.id);
            } else {
              // Create new link
              await supabase
                .from('colaborador_tipos_despesas')
                .insert({
                  colaborador_id: colaboradorId,
                  tipo_despesa_id: typeId,
                  ativo: true,
                  teto_individual: change.teto,
                });
            }
          } else if (existingLink) {
            // Deactivate existing link
            await supabase
              .from('colaborador_tipos_despesas')
              .update({ ativo: false })
              .eq('id', existingLink.id);
          }
        }

        toast.success('Tipos de despesa atualizados com sucesso');
        await fetchData();
      } catch (error: any) {
        toast.error('Erro ao salvar: ' + error.message);
      } finally {
        setSaving(false);
      }
    };

    // Group expense types by grupo
    const groupedTypes = expenseTypes.reduce((acc, type) => {
      if (!acc[type.grupo]) acc[type.grupo] = [];
      acc[type.grupo].push(type);
      return acc;
    }, {} as Record<string, ExpenseType[]>);

    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }

    const selectedCount = Array.from(changes.values()).filter(c => c.selected).length;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Tipos de Despesa Permitidos ({selectedCount} selecionados)
            </div>
            {!disabled && !standalone && colaboradorId && (
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 pr-4">
            <div className="space-y-4">
              {Object.entries(groupedTypes).map(([grupo, types]) => (
                <div key={grupo} className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {grupo}
                  </h4>
                  <div className="space-y-2">
                    {types.map(type => {
                      const change = changes.get(type.id) || { selected: false, teto: null };

                      return (
                        <div
                          key={type.id}
                          className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                            change.selected ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
                          }`}
                        >
                          <Checkbox
                            id={`type-${type.id}`}
                            checked={change.selected}
                            onCheckedChange={(checked) => handleToggleType(type.id, !!checked)}
                            disabled={disabled}
                          />
                          <div className="flex-1 min-w-0">
                            <Label
                              htmlFor={`type-${type.id}`}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {type.nome}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Teto padrão: {formatCurrency(type.valor_padrao_teto)}
                            </p>
                          </div>
                          <div className="w-28">
                            <Input
                              type="number"
                              placeholder="Teto ind."
                              value={change.teto ?? ''}
                              onChange={(e) => handleTetoChange(type.id, e.target.value)}
                              disabled={disabled || !change.selected}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <p className="text-xs text-muted-foreground mt-3">
            {standalone 
              ? 'Selecione os tipos de despesa que este colaborador poderá lançar. Deixe em branco para permitir todos.'
              : 'Deixe o teto individual em branco para usar o teto padrão do tipo de despesa.'
            }
          </p>
        </CardContent>
      </Card>
    );
  }
);

ExpenseTypesManager.displayName = 'ExpenseTypesManager';
