import Router from 'koa-router';
import { healthCheck } from './controllers/healthcheck';
import { handleTransaction } from './services/logic.service';

const router = new Router();

// health checks
router.get('/health', healthCheck);
router.post('/execute', handleTransaction);

export default router;
