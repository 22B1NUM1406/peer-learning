import { Router } from 'express';
import * as c from './users.controller.js';

// /api доор залгагдана
export const userRoutes = Router();

// "me" маршрутуудыг ":id"-ээс өмнө бичнэ, эс бөгөөс "me"-г id гэж ойлгоно
userRoutes.patch('/users/me', c.updateMe);
userRoutes.put('/users/me/subjects', c.setMySubjects);
userRoutes.get('/users/:id', c.getProfile);
userRoutes.get('/users/:id/questions', c.getQuestions);
userRoutes.get('/users/:id/answers', c.getAnswers);
userRoutes.get('/subjects/:id/helpers', c.listHelpers);
