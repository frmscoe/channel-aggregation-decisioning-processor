export interface iCacheService {
    getJson(key: string): Promise<string>;
    setJson(key: string, value: string): Promise<string>;
    deleteKey(key: string): Promise<number>;
}