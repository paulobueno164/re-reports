#!/bin/bash

echo "=== Iniciando configuração do servidor RE-Reports ==="

# Atualizar sistema
echo "1. Atualizando sistema..."
sudo apt update && sudo apt upgrade -y

# Instalar Node.js e npm
echo "2. Instalando Node.js e npm..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalação
node --version
npm --version

# Instalar PostgreSQL
echo "3. Instalando PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Iniciar PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Instalar Git (se necessário)
echo "4. Verificando Git..."
sudo apt install -y git

# Clonar repositório
echo "5. Clonando repositório..."
cd /home/dev_admin
if [ -d "re-reports" ]; then
    echo "Diretório já existe, removendo..."
    rm -rf re-reports
fi

git clone -b servidor https://github.com/paulobueno164/re-reports.git
cd re-reports

# Instalar PM2 globalmente para gerenciar processos
echo "6. Instalando PM2..."
sudo npm install -g pm2

echo "=== Configuração inicial concluída ==="
