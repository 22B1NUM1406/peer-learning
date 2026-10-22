import { optionalString, requireId, requireString, requireUrl } from '../../lib/validate.js';
import * as service from './resources.service.js';

export async function list(req, res) {
  res.json({ resources: await service.listBySubject(requireId(req.params.id), req.user) });
}

// multipart/form-data: multer нь текст талбаруудыг req.body-д, файлыг req.file-д өгнө
export async function create(req, res) {
  const b = req.body ?? {};
  const id = await service.create(req.user, {
    subjectId: requireId(b.subjectId, 'Хичээл'),
    title: requireString(b.title, 'Гарчиг', { min: 3, max: 200 }),
    description: optionalString(b.description, 'Тайлбар', { max: 2000 }),
    url: b.url ? requireUrl(b.url) : undefined,
    file: req.file,
  });
  res.status(201).json({ id });
}

export async function download(req, res) {
  const f = await service.getFile(requireId(req.params.id), req.user);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Type', f.mimeType);
  // inline: PDF, зургийг хөтөч дотор нээнэ; нэрийг UTF-8-аар (кирилл) дамжуулна
  res.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.downloadName)}`);
  res.sendFile(f.path);
}

export async function remove(req, res) {
  await service.remove(req.user, requireId(req.params.id));
  res.status(204).end();
}
