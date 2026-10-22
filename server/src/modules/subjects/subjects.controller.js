import { badRequest } from '../../lib/errors.js';
import { optionalBoolean, requireId, requireString } from '../../lib/validate.js';
import * as service from './subjects.service.js';

export async function list(req, res) {
  res.json({ subjects: await service.listActive() });
}

export async function get(req, res) {
  res.json({ subject: await service.get(requireId(req.params.id)) });
}

export async function adminList(req, res) {
  res.json({ subjects: await service.listAll() });
}

export async function create(req, res) {
  const name = requireString(req.body?.name, 'Хичээлийн нэр', { min: 2, max: 150 });
  res.status(201).json({ subject: await service.create(name) });
}

export async function update(req, res) {
  const id = requireId(req.params.id);
  const name = req.body?.name === undefined
    ? undefined
    : requireString(req.body.name, 'Хичээлийн нэр', { min: 2, max: 150 });
  const isActive = optionalBoolean(req.body?.isActive, 'isActive');
  if (name === undefined && isActive === undefined) throw badRequest('Өөрчлөх талбар алга');
  res.json({ subject: await service.update(id, { name, isActive }) });
}
