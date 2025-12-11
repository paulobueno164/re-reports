# RE-Reports - Sistema de Remuneração Estratégica

## TODO - Desenvolvimento

### FASE 1: Infraestrutura Base ✅
- [x] Design System (cores, tipografia, componentes)
- [x] Layout principal com navegação
- [x] Estrutura de rotas
- [x] Componentes base customizados

### FASE 2: Cadastros e Parametrizações (Req 1)
- [ ] 1.1 Cadastro de Colaboradores Elegíveis
  - [ ] CRUD completo
  - [ ] Parametrização individual de valores
  - [ ] Tela de simulação com PDF/Download
- [ ] 1.2 Cadastro de Tipos de Despesas
  - [ ] CRUD com classificação Fixo/Variável
  - [ ] Grupos de despesas
  - [ ] Origem permitida (Próprio/Cônjuge/Filhos)
- [ ] 1.3 Calendário de Períodos
  - [ ] Definição de janelas de lançamento
  - [ ] Validação de sobreposição
- [ ] 1.4 Vínculo Tipo Despesa × Evento Folha
  - [ ] Tabela relacional
  - [ ] Códigos de eventos

### FASE 3: Dados Mensais (Req 2)
- [ ] 2.1 Interface Web para lançamentos
- [ ] 2.2 Fluxo de inclusão/envio mensal
  - [ ] Controle de status (Rascunho, Enviado, Em Análise, Válido, Inválido)
  - [ ] Validação de período
- [ ] 2.3 Campos obrigatórios por comprovante
  - [ ] Mês referência
  - [ ] Tipo de despesa (filtrado)
  - [ ] Origem da despesa
  - [ ] Valor
  - [ ] Descrição do fato gerador
  - [ ] Anexo (formatos: xlsx, doc, docx, pdf, png, jpeg, jpg)
- [ ] 2.4 Validações avançadas
  - [ ] Limite da Cesta de Benefícios
  - [ ] Último lançamento que ultrapassa (valor_considerado / valor_nao_considerado)
  - [ ] Conversão automática diferença → PI/DA

### FASE 4: Fechamento (Req 3)
- [ ] 3.1 Processamento de fechamento
  - [ ] Consolidação por colaborador
  - [ ] Mapeamento para eventos de folha
  - [ ] Log de processamento
- [ ] 3.2 Exportação Excel
  - [ ] Layout padrão para folha de pagamentos
  - [ ] Nomenclatura padronizada
  - [ ] Log de exportação

### FASE 5: Relatórios (Req 4)
- [ ] 4.1 Extrato da Remuneração Estratégica
  - [ ] Resumo geral
  - [ ] Detalhamento por grupo
  - [ ] Análise de utilização
  - [ ] Lista de comprovantes
  - [ ] Exportação PDF/Excel
- [ ] 4.2 Relatórios em lote (Financeiro)
  - [ ] Seleção múltipla
  - [ ] Geração ZIP

### FASE 6: Controle de Acesso
- [ ] Perfil FINANCEIRO
- [ ] Perfil COLABORADOR
- [ ] Perfil RH
- [ ] Permissões por funcionalidade

### FASE 7: Mobile (Capacitor)
- [ ] Configuração Capacitor
- [ ] Adaptação responsiva
- [ ] Build iOS/Android

---

## Regras de Negócio Críticas

### Unicidade de Comprovantes
- Cada documento só pode ser lançado UMA vez
- Sistema deve impedir duplicação

### Período de Lançamento
- Lançamentos permitidos: dias 11-20 do mês
- Antes do dia 11: bloqueado
- Após dia 20: vai para próximo mês automaticamente
- Não pode lançar para 2 meses à frente

### Limite Cesta de Benefícios
- Ao atingir limite: bloquear novos lançamentos
- EXCEÇÃO último lançamento:
  - valor_considerado = limite - total_usado
  - valor_nao_considerado = valor_lancamento - valor_considerado
  - Após aceitar: bloquear completamente

### Conversão PI/DA
- Se usado < limite da Cesta
- Diferença = Limite - Total Usado
- Diferença → adiciona ao PI/DA (tributável)

---

## Estrutura de Dados (Principais Entidades)

### colaboradores_elegiveis
- id, matricula, nome, email, departamento
- salario_base, vale_alimentacao, vale_refeicao
- ajuda_custo, mobilidade, transporte
- cesta_beneficios_teto, pida_teto, tem_pida
- ativo, created_at, updated_at

### tipos_despesas
- id, nome, classificacao (fixo/variavel)
- valor_padrao_teto, grupo
- origem_permitida (array: proprio, conjuge, filhos)
- ativo, created_at

### calendario_periodos
- id, periodo (MM/YYYY)
- data_inicio, data_final
- abre_lancamento, fecha_lancamento
- status (aberto, fechado)

### tipos_despesas_eventos
- id, tipo_despesa_id, codigo_evento
- descricao_evento

### lancamentos
- id, colaborador_id, periodo_id
- tipo_despesa_id, origem
- valor_lancado, valor_considerado, valor_nao_considerado
- descricao_fato_gerador
- status (rascunho, enviado, em_analise, valido, invalido)
- motivo_invalidacao
- created_at, updated_at

### anexos
- id, lancamento_id
- nome_arquivo, tipo_arquivo, tamanho
- storage_path, created_at

### fechamentos
- id, periodo_id
- data_processamento, usuario_id
- total_colaboradores, total_eventos
- status (sucesso, erro), detalhes_erro

### exportacoes
- id, periodo_id, fechamento_id
- data_exportacao, usuario_id
- nome_arquivo, qtd_registros
