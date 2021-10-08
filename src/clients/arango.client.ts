import { Database } from 'arangojs';
import { cache } from '..';
import { config } from '../config';
import { ITypologyExpression } from '../interfaces/iTypologyExpression';
import { LoggerService } from '../services/logger.service';
import apm from 'elastic-apm-node';

class ArangoDBService {
  client: Database;

  constructor() {
    this.client = new Database({
      url: config.dbURL,
      databaseName: config.dbName,
      auth: {
        username: config.dbUser,
        password: config.dbPassword,
      },
    });

    LoggerService.log('✅ ArangoDB connection is ready');
  }

  async getExpression(channelId: string): Promise<ITypologyExpression | undefined> {
    const cacheVal = cache.get(channelId);
    if (cacheVal) return cacheVal as ITypologyExpression;
    const span = apm.startSpan('Fetch Channel Expression from Database');
    const typologyExpressionQuery = `
        FOR doc IN ${config.collectionName}
        FILTER doc._key == "${channelId}"
        RETURN doc
        `;

    try {
      const cycles = await this.client.query(typologyExpressionQuery);
      const results = await cycles.batches.all();
      const typologyExpression: ITypologyExpression = results[0][0];
      span?.end();
      cache.set(channelId, results[0][0]);
      return typologyExpression;
    } catch (error) {
      span?.end();
      LoggerService.error('Error while executing ArangoDB query with message:', error as Error, 'ArangoDBService');
    }
  }
}

export const arangoDBService: ArangoDBService = new ArangoDBService();
