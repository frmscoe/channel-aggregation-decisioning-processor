export interface IConfig {
  maxCPU: number;
  redisDB: number;
  redisAuth: string;
  redisHost: string;
  redisPort: number;
  restPort: number;
  logstashHost: string;
  logstashPort: number;
  functionName: string;
  tadpEndpoint: string;
  apmLogging: boolean;
  apmSecretToken: string;
  apmURL: string;
  nodeEnv: string;
  dbURL: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  collectionName: string;
  redis: {
    auth: string;
    db: number;
    host: string;
    port: number;
  };
}
