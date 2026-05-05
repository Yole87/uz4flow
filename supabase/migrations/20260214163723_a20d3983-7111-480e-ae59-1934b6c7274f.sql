
-- Adicionar sender_name na tabela messages para identificar quem enviou
ALTER TABLE public.messages ADD COLUMN sender_name text;
