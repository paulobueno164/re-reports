#!/bin/bash

echo "=== RE-REPORTS - Script de Deploy no Servidor ==="

# Criar banco de dados
echo "1. Criando banco de dados PostgreSQL..."
sudo -u postgres psql <<EOF
-- Dropar se existir (cuidado em produção!)
DROP DATABASE IF EXISTS re_reports;
CREATE DATABASE re_reports;
\q
EOF

# Importar schema
echo "2. Importando schema do banco de dados..."
sudo -u postgres psql -d re_reports -f /home/dev_admin/re-reports/banco.sql

# Ir para o diretório do backend
cd /home/dev_admin/re-reports/backend

# Copiar arquivo de configuração de produção
echo "3. Configurando variáveis de ambiente do backend..."
cp .env.production .env

# Instalar dependências do backend
echo "4. Instalando dependências do backend..."
npm install

# Compilar TypeScript
echo "5. Compilando backend TypeScript..."
npm run build

# Ir para o diretório do frontend
cd /home/dev_admin/re-reports

# Instalar dependências do frontend
echo "6. Instalando dependências do frontend..."
npm install

# Criar variáveis de ambiente do frontend
echo "7. Configurando variáveis de ambiente do frontend..."
cat > .env.production <<ENVFILE
VITE_API_URL=http://rereports.eastus.cloudapp.azure.com:3030
VITE_APP_NAME=RE-Reports
VITE_NODE_ENV=production
ENVFILE

# Build do frontend
echo "8. Compilando frontend..."
npm run build

# Configurar systemd para gerenciar o backend
echo "9. Configurando systemd service para o backend..."

sudo tee /etc/systemd/system/re-reports-backend.service <<'SYSTEMDCONF'
[Unit]
Description=RE-Reports Backend API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=dev_admin
WorkingDirectory=/home/dev_admin/re-reports/backend
Environment=NODE_ENV=production
Environment=PORT=3030
ExecStart=/usr/bin/node /home/dev_admin/re-reports/backend/dist/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=re-reports-backend

[Install]
WantedBy=multi-user.target
SYSTEMDCONF

# Recarregar systemd e iniciar o serviço
echo "10. Iniciando serviço do backend..."
sudo systemctl daemon-reload
sudo systemctl enable re-reports-backend
sudo systemctl start re-reports-backend
sudo systemctl status re-reports-backend --no-pager

# Instalar e configurar nginx para o frontend
echo "11. Instalando e configurando Nginx..."
sudo apt install -y nginx

# Criar configuração do Nginx
sudo tee /etc/nginx/sites-available/re-reports <<'NGINXCONF'
server {
    listen 80;
    server_name rereports.eastus.cloudapp.azure.com;

    # Frontend
    location / {
        root /home/dev_admin/re-reports/dist;
        try_files $uri $uri/ /index.html;
        
        # Headers de segurança
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }

    # Proxy para o backend
    location /api {
        proxy_pass http://localhost:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploads
    location /uploads {
        alias /home/dev_admin/re-reports/backend/uploads;
        
        # Apenas usuários autenticados via backend
        internal;
    }

    # Logs
    access_log /var/log/nginx/re-reports-access.log;
    error_log /var/log/nginx/re-reports-error.log;
}
NGINXCONF

# Ativar site
sudo ln -sf /etc/nginx/sites-available/re-reports /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Testar configuração do Nginx
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx

# Configurar firewall (ufw)
echo "12. Configurando firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3030/tcp
sudo ufw allow 5173/tcp
sudo ufw allow 8080/tcp
sudo ufw --force enable

echo "=== Deploy concluído! ==="
echo ""
echo "Serviços rodando:"
echo "- Frontend: http://rereports.eastus.cloudapp.azure.com"
echo "- Backend API: http://rereports.eastus.cloudapp.azure.com:3030"
echo "- Nginx: porta 80"
echo ""
echo "Comandos úteis:"
echo "- Ver logs do backend: sudo journalctl -u re-reports-backend -f"
echo "- Reiniciar backend: sudo systemctl restart re-reports-backend"
echo "- Ver status do backend: sudo systemctl status re-reports-backend"
echo "- Parar backend: sudo systemctl stop re-reports-backend"
echo "- Ver logs nginx: sudo tail -f /var/log/nginx/re-reports-error.log"
echo "- Reiniciar nginx: sudo systemctl restart nginx"
