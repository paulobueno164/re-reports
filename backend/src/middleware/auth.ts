import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { AuthUser, AppRole } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Token de autenticação não fornecido' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };

    // Buscar perfil do usuário
    const profileResult = await query(
      'SELECT id, nome, email FROM profiles WHERE id = $1',
      [decoded.userId]
    );

    if (profileResult.rows.length === 0) {
      res.status(401).json({ error: 'Usuário não encontrado' });
      return;
    }

    // Buscar roles do usuário
    const rolesResult = await query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [decoded.userId]
    );

    const roles = rolesResult.rows.map((r) => r.role as AppRole);

    req.user = {
      id: profileResult.rows[0].id,
      email: profileResult.rows[0].email,
      nome: profileResult.rows[0].nome,
      roles,
    };

    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(403).json({ error: 'Token inválido ou expirado' });
  }
};

export const requireRole = (...allowedRoles: AppRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      res.status(403).json({ error: 'Acesso negado. Permissão insuficiente.' });
      return;
    }

    next();
  };
};

export const hasRole = (user: AuthUser | undefined, role: AppRole): boolean => {
  return user?.roles.includes(role) ?? false;
};

export const generateToken = (userId: string, email: string): string => {
  const options: jwt.SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  };
  return jwt.sign({ userId, email }, JWT_SECRET, options);
};
