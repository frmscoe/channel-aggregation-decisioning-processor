import http from 'http';
import { config } from '../config';
import { LoggerService } from './logger.service';
import { CustomerCreditTransferInitiation } from '../classes/iPain001Transaction';
import { Channel, NetworkMap, Rule, Typology } from '../classes/network-map';
import { redisSetJson, redisGetJson, redisDeleteKey } from '../clients/redis.client';
import { RuleResult } from '../classes/rule-result';
import { TypologyResult } from '../classes/typology-result';
import apm from 'elastic-apm-node';
import { Context, Next } from 'koa';
import { ChannelResult } from '../classes/channel-result';

const executeRequest = async (
  request: CustomerCreditTransferInitiation,
  channel: Channel,
  ruleResults: RuleResult[],
  networkMap: NetworkMap,
  typologyResult: TypologyResult,
): Promise<string> => {
  // Have to manually start transaction because we are not making use of one of the out-of-the-box solutions (eg, express / koa server)
  let span;
  try {
    const transactionID = request.PaymentInformation.CreditTransferTransactionInformation.PaymentIdentification.EndToEndIdentification;
    const cacheKey = `${transactionID}_${channel.channel_id}`;
    const jtypologyResults = await redisGetJson(cacheKey);
    const typologyResults: TypologyResult[] = [];

    if (jtypologyResults && jtypologyResults.length > 0)
      Object.assign(typologyResults, JSON.parse(jtypologyResults));

    if (typologyResults.some(t => t.typology === typologyResult.typology))
      return 'Incomplete';

    typologyResults.push({ typology: typologyResult.typology, result: typologyResult.result });

    // check if all results for this Channel is found
    if (typologyResults.length < channel.typologies.length) {
      span = apm.startSpan(`[${transactionID}] Save Channel interim rule results to Cache`);
      await redisSetJson(cacheKey, JSON.stringify(typologyResults));
      span?.end();
      return 'Incomplete';
    }
    // else means we have all results for Channel, so lets evaluate result

    // Keep scaffold here - this will be used in future.
    // const expressionRes = await arangoDBService.getExpression(channel.channel_id);
    // if (!expressionRes)
    //   return 0.0;

    const channelResult: ChannelResult = { result: 0.0, channel: channel.channel_id };
    // Send TADP request with this all results - to be persisted at TADP
    try {
      const tadpReqBody = `{"ruleResults":${JSON.stringify(ruleResults)}}, "typologyResults":${JSON.stringify(
        typologyResults,
      )}, "channelResult": ${JSON.stringify(channelResult)}, "transaction":${JSON.stringify(request)}, "networkMap":${JSON.stringify(
        networkMap,
      )}}`;
      const toSend = Buffer.from(JSON.stringify(tadpReqBody)).toString('base64');
      span = apm.startSpan(`[${transactionID}] Send Channel result to TADP`);
      await executePost(config.tadpEndpoint, toSend);
      span?.end();
    } catch (error) {
      span?.end();
      LoggerService.error('Error while sending Channel result to TADP', error, 'executeRequest');
    }
    span = apm.startSpan(`[${transactionID}] Delete Typology interim cache key`);
    await redisDeleteKey(cacheKey);
    span?.end();
    return 'Complete';
  } catch (error) {
    span?.end();
    LoggerService.error(`Failed to process Channel ${channel.channel_id} request`, error, 'executeRequest');
    return 'Error';
  }
};

export const handleTransaction = async (ctx: Context, next: Next): Promise<void | Context> => {
  const reqBody = ctx.request.body as Record<string, unknown>;
  const req = reqBody.transaction as CustomerCreditTransferInitiation;
  const networkMap = reqBody.networkMap as NetworkMap;
  const ruleResult = reqBody.ruleResults as RuleResult[];
  const typologyResult = reqBody.typologyResult as TypologyResult;

  let channelCounter = 0;
  const toReturn = [];
  for (const channel of networkMap.transactions[0].channels) {
    channelCounter++;
    const channelRes = await executeRequest(req, channel, ruleResult, networkMap, typologyResult);
    toReturn.push(`{"Channel": ${channel.channel_id}, "Result":${channelRes}}`);
  }

  const result = `${channelCounter} channels initiated for transaction ID: ${req.PaymentInformation.CreditTransferTransactionInformation.PaymentIdentification.EndToEndIdentification}, with the following results:\r\n${toReturn}`;
  LoggerService.log(result);
  ctx.body = result;
  ctx.status = 200;
  await next();
  return ctx;
};

// Submit the Channel result to the TADP
const executePost = (endpoint: string, request: string): Promise<void | Error> => {
  return new Promise((resolve) => {
    const options: http.RequestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': request.length,
      },
    };

    const req = http.request(endpoint, options, (res) => {
      LoggerService.log(`Rule response statusCode: ${res.statusCode}`);
      if (res.statusCode !== 200) {
        LoggerService.trace(`StatusCode != 200, request:\r\n${request}`);
      }

      res.on('data', (d) => {
        LoggerService.log(`TADP data: ${d.toString()}`);
        resolve();
      });
    });

    req.on('error', (error) => {
      LoggerService.error(`TADP Error data: ${error}`);
      LoggerService.trace(`Request:\r\n${request}`);
      resolve(error);
    });

    req.write(request);
    req.end();
  });
};
