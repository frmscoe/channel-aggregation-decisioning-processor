import { Context, Next } from "koa";
import { CustomerCreditTransferInitiation } from "../classes/iPain001Transaction";
import { NetworkMap } from "../classes/network-map";
import { RuleResult } from "../classes/rule-result";
import { TypologyResult } from "../classes/typology-result";
import { handleTransaction } from "../services/logic.service";

export const execute = async (ctx: Context, next: Next): Promise<void | Context> => {
    const reqBody = ctx.request.body as Record<string, unknown>;
    const req = reqBody.transaction as CustomerCreditTransferInitiation;
    const networkMap = reqBody.networkMap as NetworkMap;
    const ruleResult = reqBody.ruleResults as RuleResult[];
    const typologyResult = reqBody.typologyResult as TypologyResult;

    const result = await handleTransaction(req, networkMap, ruleResult, typologyResult);

    ctx.body = result;
    ctx.status = 200;
    await next();
    return ctx;
}