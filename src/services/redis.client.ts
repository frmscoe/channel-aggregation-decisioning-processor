import { RedisClient } from 'redis';
import { config } from '../config';
import { iCacheService } from '../interfaces/iCacheService';
import { LoggerService } from './logger.service';

export class RedisClientService implements iCacheService {
  redisClient: RedisClient;
  constructor() {
    this.redisClient = new RedisClient({
      db: config.redisDB,
      host: config.redisHost,
      port: config.redisPort,
      auth_pass: config.redisAuth,
    });
  }

  getJson = (key: string): Promise<string> =>
    new Promise((resolve) => {
      this.redisClient.get(key, (err, res) => {
        if (err) {
          LoggerService.error('Error while getting Redis key', err);
          resolve('');
        }
        resolve(res ?? '');
      });
    });

  setJson = (key: string, value: string): Promise<string> =>
    new Promise((resolve) => {
      this.redisClient.SET(key, value, (err, res) => {
        if (err) {
          LoggerService.error(`Error while saving to Redis key: ${key}`, err);
          resolve('');
        }
        resolve(res);
      });
    });

  deleteKey = (key: string): Promise<number> =>
    new Promise((resolve) => {
      this.redisClient.DEL(key, (err, res) => {
        if (err) {
          LoggerService.error(`Error while Deleting key in Redis: ${key}`, err);
          resolve(0);
        }
        resolve(res);
      });
    });
}