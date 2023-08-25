import { type RedisConfig } from '@frmscoe/frms-coe-lib/lib/interfaces';
export interface IConfig {
  maxCPU: number;
  logger: {
    logstashHost: string;
    logstashPort: number;
    logstashLevel: string;
  };
  functionName: string;
  apmLogging: boolean;
  apmSecretToken: string;
  apmURL: string;
  nodeEnv: string;
  dbURL: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  collectionName: string;
  redis: RedisConfig;
}
