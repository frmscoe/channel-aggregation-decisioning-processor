/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import apm from '../apm';
import { type Channel, type NetworkMap, type Pacs002 } from '@frmscoe/frms-coe-lib/lib/interfaces';
import { type ChannelResult } from '@frmscoe/frms-coe-lib/lib/interfaces/processor-files/ChannelResult';
import { TypologyResult } from '@frmscoe/frms-coe-lib/lib/interfaces/processor-files/TypologyResult';
import { databaseManager, loggerService, server } from '..';
import { type ExecRequest, type MetaData, type TadpReqBody } from '../interfaces/types';

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
  let span;
  const startTime = process.hrtime.bigint();
  try {
    const transactionID = transaction.FIToFIPmtSts.GrpHdr.MsgId;
    const cacheKey = `CADP_${transactionID}_${channel.id}_${channel.cfg}`;
    const jtypologyCount = await databaseManager.addOneGetCount(cacheKey, JSON.stringify(typologyResult));

    // check if all results for this Channel is found
    if (jtypologyCount && jtypologyCount < channel.typologies.length) {
      return {
        result: 'Incomplete',
        tadpReqBody: undefined,
      };
    }

    // else means we have all results for Channel, so lets evaluate result
    const jtypologyResults = await databaseManager.getMembers(`${cacheKey}`);
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
      metaData: { ...metaData, traceParent: apm.getCurrentTraceparent() },
    };
    const apmTadProc = apm.startSpan('tadProc.exec');
    try {
      await server.handleResponse(tadpReqBody);
    } catch (error) {
      loggerService.error('Error while sending Channel result to TADP', error as Error, 'executeRequest');
    }
    apmTadProc?.end();
    span = apm.startSpan(`[${transactionID}] Delete Typology interim cache key`);
    await databaseManager.deleteKey(cacheKey);
    span?.end();
    return {
      result: 'Complete',
      tadpReqBody,
    };
  } catch (error) {
    span?.end();
    loggerService.error(`Failed to process Channel ${channel.id} request`, error as Error, 'executeRequest');
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
  const metaData = transaction?.metaData as MetaData;

  let channelCounter = 0;
  const toReturn = [];
  const tadProc = [];
  let channelRes;
  for (const channel of networkMap.messages[0].channels.filter((c) =>
    c.typologies.some((t) => t.id === typologyResult.id && t.cfg === typologyResult.cfg),
  )) {
    channelCounter++;
    loggerService.log(`Channel[${channelCounter}] executing request`);
    const traceParent = metaData?.traceParent ?? undefined;
    const apmTransaction = apm.startTransaction(`cadproc.exec.${channel.id}`, {
      childOf: traceParent,
    });
    channelRes = await executeRequest(pacs002, channel, networkMap, typologyResult, metaData);
    apmTransaction?.end();
    toReturn.push(`{"Channel": ${channel.id}, "Result":${JSON.stringify(channelRes.result)}}`);
    tadProc.push({ tadProc: channelRes.tadpReqBody });
  }
};
