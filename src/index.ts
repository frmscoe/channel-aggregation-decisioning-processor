import { CreateDatabaseManager, DatabaseManagerInstance } from '@frmscoe/frms-coe-lib';
import { StartupFactory, IStartupService } from 'startup';
import cluster from 'cluster';
import apm from 'elastic-apm-node';
import NodeCache from 'node-cache';
import os from 'os';
import { config } from './config';
import { iCacheService } from './interfaces/iCacheService';
import { Services } from './services';
import { LoggerService } from './services/logger.service';
import { handleTransaction } from './services/logic.service';

//if (config.apmLogging)
apm.start({
  serviceName: config.functionName,
  secretToken: config.apmSecretToken,
  serverUrl: config.apmURL,
  usePathAsTransactionName: true,
  active: config.apmLogging,
  transactionIgnoreUrls: ['/health'],
});

let cache: NodeCache;
export const cacheService: iCacheService = Services.getCacheClientInstance();

const databaseManagerConfig = {
  redisConfig: {
    db: config.redis.db,
    host: config.redis.host,
    password: config.redis.auth,
    port: config.redis.port,
  },
};

let databaseManager: DatabaseManagerInstance<typeof databaseManagerConfig>;
export let server: IStartupService;

export const dbInit = async () => {
  databaseManager = await CreateDatabaseManager(databaseManagerConfig);
};
//handleTransaction
export const runServer = async () => {
  server = new StartupFactory();
  if (config.nodeEnv == 'test') return;
  dbInit();
  for (let retryCount = 0; retryCount < 10; retryCount++) {
    console.log('Connecting to nats server...');
    if (!(await server.init(handleTransaction))) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
      console.log('Connected to nats');
      break;
    }
  }
};

process.on('uncaughtException', (err) => {
  LoggerService.error('process on uncaughtException error', err, 'index.ts');
});

process.on('unhandledRejection', (err) => {
  LoggerService.error(`process on unhandledRejection error: ${err ?? '[NoMetaData]'}`);
});


(async () => {
  cache = Services.getCacheInstance();
  try {
    if (process.env.NODE_ENV !== 'test') {
      // setup lib - create database instance
      await dbInit();
    }
  } catch (err) {
    LoggerService.error('Error while starting HTTP server', err as Error);
  }
})();

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

export { cache, databaseManager };

