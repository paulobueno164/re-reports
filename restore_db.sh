#!/bin/bash
# Nao precisa de PGPASSWORD se usar sudo -u postgres
echo "Resetting DB..."
sudo -u postgres psql -d re_reports -f reset_db.sql
if [ $? -eq 0 ]; then
    echo "Applying Schema..."
    sudo -u postgres psql -d re_reports -f banco.sql > schema.log 2>&1
    
    if grep -q "ERROR:" schema.log; then
        echo "WARNING: There were errors in schema application. Check schema.log"
    fi
    
    echo "Applying Seed..."
    echo "Disabling trigger..."
    sudo -u postgres psql -d re_reports -c "ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;"
    
    echo "Inserting users..."
    # Precisamos garantir que o postgres user consiga ler o arquivo seed_users.sql.
    # O arquivo está no home do dev_admin. O usuário postgres pode não ter permissão de leitura.
    # Usar cat e pipe resolve.
    cat seed_users.sql | sudo -u postgres psql -d re_reports
    
    echo "Enabling trigger..."
    sudo -u postgres psql -d re_reports -c "ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;"
    
    echo "Seed applied."
else
    echo "Reset failed."
fi
