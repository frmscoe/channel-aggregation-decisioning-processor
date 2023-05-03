/* eslint-disable */

import axios from 'axios';
import apm from 'elastic-apm-node';
import { app, cache, cacheService, dbService } from '../../src';
import { NetworkMap } from '../../src/classes/network-map';
import { RuleResult } from '../../src/classes/rule-result';
import { TypologyResult } from '../../src/classes/typology-result';
import { handleTransaction } from '../../src/services/logic.service';
import { Pacs002 } from '@frmscoe/frms-coe-lib/lib/interfaces';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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

afterAll(async (done) => {
  cache.close();
  cacheService.redisClient.quit();
  dbService.client.close();
  app.terminate();
  done();
});

describe('Logic Service', () => {
  let postSpy: jest.SpyInstance;
  let getJsonSpy: jest.SpyInstance;
  let setJsonSpy: jest.SpyInstance;
  let deleteJsonSpy: jest.SpyInstance;
  beforeEach(() => {
    postSpy = jest.spyOn(axios, 'post').mockImplementation(async (url: string, data?: any) => {
      return new Promise((resolve, reject) => {
        resolve({ status: 200 });
      });
    });

    getJsonSpy = jest.spyOn(cacheService, 'getJson').mockImplementation((key: string): Promise<string> => {
      return new Promise<string>((resolve, reject) => resolve('{}'));
    });

    setJsonSpy = jest.spyOn(cacheService, 'setJson').mockImplementation((key: string): Promise<string> => {
      return new Promise<string>((resolve, reject) => resolve(''));
    });

    deleteJsonSpy = jest.spyOn(cacheService, 'deleteKey').mockImplementation((key: string): Promise<number> => {
      return new Promise<number>((resolve, reject) => resolve(0));
    });
  });

  describe('Handle Legacy Transaction', () => {
    it('should handle successful request, with an unmatched number', async () => {
      const expectedReq = getMockTransaction();

      const ruleResults: RuleResult[] = [{ result: true, id: '', cfg: '', subRuleRef: '', reason: '' }];

      const networkMap = getMockNetworkMapWithMultipleChannels();
      const typologyResult: TypologyResult = { result: 50, id: '', cfg: '', ruleResults };

      mockedAxios.post.mockResolvedValue({ status: 200 });

      const result = await handleTransaction(expectedReq, networkMap, typologyResult);
      expect(result.msg).toEqual(`2 channels initiated for transaction ID: ${expectedReq.FIToFIPmtSts.GrpHdr.MsgId}`);
      expect(result.result).toEqual('{"Channel": 001@1.0, "Result":Incomplete},{"Channel": 002@1.0, "Result":Incomplete}');
    });

    it('should handle successful request, with a matched number', async () => {
      const expectedReq = getMockTransaction();

      const ruleResults: RuleResult[] = [{ result: true, id: '', cfg: '', subRuleRef: '', reason: '' }];
      const networkMap = getMockNetworkMap();
      const typologyResult: TypologyResult = { result: 50, id: '028@1.0', cfg: '028@1.0', ruleResults };

      mockedAxios.post.mockResolvedValue({ status: 200 });

      const result = await handleTransaction(expectedReq, networkMap, typologyResult);
      expect(result.msg).toEqual(`1 channels initiated for transaction ID: ${expectedReq.FIToFIPmtSts.GrpHdr.MsgId}`);
      expect(result.result).toEqual('{"Channel": 001@1.0, "Result":Complete}');
      expect(result.tadpReqBody).toBeDefined();
    });

    it('should handle successful request, have existing typology results already', async () => {
      const expectedReq = getMockTransaction();

      getJsonSpy = jest.spyOn(cacheService, 'getJson').mockImplementation((key: string): Promise<string> => {
        return new Promise<string>((resolve, reject) =>
          resolve(
            '[{"id":"028@1.0","cfg":"028@1.0","result":50,"ruleResults":[{"result":true,"id":"","cfg":"","subRuleRef":"","reason":""}]}]',
          ),
        );
      });

      const ruleResults: RuleResult[] = [{ result: true, id: '', cfg: '', subRuleRef: '', reason: '' }];
      const networkMap = getMockNetworkMapWithMultipleChannels();
      const typologyResult: TypologyResult = { result: 50, id: '028@1.0', cfg: '028@1.0', ruleResults };

      mockedAxios.post.mockResolvedValue({ status: 200 });

      const result = await handleTransaction(expectedReq, networkMap, typologyResult);
      expect(result.msg).toEqual(`2 channels initiated for transaction ID: ${expectedReq.FIToFIPmtSts.GrpHdr.MsgId}`);
      expect(result.result).toEqual('{"Channel": 001@1.0, "Result":Incomplete},{"Channel": 002@1.0, "Result":Incomplete}');
      expect(result.tadpReqBody).toBeUndefined();
    });

    it('should handle successful request, wrong axios post code', async () => {
      const expectedReq = getMockTransaction();

      const ruleResults: RuleResult[] = [{ result: true, id: '', cfg: '', subRuleRef: '', reason: '' }];
      const networkMap = getMockNetworkMap();
      const typologyResult: TypologyResult = { result: 50, id: '028@1.0', cfg: '028@1.0', ruleResults };

      mockedAxios.post.mockResolvedValue({ status: 201 });

      const result = await handleTransaction(expectedReq, networkMap, typologyResult);
      expect(result.msg).toEqual(`1 channels initiated for transaction ID: ${expectedReq.FIToFIPmtSts.GrpHdr.MsgId}`);
      expect(result.result).toEqual('{"Channel": 001@1.0, "Result":Complete}');
      expect(result.tadpReqBody).toBeDefined();
    });

    it('should handle successful request, axios post error', async () => {
      const expectedReq = getMockTransaction();

      const ruleResults: RuleResult[] = [{ result: true, id: '', cfg: '', subRuleRef: '', reason: '' }];
      const networkMap = getMockNetworkMap();
      const typologyResult: TypologyResult = { result: 50, id: '028@1.0', cfg: '028@1.0', ruleResults };

      mockedAxios.post.mockRejectedValue(new Error('Test Failure Path'));

      const result = await handleTransaction(expectedReq, networkMap, typologyResult);
      expect(result.msg).toEqual(`1 channels initiated for transaction ID: ${expectedReq.FIToFIPmtSts.GrpHdr.MsgId}`);
      expect(result.result).toEqual('{"Channel": 001@1.0, "Result":Complete}');
      expect(result.tadpReqBody).toBeDefined();
    });

    it('should handle successful request, cacheService error', async () => {
      getJsonSpy = jest.spyOn(cacheService, 'getJson').mockRejectedValue((key: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          resolve('');
        });
      });

      const expectedReq = getMockTransaction();

      const ruleResults: RuleResult[] = [{ result: true, id: '', cfg: '', subRuleRef: '', reason: '' }];
      const networkMap = getMockNetworkMap();
      const typologyResult: TypologyResult = { result: 50, id: '028@1.0', cfg: '028@1.0', ruleResults };

      mockedAxios.post.mockRejectedValue(new Error('Test Failure Path'));

      const result = await handleTransaction(expectedReq, networkMap, typologyResult);
      expect(result.msg).toEqual(`1 channels initiated for transaction ID: ${expectedReq.FIToFIPmtSts.GrpHdr.MsgId}`);
      expect(result.result).toEqual('{"Channel": 001@1.0, "Result":Error}');
      expect(result.tadpReqBody).toBeUndefined();
    });

    it('should handle successful request, not all results yet', async () => {
      const expectedReq = getMockTransaction();

      getJsonSpy = jest.spyOn(cacheService, 'getJson').mockImplementation((key: string): Promise<string> => {
        return new Promise<string>((resolve, reject) => resolve('[]'));
      });

      const ruleResults: RuleResult[] = [{ result: true, id: '', cfg: '', subRuleRef: '', reason: '' }];
      const networkMap = getMockNetworkMapWithMultipleChannels();
      const typologyResult: TypologyResult = { result: 50, id: '028@1.0', cfg: '028@1.0', ruleResults };

      mockedAxios.post.mockResolvedValue({ status: 200 });

      const result = await handleTransaction(expectedReq, networkMap, typologyResult);
      expect(result.msg).toEqual(`2 channels initiated for transaction ID: ${expectedReq.FIToFIPmtSts.GrpHdr.MsgId}`);
      expect(result.result).toEqual('{"Channel": 001@1.0, "Result":Incomplete},{"Channel": 002@1.0, "Result":Incomplete}');
      expect(result.tadpReqBody).toBeUndefined();
    });
  });
});
