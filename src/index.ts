import { config } from './config';
import { LoggerService } from './services/logger.service';
import App from './app';
import { initializeRedis } from './clients/redis.client';
import NodeCache from 'node-cache';
import apm from 'elastic-apm-node';

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
  initializeRedis(config.redisDB, config.redisHost, config.redisPort, config.redisAuth);
  runServer();
} catch (err) {
  LoggerService.error('Error while starting gRPC server', err, 'index.ts');
}
