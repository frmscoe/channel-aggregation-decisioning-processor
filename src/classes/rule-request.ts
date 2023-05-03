import { Pacs002 } from '@frmscoe/frms-coe-lib/lib/interfaces';
import { Typology } from './network-map';

export class RuleRequest {
  transaction: Pacs002;
  typologies: Array<Typology>;
  constructor(transaction: Pacs002, typologies: Array<Typology>) {
    this.transaction = transaction;
    this.typologies = typologies;
  }
}
