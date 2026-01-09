-- Prompt 5: Create colaborador_tipos_despesas linking table
CREATE TABLE public.colaborador_tipos_despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES colaboradores_elegiveis(id) ON DELETE CASCADE,
  tipo_despesa_id UUID NOT NULL REFERENCES tipos_despesas(id) ON DELETE CASCADE,
  teto_individual DECIMAL(12,2),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(colaborador_id, tipo_despesa_id)
);

-- Enable RLS
ALTER TABLE public.colaborador_tipos_despesas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "RH pode gerenciar vínculos tipos despesas" 
ON public.colaborador_tipos_despesas 
FOR ALL 
USING (public.has_role(auth.uid(), 'RH'));

CREATE POLICY "Colaborador pode ver seus próprios vínculos" 
ON public.colaborador_tipos_despesas 
FOR SELECT 
USING (colaborador_id = public.get_colaborador_id(auth.uid()));

CREATE POLICY "RH e Financeiro podem ver todos vínculos" 
ON public.colaborador_tipos_despesas 
FOR SELECT 
USING (public.has_role(auth.uid(), 'RH') OR public.has_role(auth.uid(), 'FINANCEIRO'));