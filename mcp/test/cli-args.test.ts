import { describe, expect, it } from 'vitest';
import { operationHelp, parseArgs, toCommand, UsageError } from '../src/cli-args.js';
import { findOperation, OPERATIONS } from '../src/operations.js';

const op = (name: string) => {
  const found = findOperation(name);
  if (!found) throw new Error(`no operation ${name}`);
  return found;
};

describe('parseArgs', () => {
  it('reads strings, numbers, booleans and JSON by the schema, not by guessing', () => {
    const input = parseArgs(op('create_account'), [
      '--name',
      'Roth IRA',
      '--last4',
      '0042',
      '--no-in-portfolio',
      '--allow-duplicate-name',
    ]);
    expect(input).toEqual({
      name: 'Roth IRA',
      last4: '0042',
      in_portfolio: false,
      allow_duplicate_name: true,
    });
  });

  it('parses a holdings array given as JSON', () => {
    const holdings = [{ name: 'VTI', ticker: 'VTI', quantity: 1, price: 2 }];
    const input = parseArgs(op('record_statement'), [
      '--account-id',
      '3',
      '--effective-date',
      '2026-10-31',
      '--dry-run',
      '--holdings',
      JSON.stringify(holdings),
    ]);
    expect(input).toEqual({ account_id: 3, effective_date: '2026-10-31', dry_run: true, holdings });
  });

  it('refuses an unknown option', () => {
    expect(() => parseArgs(op('list_accounts'), ['--verbose'])).toThrow(UsageError);
  });

  it('refuses a non-numeric value for a number', () => {
    expect(() => parseArgs(op('undo_update'), ['--update-id', 'abc'])).toThrow(/number/);
  });

  it('refuses a flag with no value', () => {
    expect(() => parseArgs(op('undo_update'), ['--update-id'])).toThrow(/needs a value/);
  });
});

describe('help', () => {
  it('shows an on-by-default option in the form that switches it off', () => {
    const help = operationHelp(op('record_statement'));
    expect(help).toContain('--no-mark-missing-as-sold');
    expect(help).not.toMatch(/ --mark-missing-as-sold/);
    expect(help).toContain(' --dry-run');
  });

  it('lists every field of every operation', () => {
    for (const operation of OPERATIONS) {
      const help = operationHelp(operation);
      expect(help).toContain(toCommand(operation.name));
      for (const field of Object.keys(operation.input)) {
        expect(help).toContain(field.replaceAll('_', '-'));
      }
    }
  });
});
