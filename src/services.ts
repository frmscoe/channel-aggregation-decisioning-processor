import NodeCache from 'node-cache';
import { ArangoDBService } from './clients/arango.client';
import { RedisClientService } from './services/redis.client';

export class Services {
  private static cache: NodeCache;
  private static databaseClient: ArangoDBService;
  private static cacheClient: RedisClientService;

  public static getCacheInstance(): NodeCache {
    if (!Services.cache) Services.cache = new NodeCache();

    return Services.cache;
  }

  public static getDatabaseInstance(): ArangoDBService {
    if (!Services.databaseClient) Services.databaseClient = new ArangoDBService();

    return Services.databaseClient;
  }

  public static getCacheClientInstance(): RedisClientService {
    if (!Services.cacheClient) Services.cacheClient = new RedisClientService();

    return Services.cacheClient;
  }
}
