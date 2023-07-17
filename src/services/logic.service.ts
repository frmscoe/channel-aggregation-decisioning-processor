/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Channel, NetworkMap, Pacs002 } from '@frmscoe/frms-coe-lib/lib/interfaces';
import apm from 'elastic-apm-node';
import { cacheService, server } from '..';
import { ChannelResult } from '../classes/channel-result';
import { TypologyResult } from '../classes/typology-result';
import { ExecRequest, TadpReqBody } from '../interfaces/types';
import { LoggerService } from './logger.service';

const calculateDuration = (startHrTime: Array<number>, endHrTime: Array<number>): number => {
  return (endHrTime[0] - startHrTime[0]) * 1000 + (endHrTime[1] - startHrTime[1]) / 1000000;
};

interface MetaData {
  prcgTmDp: number;
  prcgTmCRSP: number;
}

const executeRequest = async (
  transaction: Pacs002,
  channel: Channel,
  networkMap: NetworkMap,
  typologyResult: TypologyResult,
  metaData: MetaData,
): Promise<ExecRequest> => {
  let span;
  const startHrTime = process.hrtime();
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
    } else
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

    const channelResult: ChannelResult = {
      prcgTm: calculateDuration(startHrTime, process.hrtime()),
      result: 0.0,
      cfg: channel.cfg,
      id: channel.id,
      typologyResult: typologyResults,
    };
    // Send TADP request with this all results - to be persisted at TADP
    const tadpReqBody: TadpReqBody = {
      transaction: transaction,
      networkMap: networkMap,
      channelResult: channelResult,
      metaData,
    };
    try {
      await server.handleResponse(tadpReqBody);
    } catch (error) {
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

/* eslint-disable @typescript-eslint/no-explicit-any */
export const handleTransaction = async (transaction: any): Promise<void> => {
  const pacs002 = transaction.transaction as Pacs002;
  const networkMap = transaction.networkMap as NetworkMap;
  const typologyResult = transaction.typologyResult as TypologyResult;
  const metaData = transaction?.MetaData as MetaData;

  let channelCounter = 0;
  const toReturn = [];
  const tadProc = [];
  let channelRes;
  for (const channel of networkMap.messages[0].channels.filter((c) =>
    c.typologies.some((t) => t.id === typologyResult.id && t.cfg === typologyResult.cfg),
  )) {
    channelCounter++;
    LoggerService.log(`Channel[${channelCounter}] executing request`);
    channelRes = await executeRequest(pacs002, channel, networkMap, typologyResult, metaData);
    toReturn.push(`{"Channel": ${channel.id}, "Result":${channelRes.result}}`);
    tadProc.push({ tadProc: channelRes.tadpReqBody });
  }
};
