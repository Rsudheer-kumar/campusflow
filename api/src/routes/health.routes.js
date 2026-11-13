/**
 * CampusFlow API - Health Routes
 * Defines routes for service health and diagnostics.
 */

import { Router } from 'express';
import { getHealth, getLiveness, getReadiness } from '../controllers/health.controller.js';

const router = Router();

router.get('/', getHealth);
router.get('/live', getLiveness);
router.get('/ready', getReadiness);

export default router;
