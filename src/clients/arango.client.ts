import { Database } from 'arangojs';
import { cache } from '..';
import { config } from '../config';
import { ITypologyExpression } from '../interfaces/iTypologyExpression';
import { LoggerService } from '../services/logger.service';
import apm from 'elastic-apm-node';
import * as fs from 'fs'

class ArangoDBService {
  client: Database;

  constructor() {
    const caOption = fs.existsSync("/usr/local/share/ca-certificates/ca-certificates.crt") ? [fs.readFileSync("/usr/local/share/ca-certificates/ca-certificates.crt")] : []
    this.client = new Database({
      url: config.dbURL,
      databaseName: config.dbName,
      auth: {
        username: config.dbUser,
        password: config.dbPassword,
      },
      agentOptions: {
        ca: caOption
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
