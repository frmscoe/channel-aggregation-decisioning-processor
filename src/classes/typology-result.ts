import { RuleResult } from './rule-result';

export class TypologyResult {
  id = '';
  cfg = '';
  desc = '';
  result = 0.0;
  threshold = 0.0;
  ruleResults: RuleResult[] = [];
}
