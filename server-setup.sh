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

echo "=== Configuração inicial concluída ==="
