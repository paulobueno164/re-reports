# RE-Reports Backend

Backend API completo para o sistema RE-Reports.

## Instalação

```bash
cd backend
npm install
```

## Configuração

1. Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

2. Configure as variáveis de ambiente no `.env`

3. Crie o banco de dados usando o arquivo `banco.sql` na raiz do projeto:
```bash
psql -U postgres -c "CREATE DATABASE re_reports;"
psql -U postgres -d re_reports -f ../banco.sql
```

## Execução

**Desenvolvimento:**
```bash
npm run dev
```

**Produção:**
```bash
npm run build
npm start
```

## Endpoints

### Autenticação
- `POST /auth/login` - Login
- `GET /auth/me` - Usuário atual
- `POST /auth/users` - Criar usuário (RH)
- `PUT /auth/users/:id/email` - Atualizar email (RH)
- `PUT /auth/users/:id/password` - Atualizar senha (RH)
- `DELETE /auth/users/:id` - Deletar usuário (RH)

### API (requer autenticação)
- `GET/POST /api/colaboradores`
- `GET/POST /api/periodos`
- `GET/POST /api/tipos-despesas`
- `GET/POST /api/lancamentos`
- `POST /api/lancamentos/:id/aprovar`
- `POST /api/lancamentos/:id/rejeitar`
- `POST /api/lancamentos/aprovar-lote`
- `GET/POST /api/fechamentos`
- `GET /api/dashboard/rh|financeiro|colaborador`
- `GET /api/exportacoes`
- `GET /api/audit-logs`

### CRON (requer CRON_SECRET)
- `POST /cron/check-pending-expenses`
- `POST /cron/send-email`
