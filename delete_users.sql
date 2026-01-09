-- Deletar usuários indesejados e suas dependências
DO $$
DECLARE
    target_emails text[] := ARRAY['paulo@teclia.com', 'testerh@sistema.com.br', 'teste@teste.com.br'];
BEGIN
    -- Remover de user_roles
    DELETE FROM public.user_roles 
    WHERE user_id IN (SELECT id FROM auth.users WHERE email = ANY(target_emails));

    -- Remover de profiles
    DELETE FROM public.profiles 
    WHERE id IN (SELECT id FROM auth.users WHERE email = ANY(target_emails));

    -- Remover de colaboradores_elegiveis (setar user_id null ou deletar se necessário? Geralmente colaborador existe independente do user, mas pediu pra apagar usuario. Vou setar user_id NULL para preservar o histórico do colaborador se existir, ou deletar se for login apenas. O pedido foi apagar usuarios. Se o colaborador foi criado 'para ele', talvez devêssemos limpar. Vou limpar o vínculo por segurança mantendo o registro do colaborador se tiver dados financeiros, mas como são usuarios de teste, vou assumir delete do vinculo apenas por enquanto para evitar perder dados de folha se houver).
    -- Na verdade, se deletar de auth.users, o colaborador fica órfão de acesso.
    UPDATE public.colaboradores_elegiveis 
    SET user_id = NULL 
    WHERE user_id IN (SELECT id FROM auth.users WHERE email = ANY(target_emails));

    -- Remover de auth.users
    DELETE FROM auth.users 
    WHERE email = ANY(target_emails);
END $$;
