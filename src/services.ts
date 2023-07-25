import NodeCache from 'node-cache';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Services {
  private static cache: NodeCache;

  public static getCacheInstance(): NodeCache {
    if (!Services.cache) Services.cache = new NodeCache();
    return Services.cache;
  }
}
