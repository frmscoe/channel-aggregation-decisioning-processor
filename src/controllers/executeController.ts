import { Context, Next } from 'koa';
import { IPain001Message } from '../interfaces/iPain001';
import { NetworkMap } from '../classes/network-map';
import { RuleResult } from '../classes/rule-result';
import { TypologyResult } from '../classes/typology-result';
import { handleTransaction } from '../services/logic.service';

export const execute = async (ctx: Context, next: Next): Promise<void | Context> => {
  const reqBody = ctx.request.body as Record<string, unknown>;
  const req = reqBody.transaction as IPain001Message;
  const networkMap = reqBody.networkMap as NetworkMap;
  const typologyResult = reqBody.typologyResult as TypologyResult;

  const result = await handleTransaction(req, networkMap, typologyResult);

  ctx.body = result;
  ctx.status = 200;
  await next();
  return ctx;
};
