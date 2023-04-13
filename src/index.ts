import { config } from './config';
import { LoggerService } from './services/logger.service';
import App from './app';
import { RedisClientService } from './services/redis.client';
import NodeCache from 'node-cache';
import apm from 'elastic-apm-node';
import { iCacheService } from './interfaces/iCacheService';
import cluster from 'cluster';
import os from 'os';
import { ArangoDBService } from './clients/arango.client';

apm.start({
  serviceName: config.functionName,
  secretToken: config.apmSecretToken,
  serverUrl: config.apmURL,
  usePathAsTransactionName: true,
  active: config.apmLogging,
  transactionIgnoreUrls: [
    '/health'
  ],
});

export const cache = new NodeCache();
export const dbService = new ArangoDBService();
export const cacheService: iCacheService = new RedisClientService();

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

const numCPUs = os.cpus().length > config.maxCPU ? config.maxCPU + 1 : os.cpus().length + 1;

if (cluster.isMaster && config.maxCPU !== 1) {
  console.log(`Primary ${process.pid} is running`);

  // Fork workers.
  for (let i = 1; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died, starting another worker`);
    cluster.fork();
  });
} else {
  // Workers can share any TCP connection
  // In this case it is an HTTP server
  try {
    runServer();
  } catch (err) {
    LoggerService.error(`Error while starting HTTP server on Worker ${process.pid}`, err);
  }
  console.log(`Worker ${process.pid} started`);
}
