import { Context, Next } from 'koa';
import { TypologyResult } from '../classes/typology-result';
import { handleTransaction } from '../services/logic.service';
import { NetworkMap, Pacs002 } from '@frmscoe/frms-coe-lib/lib/interfaces';

export const execute = async (ctx: Context, next: Next): Promise<void | Context> => {
  const transaction = ctx.request.body.transaction as Pacs002;
  const networkMap = ctx.request.body.networkMap as NetworkMap;
  const typologyResult = ctx.request.body.typologyResult as TypologyResult;

  const result = await handleTransaction(transaction, networkMap, typologyResult);

  ctx.body = result;
  ctx.status = 200;
  await next();
  return ctx;
};
