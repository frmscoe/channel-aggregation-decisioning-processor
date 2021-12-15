import { IPain001Message } from '../interfaces/iPain001';
import { NetworkMap } from '../classes/network-map';
import { RuleResult } from '../classes/rule-result';
import { TypologyResult } from '../classes/typology-result';
import { ChannelResult } from '../classes/channel-result';

export type TadpReqBody = {
  transaction: IPain001Message;
  networkMap: NetworkMap;
  channelResult: ChannelResult;
};
export type Result = {
  msg: string | undefined;
  result: string;
  tadpReqBody: TadpReqBody | undefined;
};
export type ExecRequest = {
  result: string | undefined;
  tadpReqBody: TadpReqBody | undefined;
};
