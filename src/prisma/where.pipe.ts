import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import parseObjectLiteral from '../helpers/parse-object-literal';
import { Pipes } from '../../index';

const parseStringTo = (ruleValue: string) => {
  if (ruleValue.endsWith(')')) {
    if (ruleValue.startsWith('int(')) {
      const arr = /\(([^)]+)\)/.exec(ruleValue);

      if (arr && arr[1]) {
        return parseInt(arr[1], 10);
      }
    }

    if (
      ruleValue.startsWith('date(') || ruleValue.startsWith('datetime(')
    ) {
      const arr = /\(([^)]+)\)/.exec(ruleValue);

      if (arr && arr[1]) {
        return new Date(arr[1]).toISOString();
      }
    }

    if (ruleValue.startsWith('float(')) {
      const arr = /\(([^)]+)\)/.exec(ruleValue);

      if (arr && arr[1]) {
        return parseFloat(arr[1]);
      }
    }

    if (ruleValue.startsWith('string(')) {
      const arr = /\(([^)]+)\)/.exec(ruleValue);

      if (arr && arr[1]) {
        return arr[1];
      }
    }
    if (
      ruleValue.startsWith('boolean(') || ruleValue.startsWith('bool(')
    ) {
      const arr = /\(([^)]+)\)/.exec(ruleValue);

      if (arr && arr[1]) {
        return arr[1] === 'true';
      }
    }
  }

  return ruleValue;
};

const parseValue = (ruleValue: string) => {
  if (ruleValue.startsWith('array(')) {
    const validRegExec = /\(([^]+)\)/.exec(ruleValue);

    if (validRegExec) {
      return validRegExec[1]
        .split(',')
        .map((value) => parseStringTo(value));
    }
  }

  return parseStringTo(ruleValue);
};

const extraRuleArgs = (rule: string, data: Record<string, any>): Record<string, any> => {
  if (
    ['contains', 'startsWith', 'endsWith'].some((value) => value === rule)
  ) {
    return {
      ...data,
      mode: 'insensitive',
    };
  }

  return data;
}

/**
 * @description Convert a string like
 * @example "id: int(1), firstName: banana" to { id: 1, firstName: "banana" }
 * */
@Injectable()
export default class WherePipe implements PipeTransform {
  transform(value: string): Pipes.Where | undefined {
    if (value == null) return undefined;
    try {
      const rules = parseObjectLiteral(value);
      const items: Record<string, any> = {};

      rules.forEach((rule: any) => {
        const ruleKey = rule[0];
        const ruleValue = parseValue(rule[1]);

        [
          'lt',
          'lte',
          'gt',
          'gte',
          'equals',
          'not',
          'contains',
          'startsWith',
          'endsWith',
          'every',
          'some',
          'none',
          'in'
        ].forEach((val) => {
          if (rule[1].startsWith(`${val} `) && typeof ruleValue === 'string') {
            const data: Record<string, any> = {};

            data[val] = parseValue(ruleValue.replace(`${val} `, ''));

            if (
              typeof data[val] === 'string'
              && data[val].includes(':')
              && !data[val].endsWith(':')
              // is Date
              && !/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)((-(\d{2}):(\d{2})|Z)?)/.test(data[val])
            ) {
              const record: Record<string, any> = {};

              record[data[val].split(':')[0].trim()] = data[val]
                .split(':')[1]
                .trim();
              data[val] = record;
            }

            const updatedData = extraRuleArgs(val, data);
            items[ruleKey] = updatedData;
          }
        });

        if (ruleValue != null && ruleValue !== '') {
          items[ruleKey] = items[ruleKey] || ruleValue;
        }
      });

      return items;
    } catch (error) {
      throw new BadRequestException('Invalid query format');
    }
  }
}
