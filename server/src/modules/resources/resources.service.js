import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { findSubjectById } from '../subjects/subjects.repo.js';
import * as repo from './resources.repo.js';
import * as files from './files.js';

// Resource модуль: материалын холбоос (FR-21) ба файл (FR-23)

const toDto = (r, viewer) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  kind: r.url ? 'link' : 'file',
  url: r.url,                                   // зөвхөн холбоос төрөлд
  fileUrl: r.file_path ? `/api/resources/${r.id}/file` : null, // дискийн замыг ил гаргахгүй
  mimeType: r.mime_type,
  fileSize: r.file_size,
  createdAt: r.created_at,
  author: { id: r.author_id, name: r.author_name },
  canDelete: r.author_id === viewer.id,
});

export async function listBySubject(subjectId, viewer) {
  if (!(await findSubjectById(subjectId))) throw notFound('Хичээл олдсонгүй');
  return (await repo.listBySubject(subjectId)).map((r) => toDto(r, viewer));
}

// url эсвэл file-ийн яг нэг нь байна (өгөгдлийн санд мөн CHECK-ээр хамгаалсан)
export async function create(user, { subjectId, title, description, url, file }) {
  if (!!url === !!file) throw badRequest('Холбоос эсвэл файлын аль нэгийг оруулна');
  const subject = await findSubjectById(subjectId);
  if (!subject || !subject.isActive) throw badRequest('Хичээл олдсонгүй эсвэл идэвхгүй');

  if (url) return repo.createResource({ authorId: user.id, subjectId, title, description, url });

  const saved = await files.saveFile(file.buffer);
  try {
    return await repo.createResource({ authorId: user.id, subjectId, title, description, ...saved });
  } catch (err) {
    await files.removeFile(saved.filePath); // өгөгдлийн санд бичигдээгүй бол файлыг үлдээхгүй
    throw err;
  }
}

export async function getFile(id, viewer) {
  const r = await repo.findResource(id);
  if (!r || !r.file_path || (r.is_hidden && viewer.role !== 'admin')) throw notFound('Файл олдсонгүй');
  return {
    path: files.absolutePath(r.file_path),
    mimeType: r.mime_type,
    downloadName: `${r.title}${files.extensionFor(r.mime_type)}`,
  };
}

export async function remove(user, id) {
  const r = await repo.findResource(id);
  if (!r) throw notFound('Материал олдсонгүй');
  if (r.author_id !== user.id) throw forbidden();
  await removeResource(r);
}

// Эзэн болон админ (Moderation) хоёулаа ашиглана
export async function removeResource(r) {
  await repo.deleteResource(r.id);
  await files.removeFile(r.file_path);
}
