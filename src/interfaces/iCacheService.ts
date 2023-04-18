import { RedisClient } from 'redis';

export interface iCacheService {
  redisClient: RedisClient;
  getJson(key: string): Promise<string>;
  setJson(key: string, value: string): Promise<string>;
  deleteKey(key: string): Promise<number>;
}
