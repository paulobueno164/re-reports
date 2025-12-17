import { Router } from 'express';
import { validateCronSecret } from '../middleware/cronAuth';
import * as notificationService from '../services/notificationService';
import { sendEmail } from '../config/email';
import { z } from 'zod';

const router = Router();

// Check pending expenses (CRON)
router.post('/check-pending-expenses', validateCronSecret, async (req, res) => {
  try {
    const result = await notificationService.sendPendingExpensesAlert();
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error checking pending expenses:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send email
const emailSchema = z.object({
  to: z.string().email().max(255),
  subject: z.string().min(1).max(200),
  html: z.string().min(1).max(100000),
});

router.post('/send-email', validateCronSecret, async (req, res) => {
  try {
    const data = emailSchema.parse(req.body);
    await sendEmail(data);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
