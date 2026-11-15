import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import * as c from './subjects.controller.js';

// /api/subjects — нэвтэрсэн бүх хэрэглэгч
export const subjectRoutes = Router();
subjectRoutes.get('/', requireAuth, c.list);
subjectRoutes.get('/:id', requireAuth, c.get);

// /api/schools — бүрэлдэхүүн сургууль, тэнхимүүд (FR-26)
export const schoolRoutes = Router();
schoolRoutes.get('/', requireAuth, c.listSchools);

// /api/admin/subjects — зөвхөн админ (FR-17, P11)
export const adminSubjectRoutes = Router();
adminSubjectRoutes.use(requireAdmin);
adminSubjectRoutes.get('/', c.adminList);
adminSubjectRoutes.post('/', c.create);
adminSubjectRoutes.patch('/:id', c.update);

// /api/admin/schools, /api/admin/departments — зөвхөн админ (FR-26)
export const adminSchoolRoutes = Router();
adminSchoolRoutes.use(requireAdmin);
adminSchoolRoutes.post('/schools', c.createSchool);
adminSchoolRoutes.patch('/schools/:id', c.updateSchool);
adminSchoolRoutes.post('/schools/:id/departments', c.createDepartment);
adminSchoolRoutes.patch('/departments/:id', c.renameDepartment);
