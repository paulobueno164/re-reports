#!/bin/bash
export PGPASSWORD=ee1631
echo "Resetting DB..."
psql -U postgres -d re_reports -f reset_db.sql
if [ $? -eq 0 ]; then
    echo "Applying Schema..."
    psql -U postgres -d re_reports -f banco.sql > schema.log 2>&1
    # Verifica se houve erros graves, psql retorna 0 mesmo com erros SQL se não usar -v ON_ERROR_STOP=1
    # Mas vamos checar o log por erros comuns
    if grep -q "ERROR:" schema.log; then
        echo "WARNING: There were errors in schema application. Check schema.log"
        # cat schema.log | head -n 20
        # Continua mesmo assim, as vezes são erros ignoráveis
    fi
    
    echo "Applying Seed..."
    # Desabilitar trigger é crucial
    # Precisa ser superuser para desabilitar trigger em auth.users se ela pertencer a postgres? Sim.
    # Vamos tentar com sudo se falhar
    
    echo "Disabling trigger..."
    psql -U postgres -d re_reports -c "ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;" || sudo -u postgres psql -d re_reports -c "ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;"
    
    echo "Inserting users..."
    psql -U postgres -d re_reports -f seed_users.sql
    
    echo "Enabling trigger..."
    psql -U postgres -d re_reports -c "ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;" || sudo -u postgres psql -d re_reports -c "ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;"
    
    echo "Seed applied."
else
    echo "Reset failed."
fi
