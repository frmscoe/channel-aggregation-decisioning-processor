import path from 'path';
import * as dotenv from 'dotenv';
import { type IConfig } from './interfaces/iConfig';

// Load .env file into process.env if it exists. This is convenient for running locally.
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

export const config: IConfig = {
  maxCPU: parseInt(process.env.MAX_CPU!, 10) || 4,
  redisDB: parseInt(process.env.REDIS_DB!, 10) ?? 0,
  redisAuth: process.env.REDIS_AUTH as string,
  redisHost: process.env.REDIS_HOST as string,
  redisPort: parseInt(process.env.REDIS_PORT!, 10),
  restPort: parseInt(process.env.REST_PORT!, 10),
  logstashHost: process.env.LOGSTASH_HOST as string,
  logstashPort: parseInt(process.env.LOGSTASH_PORT!, 10),
  functionName: process.env.FUNCTION_NAME as string,
  tadpEndpoint: process.env.TADP_ENDPOINT as string,
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
