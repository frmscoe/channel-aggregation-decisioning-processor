import cluster from 'cluster';
import apm from 'elastic-apm-node';
import { Context } from 'koa';
import os from 'os';
import App from './app';
import { config } from './config';
import { iCacheService } from './interfaces/iCacheService';
import { Services } from './services';
import { LoggerService } from './services/logger.service';
import { CreateDatabaseManager, DatabaseManagerInstance } from '@frmscoe/frms-coe-lib';

apm.start({
  serviceName: config.functionName,
  secretToken: config.apmSecretToken,
  serverUrl: config.apmURL,
  usePathAsTransactionName: true,
  active: config.apmLogging,
  transactionIgnoreUrls: ['/health'],
});

export const cache = Services.getCacheInstance();
export const dbService = Services.getDatabaseInstance();
export const cacheService: iCacheService = Services.getCacheClientInstance();

let app: App;

const databaseManagerConfig = {
  redisConfig: {
    db: config.redis.db,
    host: config.redis.host,
    password: config.redis.auth,
    port: config.redis.port,
  },
};

let databaseManager: DatabaseManagerInstance<typeof databaseManagerConfig>;

export const init = async () => {
  const manager = await CreateDatabaseManager(databaseManagerConfig);
  databaseManager = manager;
};

export const runServer = (): App => {
  /**
   * KOA Rest Server
   */
  const koaApp = new App();
  koaApp.listen(config.restPort, () => {
    LoggerService.log(`API restServer listening on PORT ${config.restPort}`);
  });

  function handleError(err: Error, ctx: Context): void {
    if (ctx == null) {
      LoggerService.error(err, undefined, 'Unhandled exception occured');
    }
  }

  function terminate(signal: NodeJS.Signals): void {
    try {
      koaApp.terminate();
    } finally {
      LoggerService.log('App is terminated');
      process.kill(process.pid, signal);
    }
  }
  return koaApp;
};

process.on('uncaughtException', (err) => {
  LoggerService.error('process on uncaughtException error', err, 'index.ts');
});

process.on('unhandledRejection', (err) => {
  LoggerService.error(`process on unhandledRejection error: ${err ?? '[NoMetaData]'}`);
});

const numCPUs = os.cpus().length > config.maxCPU ? config.maxCPU + 1 : os.cpus().length + 1;

if (process.env.NODE_ENV !== 'test') {
  // setup lib - create database instance
  init();
}

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
    app = runServer();
  } catch (err) {
    LoggerService.error(`Error while starting HTTP server on Worker ${process.pid}`, err);
  }
  console.log(`Worker ${process.pid} started`);
}

export { databaseManager };
export { app };
