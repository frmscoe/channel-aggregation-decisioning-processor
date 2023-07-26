import { type ChannelResult } from '../classes/channel-result';
import { type NetworkMap, type Pacs002 } from '@frmscoe/frms-coe-lib/lib/interfaces';

export interface TadpReqBody {
  transaction: Pacs002;
  networkMap: NetworkMap;
  channelResult: ChannelResult;
  metaData?: { prcgTmDp: number; prcgTmCRSP: number };
}

export interface Result {
  msg: string | undefined;
  result: string;
  tadpReqBody: TadpReqBody | undefined;
}

export interface ExecRequest {
  result: string | undefined;
  tadpReqBody: TadpReqBody | undefined;
}

export interface MetaData {
  prcgTmDp: number;
  prcgTmCRSP: number;
}
