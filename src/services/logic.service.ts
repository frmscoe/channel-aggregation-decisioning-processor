import { config } from '../config';
import { LoggerService } from './logger.service';
import { IPain001Message } from '../interfaces/iPain001';
import { Channel, NetworkMap } from '../classes/network-map';
import { RuleResult } from '../classes/rule-result';
import { TypologyResult } from '../classes/typology-result';
import { ChannelResult } from '../classes/channel-result';
import { Result, ExecRequest } from '../interfaces/types';
import axios from 'axios';
import apm from 'elastic-apm-node';
import { cacheService } from '..';

const executeRequest = async (
  request: IPain001Message,
  channel: Channel,
  //ruleResults: RuleResult[],
  networkMap: NetworkMap,
  typologyResult: TypologyResult,
): Promise<ExecRequest> => {
  // Have to manually start transaction because we are not making use of one of the out-of-the-box solutions (eg, express / koa server)
  let span;
  try {
    const transactionID = request.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.PmtId.EndToEndId;
    const cacheKey = `${transactionID}_${channel.id}_${channel.cfg}`;
    const jtypologyResults = await cacheService.getJson(cacheKey);
    const typologyResults: TypologyResult[] = [];
    if (jtypologyResults && jtypologyResults.length > 0) Object.assign(typologyResults, JSON.parse(jtypologyResults));

    if (!channel.typologies.some((t) => t.id === typologyResult.id && t.cfg === typologyResult.cfg))
      return {
        result: 'Incomplete',
        tadpReqBody: undefined,
      };

    if (typologyResults.some((t) => t.id === typologyResult.id && t.cfg === typologyResult.cfg))
      return {
        result: 'Incomplete',
        tadpReqBody: undefined,
      };

    typologyResults.push({ id: typologyResult.id, cfg: typologyResult.cfg, result: typologyResult.result, ruleResults: typologyResult.ruleResults });
    // check if all results for this Channel is found
    if (typologyResults.length < channel.typologies.length) {
      span = apm.startSpan(`[${transactionID}] Save Channel interim rule results to Cache`);
      await cacheService.setJson(cacheKey, JSON.stringify(typologyResults));
      span?.end();
      return {
        result: 'Incomplete',
        tadpReqBody: undefined,
      };
    }
    // else means we have all results for Channel, so lets evaluate result

    // Keep scaffold here - this will be used in future.
    // const expressionRes = await arangoDBService.getExpression(channel.channel_id);
    // if (!expressionRes)
    //   return 0.0;

    const channelResult: ChannelResult = { result: 0.0, cfg: channel.cfg, id: channel.id, typologyResult: typologyResults };
    // Send TADP request with this all results - to be persisted at TADP
    let tadpReqBody;
    try {
      tadpReqBody = {
        transaction: request,
        networkMap: networkMap,
        channelResult: channelResult,
      };
      span = apm.startSpan(`[${transactionID}] Send Channel result to TADP`);
      await executePost(config.tadpEndpoint, tadpReqBody);
      span?.end();
    } catch (error) {
      span?.end();
      LoggerService.error('Error while sending Channel result to TADP', error as Error, 'executeRequest');
    }
    span = apm.startSpan(`[${transactionID}] Delete Typology interim cache key`);
    await cacheService.deleteKey(cacheKey);
    span?.end();
    return {
      result: 'Complete',
      tadpReqBody,
    };
  } catch (error) {
    span?.end();
    LoggerService.error(`Failed to process Channel ${channel.id} request`, error as Error, 'executeRequest');
    return {
      result: 'Error',
      tadpReqBody: undefined,
    };
  }
};

export const handleTransaction = async (
  req: IPain001Message,
  networkMap: NetworkMap,
  //ruleResult: RuleResult[],
  typologyResult: TypologyResult,
): Promise<Result> => {
  let channelCounter = 0;
  const toReturn = [];
  const tadProc = [];
  let channelRes;
  for (const channel of networkMap.messages[0].channels) {
    channelCounter++;
    channelRes = await executeRequest(req, channel, networkMap, typologyResult);
    toReturn.push(`{"Channel": ${channel.id}, "Result":${channelRes.result}}`);
    tadProc.push({ tadProc: channelRes?.tadpReqBody });
  }
  let tadpReq = tadProc.map((element) => element.tadProc);

  const result = {
    msg: `${channelCounter} channels initiated for transaction ID: ${req.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.PmtId.EndToEndId}`,
    result: `${toReturn}`,
    tadpReqBody: tadpReq[0] || tadpReq[1],
  };
  tadpReq = [];
  LoggerService.log(result.msg);
  return result;
};

// Submit the Channel result to the TADP
const executePost = async (endpoint: string, request: any): Promise<void | Error> => {
  try {
    const res = await axios.post(endpoint, request);
    LoggerService.log(`TADP response statusCode: ${res.status}`);
    if (res.status !== 200) {
      LoggerService.trace(`Result from TADP StatusCode != 200, request:\r\n${request}`);
      LoggerService.error(`Error Code (${res.status}) from TADP with message: \r\n${res.data ?? '[NO MESSAGE]'}`);
    }
    LoggerService.log(`Success response from TADP with message: ${res.toString()}`);
  } catch (err) {
    LoggerService.error('Error while sending request to TADP', err);
    LoggerService.trace(`Error while sending request to TADP with Request:\r\n${request}`);
    throw Error(err as string);
  }
};
