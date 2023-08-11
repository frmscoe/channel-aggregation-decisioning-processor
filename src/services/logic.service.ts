/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { type Channel, type NetworkMap, type Pacs002 } from '@frmscoe/frms-coe-lib/lib/interfaces';
import apm from 'elastic-apm-node';
import { databaseManager, server } from '..';
import { type ChannelResult } from '../classes/channel-result';
import { TypologyResult } from '../classes/typology-result';
import { type ExecRequest, type TadpReqBody, type MetaData } from '../interfaces/types';
import { LoggerService } from './logger.service';

const calculateDuration = (startTime: bigint): number => {
  const endTime = process.hrtime.bigint();
  return Number(endTime - startTime);
};

const executeRequest = async (
  transaction: Pacs002,
  channel: Channel,
  networkMap: NetworkMap,
  typologyResult: TypologyResult,
  metaData: MetaData,
): Promise<ExecRequest> => {
  LoggerService.log('execute Request');
  const span = apm.startSpan('executeRequest');
  const startTime = process.hrtime.bigint();
  try {
    const transactionID = transaction.FIToFIPmtSts.GrpHdr.MsgId;
    const cacheKey = `CADP_${transactionID}_${channel.id}_${channel.cfg}`;
    const jtypologyResults = await databaseManager.addOneGetAll(cacheKey, JSON.stringify(typologyResult));
    const typologyResults: TypologyResult[] = [];
    if (jtypologyResults && jtypologyResults.length > 0) {
      for (const jtypologyResult of jtypologyResults) {
        const typoRes: TypologyResult = new TypologyResult();
        Object.assign(typoRes, JSON.parse(jtypologyResult));
        typologyResults.push(typoRes);
      }
    } else {
      LoggerService.error('typology results is empty');
      return {
        result: 'Error',
        tadpReqBody: undefined,
      };
    }
    LoggerService.trace('typology results is ok');

    // check if all results for this Channel is found
    if (typologyResults.length < channel.typologies.length) {
      LoggerService.warn('typology results are less than channel typologies');
      return {
        result: 'Incomplete',
        tadpReqBody: undefined,
      };
    }
    LoggerService.log('typologyResults is ok');

    // else means we have all results for Channel, so lets evaluate result

    // Keep scaffold here - this will be used in future.
    // const expressionRes = await arangoDBService.getExpression(channel.channel_id);
    // if (!expressionRes)
    //   return 0.0;

    const channelResult: ChannelResult = {
      prcgTm: calculateDuration(startTime),
      result: 0.0,
      cfg: channel.cfg,
      id: channel.id,
      typologyResult: typologyResults,
    };
    // Send TADP request with this all results - to be persisted at TADP
    const tadpReqBody: TadpReqBody = {
      transaction,
      networkMap,
      channelResult,
      metaData: { ...metaData, traceParent: apm.currentTraceparent },
    };
    const spanResp = apm.startSpan('tadp.handleResponse');
    LoggerService.log('handleResp');
    try {
      await server.handleResponse(tadpReqBody);
    } catch (error) {
      LoggerService.error('Error while sending Channel result to TADP', error as Error, 'executeRequest');
    } finally {
      spanResp?.end();
    }
    LoggerService.log('handled Resp');

    const spanDeleteCacheKey = apm.startSpan(`[${transactionID}] cache.delete.key`);
    await databaseManager.deleteKey(cacheKey);
    spanDeleteCacheKey?.end();
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
  const apmTransaction = apm.startTransaction('handleTransaction');
  const pacs002 = transaction.transaction as Pacs002;
  const networkMap = transaction.networkMap as NetworkMap;
  const typologyResult = transaction.typologyResult as TypologyResult;
  const metaData = transaction?.metaData as MetaData;

  let channelCounter = 0;
  const toReturn = [];
  const tadProc = [];
  let channelRes;
  for (const channel of networkMap.messages[0].channels.filter((c) =>
    c.typologies.some((t) => t.id === typologyResult.id && t.cfg === typologyResult.cfg),
  )) {
    channelCounter++;
    LoggerService.log(`Channel[${channelCounter}] executing request`);
    const traceParent = metaData?.traceParent ?? undefined;
    const apmTransaction = apm.startTransaction(`cadproc.exec.${channel.id}`, {
      childOf: traceParent,
    });
    LoggerService.trace(`traceParent: ${JSON.stringify(traceParent)}`);
    channelRes = await executeRequest(pacs002, channel, networkMap, typologyResult, metaData);
    apmTransaction?.end();
    toReturn.push(`{"Channel": ${channel.id}, "Result":${JSON.stringify(channelRes.result)}}`);
    tadProc.push({ tadProc: channelRes.tadpReqBody });
  }
  apmTransaction?.end();
};
