import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import * as c from './subjects.controller.js';

// /api/subjects — нэвтэрсэн бүх хэрэглэгч
export const subjectRoutes = Router();
subjectRoutes.get('/', requireAuth, c.list);
subjectRoutes.get('/:id', requireAuth, c.get);

// /api/admin/subjects — зөвхөн админ (FR-17, P11)
export const adminSubjectRoutes = Router();
adminSubjectRoutes.use(requireAdmin);
adminSubjectRoutes.get('/', c.adminList);
adminSubjectRoutes.post('/', c.create);
adminSubjectRoutes.patch('/:id', c.update);
