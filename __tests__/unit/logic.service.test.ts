import axios from 'axios';
import { Callback, RedisClient } from 'redis';
import { CustomerCreditTransferInitiation } from '../../src/classes/iPain001Transaction';
import { NetworkMap } from '../../src/classes/network-map';
import { RuleResult } from '../../src/classes/rule-result';
import { TypologyResult } from '../../src/classes/typology-result';
import { handleTransaction } from '../../src/services/logic.service';
import { resolve } from 'path';
import { cacheService } from '../../src';
import { randomUUID } from 'crypto';

const getMockTransaction = () => {
  const quote = new CustomerCreditTransferInitiation(
    JSON.parse(
      `{"GroupHeader":{"InitiatingParty":{"Name":"\'ABDAL-MALIK","Identification":{"Identification":"","Other":{"Identification":"","SchemeName":{"Proprietary":""},"PrivateIdentification":{"DateAndPlaceOfBirth":{"Birthdate":"2021-06-25","ProvinceOfBirth":"Uknown","CityOfBirth":"","CountryOfBirth":"ZAR"}},"ContactDetails":{"MobileNumber":""}},"SchemeName":{"Proprietary":""},"PrivateIdentification":{"DateAndPlaceOfBirth":{"Birthdate":"2021-06-25","ProvinceOfBirth":"Uknown","CityOfBirth":"","CountryOfBirth":"ZAR"}},"ContactDetails":{"MobileNumber":"+277-23748020"}}}},"PaymentInformation":{"PaymentInformationIdentification":"ABC123","CreditTransferTransactionInformation":{"PaymentIdentification":{"EndToEndIdentification":"${randomUUID()}"},"CreditorAccount":{"Identification":{"Identification":"","Other":{"Identification":"+27723748019","SchemeName":{"Proprietary":"MSISDN"},"PrivateIdentification":{"DateAndPlaceOfBirth":{"Birthdate":"2021-06-25","ProvinceOfBirth":"Uknown","CityOfBirth":"","CountryOfBirth":"ZAR"}},"ContactDetails":{"MobileNumber":""}},"SchemeName":{"Proprietary":""},"PrivateIdentification":{"DateAndPlaceOfBirth":{"Birthdate":"2021-06-25","ProvinceOfBirth":"Uknown","CityOfBirth":"","CountryOfBirth":"ZAR"}},"ContactDetails":{"MobileNumber":"+277-23748019"}},"Proxy":"","Name":""},"CreditorAgent":{"FinancialInstitutionIdentification":{"ClearingSystemMemberIdentification":{"MemberIdentification":"bank1"}}},"Creditor":{"Name":"\'ABDAL-MALIK","Identification":{"Identification":"","Other":{"Identification":"","SchemeName":{"Proprietary":""},"PrivateIdentification":{"DateAndPlaceOfBirth":{"Birthdate":"2021-06-25","ProvinceOfBirth":"Uknown","CityOfBirth":"","CountryOfBirth":"ZAR"}},"ContactDetails":{"MobileNumber":""}},"SchemeName":{"Proprietary":""},"PrivateIdentification":{"DateAndPlaceOfBirth":{"Birthdate":"1989-07-13","ProvinceOfBirth":"Uknown","CityOfBirth":"","CountryOfBirth":"ZAR"}},"ContactDetails":{"MobileNumber":""}}},"Amount":{"InstructedAmount":{},"EquivalentAmount":{"CurrencyOfTransfer":"USD","Amount":123.45}},"SupplementaryData":{"fees.currency":"USD","fees.amount":12.34},"PaymentTypeInformation":{"CategoryPurpose":{"Proprietary":"DEPOSIT"}},"RegulatoryReporting":{"Details":{"Code":"string"}},"RemittanceInformation":{"Structured":{"AdditionalRemittanceInformation":"string"}}},"DebtorAccount":{"Identification":{"Identification":"","Other":{"Identification":"+27723748020","SchemeName":{"Proprietary":"MSISDN"},"PrivateIdentification":{"DateAndPlaceOfBirth":{"Birthdate":"2021-06-25","ProvinceOfBirth":"Uknown","CityOfBirth":"","CountryOfBirth":"ZAR"}},"ContactDetails":{"MobileNumber":""}},"SchemeName":{"Proprietary":""},"PrivateIdentification":{"DateAndPlaceOfBirth":{"Birthdate":"2021-06-25","ProvinceOfBirth":"Uknown","CityOfBirth":"","CountryOfBirth":"ZAR"}},"ContactDetails":{"MobileNumber":""}},"Proxy":"string","Name":""},"DebtorAgent":{"FinancialInstitutionIdentification":{"ClearingSystemMemberIdentification":{"MemberIdentification":"string"}}},"Debtor":{"Name":"\'ABDAL-MALIK","Identification":{"Identification":"","Other":{"Identification":"","SchemeName":{"Proprietary":""},"PrivateIdentification":{"DateAndPlaceOfBirth":{"Birthdate":"2021-06-25","ProvinceOfBirth":"Uknown","CityOfBirth":"","CountryOfBirth":"ZAR"}},"ContactDetails":{"MobileNumber":""}},"SchemeName":{"Proprietary":""},"PrivateIdentification":{"DateAndPlaceOfBirth":{"Birthdate":"1989-07-13","ProvinceOfBirth":"Uknown","CityOfBirth":"","CountryOfBirth":"ZAR"}},"ContactDetails":{"MobileNumber":"+277-23748020"}}}},"SupplementaryData":{"payee.merchantClassificationCode":"merchCode","payer.merchantClassificationCode":"merchCode","transactionType.initiatorType":"CONSUMER","geoCode.latitude":"string","geoCode.longitude":"string"}}`,
    ),
  );
  return quote;
};
const getMockNetworkMap = () => {
  const jNetworkMap = JSON.parse(
    '{"transactions":[{"transaction_type":"pain.001.001.11","transaction_name":"CustomerCreditTransferInitiationV11","channels":[{"channel_id":"Fraud","channel_name":"Fraud","typologies":[{"typology_id":"Typology_29.1.0","typology_name":"Typology_29","typology_version":"1.0","rules":[{"rule_id":"UUIDv4","rule_name":"Rule_27_1.0","rule_version":"1.0"},{"rule_id":"UUIDv4","rule_name":"Rule_15_1.4","rule_version":"1.0"},{"rule_id":"UUIDv4","rule_name":"Rule_05_1.0","rule_version":"1.0"}]}]}]}]}',
  );
  const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
  return networkMap;
};
const getMockNetworkMapWithMultipleChannels = () => {
  const jNetworkMap = JSON.parse(
    '{"transactions":[{"transaction_type":"pain.001.001.11","transaction_name":"CustomerCreditTransferInitiationV11","channels":[{"channel_id":"Fraud","channel_name":"Fraud","typologies":[{"typology_id":"Typology_29.1.0","typology_name":"Typology_29","typology_version":"1.0","rules":[{"rule_id":"UUIDv4","rule_name":"Rule_27_1.0","rule_version":"1.0"},{"rule_id":"UUIDv4","rule_name":"Rule_15_1.4","rule_version":"1.0"},{"rule_id":"UUIDv4","rule_name":"Rule_05_1.0","rule_version":"1.0"}]}]},{"channel_id":"AML","channel_name":"AML","typologies":[{"typology_id":"Typology_30.1.0","typology_name":"Typology_30","typology_version":"1.0","rules":[{"rule_id":"UUIDv4","rule_name":"Rule_27_1.0","rule_version":"1.0"},{"rule_id":"UUIDv4","rule_name":"Rule_15_1.4","rule_version":"1.0"},{"rule_id":"UUIDv4","rule_name":"Rule_05_1.0","rule_version":"1.0"}]}]}]}]}',
  );
  const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
  return networkMap;
};

