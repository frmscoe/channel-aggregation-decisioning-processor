import path from 'path';
import * as dotenv from 'dotenv';
import { IConfig } from './interfaces/iConfig';

// Load .env file into process.env if it exists. This is convenient for running locally.
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

export const config: IConfig = {
  maxCPU: parseInt(process.env.MAX_CPU!, 10) || 4,
  redisDB: <string>process.env.REDIS_DB,
  redisAuth: <string>process.env.REDIS_AUTH,
  redisHost: <string>process.env.REDIS_HOST,
  redisPort: parseInt(process.env.REDIS_PORT!, 10),
  restPort: parseInt(process.env.REST_PORT!, 10),
  logstashHost: <string>process.env.LOGSTASH_HOST,
  logstashPort: parseInt(process.env.LOGSTASH_PORT!, 10),
  functionName: <string>process.env.FUNCTION_NAME,
  tadpEndpoint: <string>process.env.TADP_ENDPOINT,
  apmLogging: <boolean>(process.env.APM_LOGGING === 'true'),
  apmSecretToken: <string>process.env.APM_SECRET_TOKEN,
  apmURL: <string>process.env.APM_URL,
  nodeEnv: <string>process.env.NODE_ENV,
  dbURL: <string>process.env.DB_URL,
  dbName: <string>process.env.DB_NAME,
  dbUser: <string>process.env.DB_USER,
  dbPassword: <string>process.env.DB_PASSWORD,
  collectionName: <string>process.env.COLLECTION_NAME,
  redis: {
    auth: <string>process.env.REDIS_AUTH,
    db: parseInt(process.env.REDIS_DB!, 10) || 0,
    host: <string>process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT!, 10),
  },
};
