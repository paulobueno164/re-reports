import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateToken, AuthenticatedRequest, requireRole, hasRole } from '../middleware/auth';
import * as anexoService from '../services/anexoService';
import * as storageService from '../services/storageService';
import * as lancamentoService from '../services/lancamentoService';
import * as colaboradorService from '../services/colaboradorService';

const router = Router();

// Configurar multer para armazenamento em memória (processamos depois)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  },
});

router.use(authenticateToken);

// Listar anexos de um lançamento
router.get('/lancamentos/:lancamentoId/anexos', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lancamentoId } = req.params;

    // Verificar se o usuário tem acesso ao lançamento
    const lancamento = await lancamentoService.getLancamentoById(lancamentoId);
    if (!lancamento) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }

    // Se não for RH/FINANCEIRO, verificar se é o próprio colaborador
    if (!hasRole(req.user, 'RH') && !hasRole(req.user, 'FINANCEIRO')) {
      const colab = await colaboradorService.getColaboradorByUserId(req.user!.id);
      if (!colab || colab.id !== lancamento.colaborador_id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }

    const anexos = await anexoService.getAnexosByLancamentoId(lancamentoId);
    res.json(anexos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload de anexo
router.post(
  '/lancamentos/:lancamentoId/anexos',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { lancamentoId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      // Verificar se o lançamento existe e o usuário tem acesso
      const lancamento = await lancamentoService.getLancamentoById(lancamentoId);
      if (!lancamento) {
        return res.status(404).json({ error: 'Lançamento não encontrado' });
      }

      // Verificar permissão
      if (!hasRole(req.user, 'RH') && !hasRole(req.user, 'FINANCEIRO')) {
        const colab = await colaboradorService.getColaboradorByUserId(req.user!.id);
        if (!colab || colab.id !== lancamento.colaborador_id) {
          return res.status(403).json({ error: 'Acesso negado' });
        }

        // Colaborador só pode adicionar anexos em lançamentos com status 'enviado'
        if (lancamento.status !== 'enviado') {
          return res.status(400).json({ error: 'Não é possível adicionar anexos a este lançamento' });
        }
      }

      // Fazer upload do arquivo
      const uploadResult = await storageService.uploadFile(
        'comprovantes',
        {
          buffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
        },
        lancamento.colaborador_id
      );

      // Criar registro do anexo no banco
      const anexo = await anexoService.createAnexo({
        lancamento_id: lancamentoId,
        nome_arquivo: uploadResult.originalName,
        tipo_arquivo: uploadResult.mimeType,
        storage_path: uploadResult.storagePath,
        tamanho: uploadResult.size,
      });

      res.status(201).json(anexo);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Upload múltiplo de anexos
router.post(
  '/lancamentos/:lancamentoId/anexos/batch',
  upload.array('files', 10),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { lancamentoId } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      // Verificar se o lançamento existe e o usuário tem acesso
      const lancamento = await lancamentoService.getLancamentoById(lancamentoId);
      if (!lancamento) {
        return res.status(404).json({ error: 'Lançamento não encontrado' });
      }

      // Verificar permissão
      if (!hasRole(req.user, 'RH') && !hasRole(req.user, 'FINANCEIRO')) {
        const colab = await colaboradorService.getColaboradorByUserId(req.user!.id);
        if (!colab || colab.id !== lancamento.colaborador_id) {
          return res.status(403).json({ error: 'Acesso negado' });
        }

        if (lancamento.status !== 'enviado') {
          return res.status(400).json({ error: 'Não é possível adicionar anexos a este lançamento' });
        }
      }

      const results: any[] = [];
      const errors: any[] = [];

      for (const file of files) {
        try {
          const uploadResult = await storageService.uploadFile(
            'comprovantes',
            {
              buffer: file.buffer,
              originalName: file.originalname,
              mimeType: file.mimetype,
            },
            lancamento.colaborador_id
          );

          const anexo = await anexoService.createAnexo({
            lancamento_id: lancamentoId,
            nome_arquivo: uploadResult.originalName,
            tipo_arquivo: uploadResult.mimeType,
            storage_path: uploadResult.storagePath,
            tamanho: uploadResult.size,
          });

          results.push(anexo);
        } catch (error: any) {
          errors.push({
            fileName: file.originalname,
            error: error.message,
          });
        }
      }

      res.status(201).json({ uploaded: results, errors });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Download de anexo
router.get('/anexos/:id/download', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const anexo = await anexoService.getAnexoById(id);
    if (!anexo) {
      return res.status(404).json({ error: 'Anexo não encontrado' });
    }

    // Verificar permissão
    const lancamento = await lancamentoService.getLancamentoById(anexo.lancamento_id);
    if (!lancamento) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }

    if (!hasRole(req.user, 'RH') && !hasRole(req.user, 'FINANCEIRO')) {
      const colab = await colaboradorService.getColaboradorByUserId(req.user!.id);
      if (!colab || colab.id !== lancamento.colaborador_id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }

    // Buscar arquivo do storage
    const fileBuffer = storageService.downloadFile('comprovantes', anexo.storage_path);
    if (!fileBuffer) {
      return res.status(404).json({ error: 'Arquivo não encontrado no storage' });
    }

    res.setHeader('Content-Type', anexo.tipo_arquivo);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(anexo.nome_arquivo)}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.send(fileBuffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Visualizar anexo (inline)
router.get('/anexos/:id/view', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const anexo = await anexoService.getAnexoById(id);
    if (!anexo) {
      return res.status(404).json({ error: 'Anexo não encontrado' });
    }

    // Verificar permissão
    const lancamento = await lancamentoService.getLancamentoById(anexo.lancamento_id);
    if (!lancamento) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }

    if (!hasRole(req.user, 'RH') && !hasRole(req.user, 'FINANCEIRO')) {
      const colab = await colaboradorService.getColaboradorByUserId(req.user!.id);
      if (!colab || colab.id !== lancamento.colaborador_id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }

    // Buscar arquivo do storage
    const fileBuffer = storageService.downloadFile('comprovantes', anexo.storage_path);
    if (!fileBuffer) {
      return res.status(404).json({ error: 'Arquivo não encontrado no storage' });
    }

    res.setHeader('Content-Type', anexo.tipo_arquivo);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(anexo.nome_arquivo)}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.send(fileBuffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar anexo
router.delete('/anexos/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const anexo = await anexoService.getAnexoById(id);
    if (!anexo) {
      return res.status(404).json({ error: 'Anexo não encontrado' });
    }

    // Verificar permissão
    const lancamento = await lancamentoService.getLancamentoById(anexo.lancamento_id);
    if (!lancamento) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }

    if (!hasRole(req.user, 'RH') && !hasRole(req.user, 'FINANCEIRO')) {
      const colab = await colaboradorService.getColaboradorByUserId(req.user!.id);
      if (!colab || colab.id !== lancamento.colaborador_id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      // Colaborador só pode deletar anexos em lançamentos com status 'enviado'
      if (lancamento.status !== 'enviado') {
        return res.status(400).json({ error: 'Não é possível remover anexos deste lançamento' });
      }
    }

    // Remover arquivo do storage
    storageService.removeFile('comprovantes', anexo.storage_path);

    // Remover registro do banco
    await anexoService.deleteAnexo(id);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
