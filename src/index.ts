import { config } from './config';
import { LoggerService } from './services/logger.service';
import App from './app';
import { RedisClientService } from './services/redis.client';
import NodeCache from 'node-cache';
import apm from 'elastic-apm-node';
import { iCacheService } from './interfaces/iCacheService';

apm.start({
  serviceName: config.functionName,
  secretToken: config.apmSecretToken,
  serverUrl: config.apmURL,
  usePathAsTransactionName: true,
  active: config.apmLogging,
});

export const cache = new NodeCache();

export const runServer = async (): Promise<void> => {
  /**
   * KOA Rest Server
   */
  const app = new App();
  app.listen(config.restPort, () => {
    LoggerService.log(`API restServer listening on PORT ${config.restPort}`);
  });
};

process.on('uncaughtException', (err) => {
  LoggerService.error('process on uncaughtException error', err, 'index.ts');
});

process.on('unhandledRejection', (err) => {
  LoggerService.error(`process on unhandledRejection error: ${err ?? '[NoMetaData]'}`);
});

try {
  runServer();
} catch (err) {
  LoggerService.error('Error while starting gRPC server', err, 'index.ts');
}

export const cacheService: iCacheService = new RedisClientService();