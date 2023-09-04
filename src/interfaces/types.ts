import { type ChannelResult } from '@frmscoe/frms-coe-lib/lib/interfaces/processor-files/ChannelResult';
import { type NetworkMap, type Pacs002 } from '@frmscoe/frms-coe-lib/lib/interfaces';

export interface TadpReqBody {
  transaction: Pacs002;
  networkMap: NetworkMap;
  channelResult: ChannelResult;
  metaData?: MetaData;
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
  traceParent?: string | null;
}
