-- Add numero_documento column to lancamentos table
ALTER TABLE public.lancamentos 
ADD COLUMN numero_documento TEXT;