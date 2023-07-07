/* eslint-disable */
import apm from 'elastic-apm-node';
import { cacheService, databaseManager, dbInit, server } from '../../src';
import { TypologyResult } from '../../src/classes/typology-result';
import { handleTransaction } from '../../src/services/logic.service';
import { NetworkMap, Pacs002, RuleResult } from '@frmscoe/frms-coe-lib/lib/interfaces';

jest.mock('elastic-apm-node');
const mockApm = apm as jest.Mocked<typeof apm>;

interface MockedSpan extends Omit<apm.Span, 'end'> {
  end: jest.Mock;
}

(mockApm.startSpan as jest.MockedFunction<typeof mockApm.startSpan>).mockReturnValue({
  end: jest.fn(),
} as MockedSpan);

const getMockTransaction = () => {
  const jquote = JSON.parse(
    '{"TxTp":"pacs.002.001.12","FIToFIPmtSts":{"GrpHdr":{"MsgId":"30bea71c5a054978ad0da7f94b2a40e9789","CreDtTm":"${new Date().toISOString()}"},"TxInfAndSts":{"OrgnlInstrId":"5ab4fc7355de4ef8a75b78b00a681ed2255","OrgnlEndToEndId":"2c516801007642dfb89294dde","TxSts":"ACCC","ChrgsInf":[{"Amt":{"Amt":307.14,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}}},{"Amt":{"Amt":153.57,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}}},{"Amt":{"Amt":30.71,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}}}],"AccptncDtTm":"2021-12-03T15:24:26.000Z","InstgAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}},"InstdAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}}}}}',
  );
  const quote: Pacs002 = Object.assign({}, jquote);
  return quote;
};

const getMockNetworkMap = () => {
  const jNetworkMap = JSON.parse(
    '{"_key":"26345403","_id":"networkConfiguration/26345403","_rev":"_cxc-1vO---","messages":[{"id":"001@1.0","host":"http://openfaas:8080","cfg":"1.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0","host":"http://openfaas:8080","cfg":"1.0","typologies":[{"id":"028@1.0","host":"https://frmfaas.sybrin.com/function/off-typology-processor","cfg":"028@1.0","rules":[{"id":"003@1.0","host":"http://openfaas:8080","cfg":"1.0"},{"id":"028@1.0","host":"http://openfaas:8080","cfg":"1.0"}]}]}]}]}',
  );
  const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
  return networkMap;
};

const getMockNetworkMapWithMultipleChannels = () => {
  const jNetworkMap = JSON.parse(
    '{"_key":"26345403","_id":"networkConfiguration/26345403","_rev":"_cxc-1vO---","messages":[{"id":"001@1.0","host":"http://openfaas:8080","cfg":"1.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0","host":"http://openfaas:8080","cfg":"1.0","typologies":[{"id":"028@1.0","host":"https://frmfaas.sybrin.com/function/off-typology-processor","cfg":"028@1.0","rules":[{"id":"003@1.0","host":"http://openfaas:8080","cfg":"1.0"},{"id":"028@1.0","host":"http://openfaas:8080","cfg":"1.0"}]},{"id":"029@1.0","host":"https://frmfaas.sybrin.com/function/off-typology-processor","cfg":"029@1.0","rules":[{"id":"003@1.0","host":"http://openfaas:8080","cfg":"1.0"},{"id":"005@1.0","host":"http://openfaas:8080","cfg":"1.0"}]}]},{"id":"002@1.0","host":"http://openfaas:8080","cfg":"1.0","typologies":[{"id":"030@1.0","host":"https://frmfaas.sybrin.com/function/off-typology-processor","cfg":"030@1.0","rules":[{"id":"003@1.0","host":"http://openfaas:8080","cfg":"1.0"},{"id":"006@1.0","host":"http://openfaas:8080","cfg":"1.0"}]},{"id":"031@1.0","host":"https://frmfaas.sybrin.com/function/off-typology-processor","cfg":"031@1.0","rules":[{"id":"003@1.0","host":"http://openfaas:8080","cfg":"1.0"},{"id":"007@1.0","host":"http://openfaas:8080","cfg":"1.0"}]}]}]}]}',
  );
  const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
  return networkMap;
};

afterAll(async () => {
  
});

beforeAll(async () => {
  await dbInit();
});

