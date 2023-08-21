import path from 'path';
import * as dotenv from 'dotenv';
import { type IConfig } from './interfaces/iConfig';

// Load .env file into process.env if it exists. This is convenient for running locally.
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

export const config: IConfig = {
  maxCPU: parseInt(process.env.MAX_CPU!, 10) || 4,
  logger: {
    logstashHost: process.env.LOGSTASH_HOST as string,
    logstashPort: parseInt(process.env.LOGSTASH_PORT ?? '0', 10),
    logstashLevel: (process.env.LOGSTASH_LEVEL as string) || 'info',
  },
  functionName: process.env.FUNCTION_NAME as string,
  apmLogging: process.env.APM_LOGGING === 'true',
  apmSecretToken: process.env.APM_SECRET_TOKEN as string,
  apmURL: process.env.APM_URL as string,
  nodeEnv: process.env.NODE_ENV as string,
  dbURL: process.env.DB_URL as string,
  dbName: process.env.DB_NAME as string,
  dbUser: process.env.DB_USER as string,
  dbPassword: process.env.DB_PASSWORD as string,
  collectionName: process.env.COLLECTION_NAME as string,
  redis: {
    db: parseInt(process.env.REDIS_DB!, 10) || 0,
    servers: JSON.parse((process.env.REDIS_SERVERS as string) || '[{"hostname": "127.0.0.1", "port":6379}]'),
    password: process.env.REDIS_AUTH as string,
    isCluster: process.env.REDIS_IS_CLUSTER === 'true',
  },
};
