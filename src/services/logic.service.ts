import { config } from '../config';
import { LoggerService } from './logger.service';
import { IPain001Message } from '../interfaces/iPain001';
import { Channel, NetworkMap } from '../classes/network-map';
import { RuleResult } from '../classes/rule-result';
import { TypologyResult } from '../classes/typology-result';
import { ChannelResult } from '../classes/channel-result';
import axios from 'axios';
import apm from 'elastic-apm-node';
import { cacheService } from '..';

const executeRequest = async (
  request: IPain001Message,
  channel: Channel,
  ruleResults: RuleResult[],
  networkMap: NetworkMap,
  typologyResult: TypologyResult,
): Promise<string> => {
  // Have to manually start transaction because we are not making use of one of the out-of-the-box solutions (eg, express / koa server)
  let span;
  try {
    const transactionID = request.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.PmtId.EndToEndId;
    const cacheKey = `${transactionID}_${channel.id}`;
    const jtypologyResults = await cacheService.getJson(cacheKey);
    const typologyResults: TypologyResult[] = [];

    if (jtypologyResults && jtypologyResults.length > 0) Object.assign(typologyResults, JSON.parse(jtypologyResults));

    if (typologyResults.some((t) => t.typology === typologyResult.typology)) return 'Incomplete';

    typologyResults.push({ typology: typologyResult.typology, result: typologyResult.result });
    // check if all results for this Channel is found
    if (typologyResults.length < channel.typologies.length) {
      span = apm.startSpan(`[${transactionID}] Save Channel interim rule results to Cache`);
      await cacheService.setJson(cacheKey, JSON.stringify(typologyResults));
      span?.end();
      return 'Incomplete';
    }
    // else means we have all results for Channel, so lets evaluate result

    // Keep scaffold here - this will be used in future.
    // const expressionRes = await arangoDBService.getExpression(channel.channel_id);
    // if (!expressionRes)
    //   return 0.0;

    const channelResult: ChannelResult = { result: 0.0, channel: channel.id };
    // Send TADP request with this all results - to be persisted at TADP
    try {
      const tadpReqBody = {
        transaction: request,
        ruleResults: ruleResults,
        typologyResult: typologyResults,
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
    return 'Complete';
  } catch (error) {
    span?.end();
    LoggerService.error(`Failed to process Channel ${channel.id} request`, error as Error, 'executeRequest');
    return 'Error';
  }
};

export const handleTransaction = async (
  req: IPain001Message,
  networkMap: NetworkMap,
  ruleResult: RuleResult[],
  typologyResult: TypologyResult,
): Promise<string> => {
  let channelCounter = 0;
  const toReturn = [];
  for (const channel of networkMap.messages[0].channels) {
    channelCounter++;
    const channelRes = await executeRequest(req, channel, ruleResult, networkMap, typologyResult);
    toReturn.push(`{"Channel": ${channel.id}, "Result":${channelRes}}`);
  }

  const result = `${channelCounter} channels initiated for transaction ID: ${req.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.PmtId.EndToEndId}, with the following results:\r\n${toReturn}`;
  LoggerService.log(result);
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
