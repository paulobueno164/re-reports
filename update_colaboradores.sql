DO $$
BEGIN
    -- Adicionar ferias_inicio se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='colaboradores_elegiveis' AND column_name='ferias_inicio') THEN
        ALTER TABLE public.colaboradores_elegiveis ADD COLUMN ferias_inicio DATE;
    END IF;

    -- Adicionar ferias_fim se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='colaboradores_elegiveis' AND column_name='ferias_fim') THEN
        ALTER TABLE public.colaboradores_elegiveis ADD COLUMN ferias_fim DATE;
    END IF;

    -- Adicionar beneficio_proporcional se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='colaboradores_elegiveis' AND column_name='beneficio_proporcional') THEN
        ALTER TABLE public.colaboradores_elegiveis ADD COLUMN beneficio_proporcional BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;
