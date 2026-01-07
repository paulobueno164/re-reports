#!/bin/bash

echo "=== Configurando PostgreSQL ==="

# Criar usuário e banco de dados
sudo -u postgres psql <<EOF
-- Criar banco de dados
CREATE DATABASE re_reports;

-- Conectar ao banco
\c re_reports

-- O schema será criado quando importarmos o backup
EOF

echo "=== Banco de dados criado ==="
echo "Agora vamos importar os dados..."
