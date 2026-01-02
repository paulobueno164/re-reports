import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database';
import { generateToken } from '../middleware/auth';
import { Profile, AppRole } from '../types';

const SALT_ROUNDS = 10;

export interface LoginResult {
  user: {
    id: string;
    email: string;
    nome: string;
    roles: AppRole[];
  };
  token: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  nome: string;
  role?: AppRole;
}

export const login = async (email: string, password: string): Promise<LoginResult> => {
  // Buscar usuário pelo email
  const userResult = await query(
    'SELECT id, email, password_hash FROM auth.users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (userResult.rows.length === 0) {
    throw new Error('Credenciais inválidas');
  }

  const user = userResult.rows[0];

  // Verificar senha
  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    throw new Error('Credenciais inválidas');
  }

  // Buscar perfil
  const profileResult = await query(
    'SELECT id, nome, email FROM profiles WHERE id = $1',
    [user.id]
  );

  if (profileResult.rows.length === 0) {
    throw new Error('Perfil não encontrado');
  }

  const profile = profileResult.rows[0];

  // Buscar roles
  const rolesResult = await query(
    'SELECT role FROM user_roles WHERE user_id = $1',
    [user.id]
  );

  const roles = rolesResult.rows.map((r) => r.role as AppRole);

  // Gerar token
  const token = generateToken(user.id, user.email);

  return {
    user: {
      id: profile.id,
      email: profile.email,
      nome: profile.nome,
      roles,
    },
    token,
  };
};

export const createUser = async (input: CreateUserInput): Promise<{ id: string; email: string }> => {
  const { email, password, nome, role = 'COLABORADOR' } = input;

  // Verificar se email já existe
  const existingUser = await query(
    'SELECT id FROM auth.users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (existingUser.rows.length > 0) {
    throw new Error('Email já cadastrado');
  }

  // Hash da senha
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const userId = uuidv4();

  await transaction(async (client) => {
    // Criar usuário na tabela auth.users
    await client.query(
      `INSERT INTO auth.users (id, email, password_hash, raw_user_meta_data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [userId, email.toLowerCase(), passwordHash, JSON.stringify({ nome })]
    );

    // Criar perfil (o trigger handle_new_user faria isso automaticamente no Supabase)
    await client.query(
      `INSERT INTO profiles (id, nome, email, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [userId, nome, email.toLowerCase()]
    );

    // Adicionar role
    await client.query(
      `INSERT INTO user_roles (id, user_id, role, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [uuidv4(), userId, role]
    );
  });

  return { id: userId, email: email.toLowerCase() };
};

export const updateUserEmail = async (userId: string, newEmail: string): Promise<void> => {
  await transaction(async (client) => {
    // Verificar se novo email já existe
    const existing = await client.query(
      'SELECT id FROM auth.users WHERE email = $1 AND id != $2',
      [newEmail.toLowerCase(), userId]
    );

    if (existing.rows.length > 0) {
      throw new Error('Email já está em uso');
    }

    // Atualizar email em auth.users
    await client.query(
      'UPDATE auth.users SET email = $1, updated_at = NOW() WHERE id = $2',
      [newEmail.toLowerCase(), userId]
    );

    // Atualizar email no perfil
    await client.query(
      'UPDATE profiles SET email = $1, updated_at = NOW() WHERE id = $2',
      [newEmail.toLowerCase(), userId]
    );
  });
};

export const updateUserPassword = async (userId: string, newPassword: string): Promise<void> => {
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await query(
    'UPDATE auth.users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [passwordHash, userId]
  );
};

export const deleteUser = async (userId: string): Promise<void> => {
  // CASCADE vai deletar profiles e user_roles automaticamente
  await query('DELETE FROM auth.users WHERE id = $1', [userId]);
};

export const getUserById = async (userId: string): Promise<Profile | null> => {
  const result = await query(
    'SELECT id, nome, email, avatar_url, created_at, updated_at FROM profiles WHERE id = $1',
    [userId]
  );

  return result.rows[0] || null;
};

export const getUserRoles = async (userId: string): Promise<AppRole[]> => {
  const result = await query(
    'SELECT role FROM user_roles WHERE user_id = $1',
    [userId]
  );

  return result.rows.map((r) => r.role);
};

export const addUserRole = async (userId: string, role: AppRole): Promise<void> => {
  await query(
    `INSERT INTO user_roles (id, user_id, role, created_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, role) DO NOTHING`,
    [uuidv4(), userId, role]
  );
};

export const removeUserRole = async (userId: string, role: AppRole): Promise<void> => {
  await query(
    'DELETE FROM user_roles WHERE user_id = $1 AND role = $2',
    [userId, role]
  );
};

// Listar todos usuários com profiles e roles
export interface UserWithRoles {
  id: string;
  email: string;
  nome: string;
  avatar_url: string | null;
  roles: AppRole[];
  created_at: string;
}

export const getAllUsers = async (): Promise<UserWithRoles[]> => {
  const result = await query(
    `SELECT p.id, p.email, p.nome, p.avatar_url, p.created_at,
            COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') as roles
     FROM profiles p
     LEFT JOIN user_roles ur ON ur.user_id = p.id
     GROUP BY p.id, p.email, p.nome, p.avatar_url, p.created_at
     ORDER BY p.nome`
  );
  return result.rows;
};

// Trocar senha do próprio usuário (valida senha atual)
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  // Buscar hash da senha atual
  const userResult = await query(
    'SELECT password_hash FROM auth.users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('Usuário não encontrado');
  }

  // Verificar senha atual
  const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
  if (!isValidPassword) {
    throw new Error('Senha atual incorreta');
  }

  // Atualizar para nova senha
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await query(
    'UPDATE auth.users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [passwordHash, userId]
  );
};

// Solicitar reset de senha
export const requestPasswordReset = async (email: string): Promise<void> => {
  const userResult = await query(
    'SELECT id FROM auth.users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (userResult.rows.length === 0) {
    // Não revelar se email existe
    return;
  }

  const userId = userResult.rows[0].id;
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  // Salvar token (usando raw_user_meta_data para simplificar)
  await query(
    `UPDATE auth.users 
     SET raw_user_meta_data = jsonb_set(
       COALESCE(raw_user_meta_data, '{}'::jsonb),
       '{reset_token}',
       $1::jsonb
     )
     WHERE id = $2`,
    [JSON.stringify({ token, expires_at: expiresAt.toISOString() }), userId]
  );

  // TODO: Enviar email com link de reset
  console.log(`Password reset token for ${email}: ${token}`);
};

// Resetar senha com token
export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  // Buscar usuário com este token
  const result = await query(
    `SELECT id, raw_user_meta_data FROM auth.users 
     WHERE raw_user_meta_data->'reset_token'->>'token' = $1`,
    [token]
  );

  if (result.rows.length === 0) {
    throw new Error('Token inválido ou expirado');
  }

  const user = result.rows[0];
  const resetData = user.raw_user_meta_data?.reset_token;

  if (!resetData || new Date(resetData.expires_at) < new Date()) {
    throw new Error('Token inválido ou expirado');
  }

  // Atualizar senha e limpar token
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await query(
    `UPDATE auth.users 
     SET password_hash = $1, 
         raw_user_meta_data = raw_user_meta_data - 'reset_token',
         updated_at = NOW() 
     WHERE id = $2`,
    [passwordHash, user.id]
  );
};
