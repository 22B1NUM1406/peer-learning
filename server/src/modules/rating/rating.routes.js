import { Router } from 'express';
import * as c from './rating.controller.js';

export const ratingRoutes = Router();

ratingRoutes.post('/answers/:id/vote', c.vote);
ratingRoutes.delete('/answers/:id/vote', c.unvote);
ratingRoutes.put('/questions/:id/accepted', c.accept);
