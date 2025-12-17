import { Router } from 'express';
import * as colaboradorService from '../services/colaboradorService';
import * as lancamentoService from '../services/lancamentoService';
import * as tipoDespesaService from '../services/tipoDespesaService';
import * as periodoService from '../services/periodoService';
import * as fechamentoService from '../services/fechamentoService';
import * as dashboardService from '../services/dashboardService';
import * as exportService from '../services/exportService';
import * as auditService from '../services/auditService';
import { authenticateToken, AuthenticatedRequest, requireRole, hasRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Colaboradores
router.get('/colaboradores', requireRole('RH', 'FINANCEIRO'), async (req, res) => {
  const result = await colaboradorService.getAllColaboradores(req.query as any);
  res.json(result);
});
router.get('/colaboradores/:id', async (req: AuthenticatedRequest, res) => {
  const result = await colaboradorService.getColaboradorById(req.params.id);
  res.json(result);
});
router.post('/colaboradores', requireRole('RH'), async (req: AuthenticatedRequest, res) => {
  const result = await colaboradorService.createColaborador(req.body);
  res.status(201).json(result);
});
router.put('/colaboradores/:id', requireRole('RH'), async (req, res) => {
  const result = await colaboradorService.updateColaborador(req.params.id, req.body);
  res.json(result);
});
router.delete('/colaboradores/:id', requireRole('RH'), async (req, res) => {
  await colaboradorService.deleteColaborador(req.params.id);
  res.json({ success: true });
});

// Períodos
router.get('/periodos', async (req, res) => {
  const result = await periodoService.getAllPeriodos(req.query as any);
  res.json(result);
});
router.get('/periodos/current', async (req, res) => {
  const result = await periodoService.getCurrentPeriodo();
  res.json(result);
});
router.post('/periodos', requireRole('RH'), async (req, res) => {
  const result = await periodoService.createPeriodo(req.body);
  res.status(201).json(result);
});
router.put('/periodos/:id', requireRole('RH'), async (req, res) => {
  const result = await periodoService.updatePeriodo(req.params.id, req.body);
  res.json(result);
});

// Tipos de Despesas
router.get('/tipos-despesas', async (req, res) => {
  const result = await tipoDespesaService.getAllTiposDespesas(req.query as any);
  res.json(result);
});
router.post('/tipos-despesas', requireRole('RH'), async (req, res) => {
  const result = await tipoDespesaService.createTipoDespesa(req.body);
  res.status(201).json(result);
});
router.put('/tipos-despesas/:id', requireRole('RH'), async (req, res) => {
  const result = await tipoDespesaService.updateTipoDespesa(req.params.id, req.body);
  res.json(result);
});

// Lançamentos
router.get('/lancamentos', async (req: AuthenticatedRequest, res) => {
  const filters: any = { ...req.query };
  if (!hasRole(req.user, 'RH') && !hasRole(req.user, 'FINANCEIRO')) {
    const colab = await colaboradorService.getColaboradorByUserId(req.user!.id);
    if (colab) filters.colaborador_id = colab.id;
  }
  const result = await lancamentoService.getAllLancamentos(filters);
  res.json(result);
});
router.get('/lancamentos/:id', async (req, res) => {
  const result = await lancamentoService.getLancamentoById(req.params.id);
  res.json(result);
});
router.post('/lancamentos', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await lancamentoService.createLancamento(req.body, req.user!.id, req.user!.nome);
    res.status(201).json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.put('/lancamentos/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await lancamentoService.updateLancamento(req.params.id, req.body, req.user!.id, req.user!.nome);
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.delete('/lancamentos/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await lancamentoService.deleteLancamento(req.params.id, req.user!.id, req.user!.nome);
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.post('/lancamentos/:id/aprovar', requireRole('RH', 'FINANCEIRO'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await lancamentoService.aprovarLancamento(req.params.id, req.user!.id, req.user!.nome);
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.post('/lancamentos/:id/rejeitar', requireRole('RH', 'FINANCEIRO'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await lancamentoService.rejeitarLancamento(req.params.id, req.body.motivo, req.user!.id, req.user!.nome);
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.post('/lancamentos/aprovar-lote', requireRole('RH', 'FINANCEIRO'), async (req: AuthenticatedRequest, res) => {
  const result = await lancamentoService.aprovarEmLote(req.body.ids, req.user!.id, req.user!.nome);
  res.json(result);
});
router.post('/lancamentos/rejeitar-lote', requireRole('RH', 'FINANCEIRO'), async (req: AuthenticatedRequest, res) => {
  const result = await lancamentoService.rejeitarEmLote(req.body.ids, req.body.motivo, req.user!.id, req.user!.nome);
  res.json(result);
});

// Fechamentos
router.get('/fechamentos', requireRole('RH', 'FINANCEIRO'), async (req, res) => {
  const result = await fechamentoService.getFechamentos(req.query.periodo_id as string);
  res.json(result);
});
router.post('/fechamentos', requireRole('RH'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await fechamentoService.processarFechamento(req.body.periodo_id, req.user!.id);
    res.status(201).json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.get('/fechamentos/:periodoId/resumo', requireRole('RH', 'FINANCEIRO'), async (req, res) => {
  const result = await fechamentoService.getResumoFechamento(req.params.periodoId);
  res.json(result);
});

// Dashboard
router.get('/dashboard/rh', requireRole('RH'), async (req, res) => {
  const result = await dashboardService.getDashboardMetrics(req.query.periodo_id as string, req.query.departamento as string);
  res.json(result);
});
router.get('/dashboard/financeiro', requireRole('FINANCEIRO'), async (req, res) => {
  const result = await dashboardService.getFinanceiroDashboardMetrics(req.query.periodo_id as string);
  res.json(result);
});
router.get('/dashboard/colaborador', async (req: AuthenticatedRequest, res) => {
  const colab = await colaboradorService.getColaboradorByUserId(req.user!.id);
  if (!colab) return res.status(404).json({ error: 'Colaborador não encontrado' });
  const result = await dashboardService.getColaboradorDashboardMetrics(colab.id, req.query.periodo_id as string);
  res.json(result);
});

// Exportações
router.get('/exportacoes', requireRole('FINANCEIRO'), async (req, res) => {
  const result = await exportService.getExportacoes(req.query.periodo_id as string);
  res.json(result);
});
router.get('/exportacoes/data/:periodoId', requireRole('FINANCEIRO'), async (req, res) => {
  const result = await exportService.getExportData(req.params.periodoId);
  res.json(result);
});
router.post('/exportacoes', requireRole('FINANCEIRO'), async (req: AuthenticatedRequest, res) => {
  const result = await exportService.createExportacao(req.body.periodo_id, req.user!.id, req.body.nome_arquivo, req.body.qtd_registros, req.body.fechamento_id);
  res.status(201).json(result);
});

// Audit Logs
router.get('/audit-logs', requireRole('RH', 'FINANCEIRO'), async (req, res) => {
  const result = await auditService.getAuditLogs(req.query as any);
  res.json(result);
});

export default router;
