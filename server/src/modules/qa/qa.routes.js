import { Router } from 'express';
import * as c from './qa.controller.js';

export const qaRoutes = Router();

qaRoutes.post('/questions', c.createQuestion);
qaRoutes.get('/questions/:id', c.getQuestion);
qaRoutes.patch('/questions/:id', c.updateQuestion);
qaRoutes.delete('/questions/:id', c.deleteQuestion);
qaRoutes.get('/questions/:id/related', c.related);
qaRoutes.put('/questions/:id/bookmark', c.addBookmark);
qaRoutes.delete('/questions/:id/bookmark', c.removeBookmark);

qaRoutes.post('/questions/:id/answers', c.createAnswer);
qaRoutes.patch('/answers/:id', c.updateAnswer);
qaRoutes.delete('/answers/:id', c.deleteAnswer);

qaRoutes.post('/questions/:id/comments', c.commentOnQuestion);
qaRoutes.post('/answers/:id/comments', c.commentOnAnswer);
qaRoutes.delete('/comments/:id', c.deleteComment);
