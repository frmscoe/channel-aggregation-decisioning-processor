import { config } from '../config';
import { LoggerService } from './logger.service';
import { Channel, NetworkMap } from '../classes/network-map';
import { TypologyResult } from '../classes/typology-result';
import { ChannelResult } from '../classes/channel-result';
import { Result, ExecRequest, TadpReqBody } from '../interfaces/types';
import axios from 'axios';
import apm from 'elastic-apm-node';
import { cacheService, databaseManager } from '..';
import { Pacs002 } from '@frmscoe/frms-coe-lib/lib/interfaces';

const executeRequest = async (
  transaction: Pacs002,
  channel: Channel,
  networkMap: NetworkMap,
  typologyResult: TypologyResult,
): Promise<ExecRequest> => {
  let span;
  try {
    const transactionID = transaction.FIToFIPmtSts.GrpHdr.MsgId;
    const cacheKey = `CADP_${transactionID}_${channel.id}_${channel.cfg}`;
    const jtypologyResults = await cacheService.addOneGetAll(cacheKey, JSON.stringify(typologyResult));
    const typologyResults: TypologyResult[] = [];
    if (jtypologyResults && jtypologyResults.length > 0) {
      for (const jtypologyResult of jtypologyResults) {
        const typoRes: TypologyResult = new TypologyResult();
        Object.assign(typoRes, JSON.parse(jtypologyResult));
        typologyResults.push(typoRes);
      }
    }
    else
      return {
        result: 'Error',
        tadpReqBody: undefined,
      };


    // check if all results for this Channel is found
    if (typologyResults.length < channel.typologies.length) {
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
    const tadpReqBody: TadpReqBody = {
      transaction: transaction,
      networkMap: networkMap,
      channelResult: channelResult,
    };
    try {
      await executePost(config.tadpEndpoint, tadpReqBody);
    } catch (error) {
      LoggerService.error('Error while sending Channel result to TADP', error as Error, 'executeRequest');
      // return {
      //   result: 'Error',
      //   tadpReqBody: undefined,
      // };
    }
    span = apm.startSpan(`[${transactionID}] Delete Typology interim cache key`);
    await databaseManager.deleteKey(cacheKey);
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
  transaction: Pacs002,
  networkMap: NetworkMap,
  // ruleResult: RuleResult[],
  typologyResult: TypologyResult,
): Promise<Result> => {
  let channelCounter = 0;
  const toReturn = [];
  const tadProc = [];
  let channelRes;
  for (const channel of networkMap.messages[0].channels.filter(c => c.typologies.some(t => t.id === typologyResult.id && t.cfg === typologyResult.cfg))) {
    channelCounter++;
    LoggerService.log(`Channel[${channelCounter}] executing request`);
    channelRes = await executeRequest(transaction, channel, networkMap, typologyResult);
    toReturn.push(`{"Channel": ${channel.id}, "Result":${channelRes.result}}`);
    tadProc.push({ tadProc: channelRes.tadpReqBody });
  }
  let tadpReq = tadProc.map((element) => element.tadProc);
  const transactionID = transaction.FIToFIPmtSts.GrpHdr.MsgId;

  const result = {
    msg: `${channelCounter} channels initiated for transaction ID: ${transactionID}`,
    result: `${toReturn}`,
    tadpReqBody: tadpReq[0] || tadpReq[1],
  };
  tadpReq = [];
  LoggerService.log(`${result.msg} for Typology ${typologyResult.id}`);
  return result;
};

// Submit the Channel result to the TADP
const executePost = async (endpoint: string, request: TadpReqBody): Promise<void | Error> => {
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
