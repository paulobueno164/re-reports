import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import * as authService from '../services/authService';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nome: z.string().min(2),
  role: z.enum(['FINANCEIRO', 'COLABORADOR', 'RH']).optional(),
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

router.post('/users', authenticateToken, requireRole('RH'), async (req: AuthenticatedRequest, res) => {
  try {
    const data = createUserSchema.parse(req.body);
    const result = await authService.createUser(data);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/users', authenticateToken, requireRole('RH'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await authService.getAllUsers();
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/users/:id', authenticateToken, requireRole('RH'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await authService.getUserById(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/users/:id/email', authenticateToken, requireRole('RH'), async (req: AuthenticatedRequest, res) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    await authService.updateUserEmail(req.params.id, email);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/users/:id/password', authenticateToken, requireRole('RH'), async (req: AuthenticatedRequest, res) => {
  try {
    const { password } = z.object({ password: z.string().min(6) }).parse(req.body);
    await authService.updateUserPassword(req.params.id, password);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/users/:id', authenticateToken, requireRole('RH'), async (req: AuthenticatedRequest, res) => {
  try {
    await authService.deleteUser(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  res.json(req.user);
});

router.post('/users/:id/roles', authenticateToken, requireRole('RH'), async (req: AuthenticatedRequest, res) => {
  try {
    const { role } = z.object({ role: z.enum(['FINANCEIRO', 'COLABORADOR', 'RH']) }).parse(req.body);
    await authService.addUserRole(req.params.id, role);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/users/:id/roles/:role', authenticateToken, requireRole('RH'), async (req: AuthenticatedRequest, res) => {
  try {
    await authService.removeUserRole(req.params.id, req.params.role as any);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Recuperação de senha
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    await authService.requestPasswordReset(email);
    res.json({ success: true, message: 'Se o email existir, instruções serão enviadas' });
  } catch (error: any) {
    // Sempre retorna sucesso para não revelar se email existe
    res.json({ success: true, message: 'Se o email existir, instruções serão enviadas' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = z.object({
      token: z.string(),
      password: z.string().min(6),
    }).parse(req.body);
    await authService.resetPassword(token, password);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
