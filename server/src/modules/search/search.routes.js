import { Router } from 'express';
import * as c from './search.controller.js';

// Q&A-аас өмнө залгана: '/questions/similar'-ийг '/questions/:id' гэж ойлгохоос сэргийлнэ
export const searchRoutes = Router();

searchRoutes.get('/questions', c.list);
searchRoutes.get('/questions/similar', c.similar);
