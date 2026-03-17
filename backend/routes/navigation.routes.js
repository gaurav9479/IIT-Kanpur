import express from 'express';
import { getGridPath } from '../controllers/navigation.controller.js';

const router = express.Router();

router.post('/grid-path', getGridPath);

export default router;
