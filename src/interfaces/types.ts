import { NetworkMap } from '../classes/network-map';
import { ChannelResult } from '../classes/channel-result';
import { Pacs002 } from '@frmscoe/frms-coe-lib/lib/interfaces';

export type TadpReqBody = {
  transaction: Pacs002;
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
