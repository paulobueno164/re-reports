import { useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Package, Loader2, Save, Search, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import tiposDespesasService, { TipoDespesa } from '@/services/tipos-despesas.service';
import { colaboradoresService } from '@/services/colaboradores.service';

interface ColaboradorTipoDespesa {
  id: string;
  tipo_despesa_id: string;
  ativo: boolean;
}

export interface ExpenseTypeSelection {
  tipo_despesa_id: string;
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
    const [expenseTypes, setExpenseTypes] = useState<TipoDespesa[]>([]);
    const [linkedTypes, setLinkedTypes] = useState<Map<string, ColaboradorTipoDespesa>>(new Map());
    const [changes, setChanges] = useState<Map<string, boolean>>(new Map());
    const [searchTerm, setSearchTerm] = useState('');

    useImperativeHandle(ref, () => ({
      getSelectedTypes: () => {
        const selections: ExpenseTypeSelection[] = [];
        for (const [typeId, selected] of changes.entries()) {
          if (selected) {
            selections.push({ tipo_despesa_id: typeId });
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
        for (const [typeId, selected] of changes.entries()) {
          if (selected) {
            selections.push({ tipo_despesa_id: typeId });
          }
        }
        onSelectionChange(selections);
      }
    }, [changes, onSelectionChange]);

    const fetchData = async () => {
      setLoading(true);

      try {
        // Fetch all variable expense types
        const types = await tiposDespesasService.getAll({ ativo: true, classificacao: 'variavel' });

        let linkedMap = new Map<string, ColaboradorTipoDespesa>();

        // Only fetch linked types if we have a colaboradorId
        if (colaboradorId) {
          const links = await colaboradoresService.getTiposDespesas(colaboradorId);
          links.forEach(link => {
            linkedMap.set(link.tipo_despesa_id, {
              id: link.id,
              tipo_despesa_id: link.tipo_despesa_id,
              ativo: link.ativo,
            });
          });
        }

        setExpenseTypes(types);
        setLinkedTypes(linkedMap);

        // Initialize changes with current state
        const initialChanges = new Map<string, boolean>();
        types.forEach(type => {
          const link = linkedMap.get(type.id);
          initialChanges.set(type.id, !!link?.ativo);
        });
        setChanges(initialChanges);
      } catch (error: any) {
        toast.error('Erro ao carregar tipos de despesa: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    const handleToggleType = (typeId: string, checked: boolean) => {
      setChanges(prev => new Map(prev).set(typeId, checked));
    };

    const handleSelectAll = () => {
      const newChanges = new Map<string, boolean>();
      expenseTypes.forEach(type => {
        newChanges.set(type.id, true);
      });
      setChanges(newChanges);
    };

    const handleDeselectAll = () => {
      const newChanges = new Map<string, boolean>();
      expenseTypes.forEach(type => {
        newChanges.set(type.id, false);
      });
      setChanges(newChanges);
    };

    const handleSave = async () => {
      if (!colaboradorId) return;
      
      setSaving(true);

      try {
        const selectedTypeIds = Array.from(changes.entries())
          .filter(([_, selected]) => selected)
          .map(([typeId]) => typeId);
        
        await colaboradoresService.updateTiposDespesas(colaboradorId, selectedTypeIds);

        toast.success('Tipos de despesa atualizados com sucesso');
        await fetchData();
      } catch (error: any) {
        toast.error('Erro ao salvar: ' + error.message);
      } finally {
        setSaving(false);
      }
    };

    // Filter and group expense types
    const filteredAndGroupedTypes = useMemo(() => {
      const filtered = expenseTypes.filter(type => {
        const search = searchTerm.toLowerCase();
        return type.nome.toLowerCase().includes(search) || 
               type.grupo.toLowerCase().includes(search);
      });
      
      return filtered.reduce((acc, type) => {
        if (!acc[type.grupo]) acc[type.grupo] = [];
        acc[type.grupo].push(type);
        return acc;
      }, {} as Record<string, TipoDespesa[]>);
    }, [expenseTypes, searchTerm]);

    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }

    const selectedCount = Array.from(changes.values()).filter(c => c).length;
    const allSelected = selectedCount === expenseTypes.length && expenseTypes.length > 0;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Tipos de Despesa Permitidos ({selectedCount} de {expenseTypes.length})
            </div>
            <div className="flex items-center gap-2">
              {!disabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={allSelected ? handleDeselectAll : handleSelectAll}
                >
                  {allSelected ? (
                    <>
                      <Square className="h-4 w-4 mr-1" />
                      Desmarcar Todos
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-4 w-4 mr-1" />
                      Selecionar Todos
                    </>
                  )}
                </Button>
              )}
              {!disabled && !standalone && colaboradorId && (
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou grupo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="space-y-4">
            {Object.keys(filteredAndGroupedTypes).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum tipo de despesa encontrado
              </p>
            ) : (
              Object.entries(filteredAndGroupedTypes).map(([grupo, types]) => (
                <div key={grupo} className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {grupo}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {types.map(type => {
                      const selected = changes.get(type.id) || false;

                      return (
                        <div
                          key={type.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                            selected ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 hover:bg-muted/50'
                          }`}
                          onClick={() => !disabled && handleToggleType(type.id, !selected)}
                        >
                          <Checkbox
                            id={`type-${type.id}`}
                            checked={selected}
                            onCheckedChange={(checked) => handleToggleType(type.id, !!checked)}
                            disabled={disabled}
                          />
                          <Label
                            htmlFor={`type-${type.id}`}
                            className="text-sm font-medium cursor-pointer flex-1"
                          >
                            {type.nome}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Selecione os tipos de despesa que este colaborador poderá lançar na Cesta de Benefícios.
          </p>
        </CardContent>
      </Card>
    );
  }
);

ExpenseTypesManager.displayName = 'ExpenseTypesManager';
