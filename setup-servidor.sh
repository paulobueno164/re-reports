#!/bin/bash

echo "================================"
echo "Configurando RE-Reports no Servidor"
echo "================================"

# 1. Atualizar repositório
echo "1. Atualizando código do repositório..."
git pull origin servidor

# 2. Copiar arquivos .env
echo "2. Configurando arquivos de ambiente..."
cp .env.production .env
cp backend/.env.production backend/.env

# 3. Criar banco de dados PostgreSQL
echo "3. Configurando banco de dados PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE re_reports;" 2>/dev/null || echo "Banco já existe"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'ee1631';"

# 4. Executar script SQL
echo "4. Executando script de criação do banco..."
PGPASSWORD=ee1631 psql -U postgres -d re_reports -f banco.sql

# 5. Instalar dependências do backend
echo "5. Instalando dependências do backend..."
cd backend
npm install

# 6. Voltar para raiz e instalar dependências do frontend
echo "6. Instalando dependências do frontend..."
cd ..
npm install

# 7. Build do frontend
echo "7. Compilando frontend..."
npm run build

echo "================================"
echo "Configuração concluída!"
echo "================================"
echo ""
echo "Para iniciar os serviços:"
echo "Backend:  cd backend && npm start"
echo "Frontend: npm run preview --host --port 5173"
echo "================================"
