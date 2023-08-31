import './apm';
import { CreateDatabaseManager, LoggerService, type DatabaseManagerInstance } from '@frmscoe/frms-coe-lib';
import { StartupFactory, type IStartupService } from '@frmscoe/frms-coe-startup-lib';
import cluster from 'cluster';
import type NodeCache from 'node-cache';
import os from 'os';
import { config } from './config';
import { Services } from './services';
import { handleTransaction } from './services/logic.service';

let cache: NodeCache;

const databaseManagerConfig = {
  redisConfig: {
    db: config.redis.db,
    servers: config.redis.servers,
    password: config.redis.password,
    isCluster: config.redis.isCluster,
  },
};

export const loggerService: LoggerService = new LoggerService();
let databaseManager: DatabaseManagerInstance<typeof databaseManagerConfig>;
export let server: IStartupService;

export const dbInit = async (): Promise<void> => {
  databaseManager = await CreateDatabaseManager(databaseManagerConfig);
};
// handleTransaction
export const runServer = async (): Promise<void> => {
  server = new StartupFactory();
  await dbInit();
  if (config.nodeEnv === 'test') return;
  for (let retryCount = 0; retryCount < 10; retryCount++) {
    loggerService.log('Connecting to nats server...');
    if (!(await server.init(handleTransaction))) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
      loggerService.log('Connected to nats');
      break;
    }
  }
};

process.on('uncaughtException', (err) => {
  loggerService.error('process on uncaughtException error', err, 'index.ts');
});

process.on('unhandledRejection', (err) => {
  loggerService.error(`process on unhandledRejection error: ${JSON.stringify(err) ?? '[NoMetaData]'}`);
});

(async () => {
  cache = Services.getCacheInstance();
  try {
    if (process.env.NODE_ENV !== 'test') {
      // setup lib - create database instance
      await dbInit();
    }
  } catch (err) {
    loggerService.error('Error while starting HTTP server', err as Error);
  }
})();

const numCPUs = os.cpus().length > config.maxCPU ? config.maxCPU + 1 : os.cpus().length + 1;
if (cluster.isMaster && config.maxCPU !== 1) {
  loggerService.log(`Primary ${process.pid} is running`);

  // Fork workers.
  for (let i = 1; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    loggerService.log(`worker ${worker.process.pid} died, starting another worker`);
    cluster.fork();
  });
} else {
  // Workers can share any TCP connection
  // In this case it is an HTTP server
  (async () => {
    try {
      if (config.nodeEnv !== 'test') {
        await runServer();
      }
    } catch (err) {
      loggerService.error(`Error while starting HTTP server on Worker ${process.pid}`, err);
    }
  })();
  loggerService.log(`Worker ${process.pid} started`);
}

export { cache, databaseManager };
