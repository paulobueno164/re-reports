#!/bin/bash
# Script para execução remota no servidor

# Conectar ao servidor e executar comandos
sshpass -p 'Ost@AZ-0126' ssh -o StrictHostKeyChecking=no dev_admin@rereports.eastus.cloudapp.azure.com << 'ENDSSH'

echo "=== Iniciando configuração do servidor RE-Reports ==="

# Atualizar sistema
echo "1. Atualizando sistema..."
sudo apt update -y

# Instalar Node.js 20.x
echo "2. Instalando Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

node --version
npm --version

# Instalar PostgreSQL
echo "3. Instalando PostgreSQL..."
if ! command -v psql &> /dev/null; then
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
fi

# Instalar Git
echo "4. Verificando Git..."
sudo apt install -y git

# Instalar PM2
echo "5. Instalando PM2..."
sudo npm install -g pm2

# Clonar repositório
echo "6. Clonando repositório..."
cd /home/dev_admin
if [ -d "re-reports" ]; then
    echo "Removendo diretório existente..."
    rm -rf re-reports
fi

git clone -b servidor https://github.com/paulobueno164/re-reports.git
cd re-reports

# Tornar scripts executáveis
chmod +x *.sh

echo "=== Setup inicial concluído! ==="
echo "Execute agora: ./deploy-servidor.sh"

ENDSSH
