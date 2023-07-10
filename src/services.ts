import NodeCache from 'node-cache';
import { RedisClientService } from './services/redis.client';

export class Services {
  private static cache: NodeCache;
  private static cacheClient: RedisClientService;

  public static getCacheInstance(): NodeCache {
    if (!Services.cache) Services.cache = new NodeCache();
    return Services.cache;
  }

  public static getCacheClientInstance(): RedisClientService {
    if (!Services.cacheClient) Services.cacheClient = new RedisClientService();
    return Services.cacheClient;
  }
}