describe('Logic Service', () => {
  let responseSpy: jest.SpyInstance;
  beforeEach(() => {
    responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation(jest.fn());

    jest.spyOn(databaseManager, 'getJson').mockImplementation((key: string): Promise<string> => {
      return new Promise<string>((resolve, reject) => resolve('[]'));
    });

    jest.spyOn(databaseManager, 'setJson').mockImplementation((key: string): Promise<'OK' | undefined> => {
      return new Promise<'OK' | undefined>((resolve, reject) => resolve('OK'));
    });

    jest.spyOn(databaseManager, 'deleteKey').mockImplementation((key: string): Promise<number> => {
      return new Promise<number>((resolve, reject) => resolve(0));
    });

    jest.spyOn(cacheService, 'deleteKey').mockImplementation((key: string): Promise<number> => {
      return new Promise<number>((resolve, reject) => resolve(0));
    });
    const ruleResults: RuleResult[] = [{ result: true, id: '', cfg: '', subRuleRef: '', reason: '', desc: '' }];
    jest.spyOn(cacheService, 'addOneGetAll').mockImplementation((key: string, value: string): Promise<string[] | null> => {
      return new Promise<string[]>((resolve, reject) =>
        resolve([JSON.stringify({ result: 50, id: '028@1.0', cfg: '028@1.0', desc: 'test', threshold: 0, ruleResults })]),
      );
    });
  });

  describe('Handle Legacy Transaction', () => {
    it('should handle successful request, with an unmatched number', async () => {
      const expectedReq = getMockTransaction();

      const ruleResults: RuleResult[] = [{ result: true, id: '', cfg: '', subRuleRef: '', reason: '', desc: '' }];

      const networkMap = getMockNetworkMapWithMultipleChannels();
      const typologyResult: TypologyResult = { result: 50, id: '030@1.0', cfg: '030@1.0', desc: 'test', threshold: 0, ruleResults };

      const result = await handleTransaction({
        transaction: expectedReq,
        networkMap: networkMap,
        typologyResult: typologyResult
      });

      expect(responseSpy).toHaveBeenCalledTimes(0);
    });

    it('should handle successful request, with a matched number', async () => {
      const expectedReq = getMockTransaction();

      const ruleResults: RuleResult[] = [{ result: true, id: '', cfg: '', subRuleRef: '', reason: '', desc: '' }];
      const networkMap = getMockNetworkMap();
      const typologyResult: TypologyResult = { result: 50, id: '028@1.0', cfg: '028@1.0', desc: 'test', threshold: 0, ruleResults };

      const result = await handleTransaction({
        transaction: expectedReq,
        networkMap: networkMap,
        typologyResult: typologyResult
      });

      expect(responseSpy).toHaveBeenCalled();
    });

    it('should handle successful request, have existing typology results already', async () => {
      const expectedReq = getMockTransaction();

      jest.spyOn(databaseManager, 'getJson').mockImplementation((key: string): Promise<string> => {
        return new Promise<string>((resolve, reject) =>
          resolve(
            '[{"id":"028@1.0","cfg":"028@1.0","result":50,"ruleResults":[{"result":true,"id":"","cfg":"","subRuleRef":"","reason":""}]}]',
          ),
        );
      });

      const ruleResults: RuleResult[] = [{ result: true, id: '', cfg: '', subRuleRef: '', reason: '', desc: '' }];
      const networkMap = getMockNetworkMapWithMultipleChannels();
      const typologyResult: TypologyResult = { result: 50, id: '028@1.0', cfg: '028@1.0', desc: 'test', threshold: 0, ruleResults };

      const result = await handleTransaction({
        transaction: expectedReq,
        networkMap: networkMap,
        typologyResult: typologyResult
      });

      expect(responseSpy).toHaveBeenCalledTimes(0);
    });

    it('should handle successful request, cacheService error', async () => {
      jest.spyOn(cacheService, 'addOneGetAll').mockRejectedValue((key: string, value: string): Promise<string[] | null> => {
        return new Promise((resolve, reject) => {
          resolve(null);
        });
      });

      const expectedReq = getMockTransaction();

      const ruleResults: RuleResult[] = [{ result: true, id: '', cfg: '', subRuleRef: '', reason: '', desc: '' }];
      const networkMap = getMockNetworkMap();
      const typologyResult: TypologyResult = { result: 50, id: '028@1.0', cfg: '028@1.0', desc: 'test', threshold: 0, ruleResults };

      const result = await handleTransaction({
        transaction: expectedReq,
        networkMap: networkMap,
        typologyResult: typologyResult
      });

      expect(responseSpy).toHaveBeenCalledTimes(0);
    });

    it('should handle successful request, not all results yet', async () => {
      const expectedReq = getMockTransaction();
      const ruleResults: RuleResult[] = [{ result: true, id: '', cfg: '', subRuleRef: '', reason: '', desc: '' }];

      const networkMap = getMockNetworkMapWithMultipleChannels();
      const typologyResult: TypologyResult = { result: 50, id: '028@1.0', cfg: '028@1.0', desc: 'test', threshold: 0, ruleResults };

      const result = await handleTransaction({
        transaction: expectedReq,
        networkMap: networkMap,
        typologyResult: typologyResult
      });

      expect(responseSpy).toHaveBeenCalledTimes(0);
    });

    it('should respond with error if nothing comes back from cache', async () => {
      const expectedReq = getMockTransaction();
      const ruleResults: RuleResult[] = [{ result: true, id: '', cfg: '', subRuleRef: '', reason: '', desc: '' }];

      jest.spyOn(cacheService, 'addOneGetAll').mockImplementation((key: string, value: string): Promise<string[] | null> => {
        return new Promise<string[] | null>((resolve, reject) => resolve(null));
      });

      const networkMap = getMockNetworkMapWithMultipleChannels();
      const typologyResult: TypologyResult = { result: 50, id: '028@1.0', cfg: '028@1.0', desc: 'test', threshold: 0, ruleResults };

      const result = await handleTransaction({
        transaction: expectedReq,
        networkMap: networkMap,
        typologyResult: typologyResult
      });

      expect(responseSpy).toHaveBeenCalledTimes(0);
    });
  });
});
