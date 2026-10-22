import { badRequest } from '../../lib/errors.js';
import { requireId } from '../../lib/validate.js';
import * as service from './rating.service.js';

export async function vote(req, res) {
  const voteCount = await service.vote(req.user, requireId(req.params.id));
  res.status(201).json({ voteCount, votedByMe: true });
}

export async function unvote(req, res) {
  const voteCount = await service.unvote(req.user, requireId(req.params.id));
  res.json({ voteCount, votedByMe: false });
}

export async function accept(req, res) {
  if (!req.body || !('answerId' in req.body)) throw badRequest('answerId заавал (болиулах бол null)');
  const answerId = req.body.answerId === null ? null : requireId(req.body.answerId, 'answerId');
  res.json(await service.accept(req.user, requireId(req.params.id), answerId));
}
