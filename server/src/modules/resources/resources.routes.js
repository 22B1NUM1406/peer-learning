import { Router } from 'express';
import multer from 'multer';
import { AppError } from '../../lib/errors.js';
import { MAX_FILE_SIZE } from './files.js';
import * as c from './resources.controller.js';

// Файлыг санах ойд түр авч, төрлийг шалгасны дараа л дискэнд бичнэ
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 10 },
});

// multer-ийн алдааг ойлгомжтой хариу болгоно
function singleFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError(413, 'FILE_TOO_LARGE', 'Файл 10 MB-аас их байна'));
    if (err instanceof multer.MulterError) return next(new AppError(400, 'VALIDATION', 'Файл илгээхэд алдаа гарлаа'));
    next(err);
  });
}

export const resourceRoutes = Router();
resourceRoutes.get('/subjects/:id/resources', c.list);
resourceRoutes.post('/resources', singleFile, c.create);
resourceRoutes.get('/resources/:id/file', c.download);
resourceRoutes.delete('/resources/:id', c.remove);