describe('Logic Service', () => {
  let postSpy: jest.SpyInstance;
  let getJsonSpy: jest.SpyInstance;
  let setJsonSpy: jest.SpyInstance;
  let deleteJsonSpy: jest.SpyInstance;
  beforeEach(() => {
    postSpy = jest.spyOn(axios, 'post').mockImplementation(async (url: string, data?: any) =>  {
      return new Promise((resolve, reject) => {
        resolve({ status: 200 });
      });
    });

    getJsonSpy = jest.spyOn(cacheService, 'getJson').mockImplementation((key: string): Promise<string> => {
      return new Promise<string>((resolve, reject) => resolve('{}'));
    });

    setJsonSpy = jest.spyOn(cacheService, 'setJson').mockImplementation((key: string): Promise<string> => {
      return new Promise<string>((resolve, reject) => resolve(''));
    });

    deleteJsonSpy = jest.spyOn(cacheService, 'deleteKey').mockImplementation((key: string): Promise<number> => {
      return new Promise<number>((resolve, reject) => resolve(0));
    });
  });

  describe('Handle Legacy Transaction', () => {
    it('should handle successful request, with a unmatched number', async () => {
      const expectedReq = getMockTransaction();

      const ruleResult: RuleResult[] = [{ result: true, rule: '001_Derived_account_age_payee' }];

      const networkMap = getMockNetworkMapWithMultipleChannels();
      const typologyResult: TypologyResult = { result: 50, typology: 'Typology_29.1.0' };

      const result = await handleTransaction(expectedReq, networkMap, ruleResult, typologyResult);
      expect(result.replace(/\s/g, '')).toEqual(
        `2 channels initiated for transaction ID: ${expectedReq.PaymentInformation.CreditTransferTransactionInformation.PaymentIdentification.EndToEndIdentification}, with the following results:
{"Channel": Fraud, "Result":Complete},{"Channel":AML,"Result":Complete}`.replace(/\s/g, ''),
      );
    });

    it('should handle successful request, with a matched number', async () => {
      const expectedReq = getMockTransaction();

      const ruleResult: RuleResult[] = [{ result: true, rule: '001_Derived_account_age_payee' }];
      const networkMap = getMockNetworkMap();
      const typologyResult: TypologyResult = { result: 50, typology: 'Typology_29.1.0' };
      const result = await handleTransaction(expectedReq, networkMap, ruleResult, typologyResult);
      expect(result.replace(/\s/g, '')).toEqual(
        `1 channels initiated for transaction ID: ${expectedReq.PaymentInformation.CreditTransferTransactionInformation.PaymentIdentification.EndToEndIdentification}, with the following results:
{"Channel": Fraud, "Result":Complete}`.replace(/\s/g, ''),
      );
    });
  });
});
