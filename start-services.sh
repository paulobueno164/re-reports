#!/bin/bash

echo "================================"
echo "Iniciando serviços RE-Reports"
echo "================================"

# Função para matar processos nas portas
kill_port() {
    PORT=$1
    PID=$(lsof -ti:$PORT)
    if [ ! -z "$PID" ]; then
        echo "Matando processo na porta $PORT (PID: $PID)"
        kill -9 $PID
    fi
}

# Limpar portas
echo "Limpando portas..."
kill_port 3030
kill_port 5173

# Iniciar backend em background
echo "Iniciando backend na porta 3030..."
cd ~/re-reports/backend
nohup npm start > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend iniciado (PID: $BACKEND_PID)"

# Aguardar backend iniciar
sleep 3

# Iniciar frontend em background
echo "Iniciando frontend na porta 5173..."
cd ~/re-reports
nohup npm run preview -- --host --port 5173 > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend iniciado (PID: $FRONTEND_PID)"

echo "================================"
echo "Serviços iniciados!"
echo "================================"
echo "Backend:  http://rereports.eastus.cloudapp.azure.com:3030 (PID: $BACKEND_PID)"
echo "Frontend: http://rereports.eastus.cloudapp.azure.com:5173 (PID: $FRONTEND_PID)"
echo ""
echo "Logs:"
echo "Backend:  ~/re-reports/backend/backend.log"
echo "Frontend: ~/re-reports/frontend.log"
echo "================================"
