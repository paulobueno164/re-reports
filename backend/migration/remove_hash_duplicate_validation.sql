-- Remover validação de duplicidade de comprovantes via hash
-- Agora é permitido fazer upload do mesmo arquivo múltiplas vezes

-- Remover trigger de validação de duplicidade
DROP TRIGGER IF EXISTS tr_validar_comprovante_duplicado ON public.anexos;
DROP TRIGGER IF EXISTS validar_comprovante_duplicado_trigger ON public.anexos;

-- Remover função de validação de duplicidade
DROP FUNCTION IF EXISTS public.validar_comprovante_duplicado();

-- Remover índice único de hash_comprovante
DROP INDEX IF EXISTS idx_anexos_hash_unique;

-- Nota: A coluna hash_comprovante permanece na tabela para manter compatibilidade,
-- mas não será mais usada para validação de duplicidade

