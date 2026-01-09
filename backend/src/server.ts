import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth';
import apiRoutes from './routes/api';
import cronRoutes from './routes/cron';
import attachmentsRoutes from './routes/attachments';
import { initializeStorage } from './config/storage';

const app = express();
const PORT = process.env.PORT || 3030;

// Inicializar diretórios de storage
initializeStorage();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api', attachmentsRoutes); // Rotas de anexos
app.use('/cron', cronRoutes);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 RE-Reports Backend running on http://localhost:${PORT}`);
  console.log(`📁 Storage path: ${process.env.STORAGE_PATH || './uploads'}`);
});

export default app;
