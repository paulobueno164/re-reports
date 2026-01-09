#!/bin/bash
# Copia arquivos para /tmp para garantir que postgres user consiga ler
# (O usuário postgres não consegue acessar /home/dev_admin por padrão)
cp banco.sql /tmp/banco.sql
cp seed_users.sql /tmp/seed_users.sql
cp reset_db.sql /tmp/reset_db.sql
chmod 644 /tmp/banco.sql /tmp/seed_users.sql /tmp/reset_db.sql

echo "Resetting DB..."
sudo -u postgres psql -d re_reports -f /tmp/reset_db.sql
if [ $? -eq 0 ]; then
    echo "Applying Schema..."
    sudo -u postgres psql -d re_reports -f /tmp/banco.sql > schema.log 2>&1
    
    if grep -q "ERROR:" schema.log; then
        echo "WARNING: There were errors in schema application. Check schema.log"
    fi
    
    echo "Applying Seed..."
    echo "Disabling trigger..."
    sudo -u postgres psql -d re_reports -c "ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;"
    
    echo "Inserting users..."
    sudo -u postgres psql -d re_reports -f /tmp/seed_users.sql
    
    echo "Enabling trigger..."
    sudo -u postgres psql -d re_reports -c "ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;"
    
    echo "Seed applied."
    
    # Limpeza
    rm /tmp/banco.sql /tmp/seed_users.sql /tmp/reset_db.sql
else
    echo "Reset failed."
fi
