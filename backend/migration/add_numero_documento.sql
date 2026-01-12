-- Add numero_documento column to lancamentos table
ALTER TABLE public.lancamentos 
ADD COLUMN IF NOT EXISTS numero_documento TEXT;

