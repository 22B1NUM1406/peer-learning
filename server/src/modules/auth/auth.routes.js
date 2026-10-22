import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as c from './auth.controller.js';

// Routes давхарга: URL-ийг controller-т холбож, эрхийн middleware-ийг залгана.
export const authRoutes = Router();

authRoutes.post('/register', c.register);
authRoutes.post('/login', c.login);
// Session хугацаа нь дууссан ч cookie-г цэвэрлэх боломжтой байхаар requireAuth тавиагүй
authRoutes.post('/logout', c.logout);
authRoutes.get('/me', requireAuth, c.getMe);
