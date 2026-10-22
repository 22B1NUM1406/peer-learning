import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import * as c from './moderation.controller.js';

// Оюутан: /api/reports
export const reportRoutes = Router();
reportRoutes.get('/reports/reasons', c.reasons);
reportRoutes.post('/reports', c.report);

// Админ: /api/admin/... (P10)
export const adminModerationRoutes = Router();
adminModerationRoutes.use(requireAdmin);
adminModerationRoutes.get('/reports', c.listReports);
adminModerationRoutes.patch('/reports/:id', c.resolve);
adminModerationRoutes.get('/users', c.listUsers);
adminModerationRoutes.patch('/users/:id/status', c.setUserStatus);
