/**
 * Turn `--flag value` arguments into an operation's input, using the
 * operation's own zod schema to decide how each value is read.
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { Operation } from './operations.js';

export class UsageError extends Error {}

type Kind = 'string' | 'number' | 'boolean' | 'json';

/** Look through optional/default/refinement wrappers to the underlying type. */
function kindOf(schema: z.ZodTypeAny): Kind {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return kindOf(schema.unwrap());
  }
  if (schema instanceof z.ZodDefault) return kindOf(schema.removeDefault());
  if (schema instanceof z.ZodEffects) return kindOf(schema.innerType());
  if (schema instanceof z.ZodString) return 'string';
  if (schema instanceof z.ZodNumber) return 'number';
  if (schema instanceof z.ZodBoolean) return 'boolean';
  return 'json';
}

export const toFlag = (field: string): string => `--${field.replaceAll('_', '-')}`;
export const toCommand = (operationName: string): string => operationName.replaceAll('_', '-');

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new UsageError(`${what} is not valid JSON`);
  }
}

function readValue(kind: Exclude<Kind, 'boolean'>, flag: string, value: string | undefined) {
  if (value === undefined) throw new UsageError(`${flag} needs a value`);
  if (kind === 'string') return value;
  if (kind === 'json') return parseJson(value, flag);
  const n = Number(value);
  if (value.trim() === '' || Number.isNaN(n)) throw new UsageError(`${flag} needs a number`);
  return n;
}

/** `--input file.json` (or `-` for stdin) supplies the whole input object. */
function readInputFile(path: string | undefined): Record<string, unknown> {
  if (path === undefined) throw new UsageError('--input needs a file path, or - for stdin');
  const parsed = parseJson(readFileSync(path === '-' ? 0 : path, 'utf8'), '--input');
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new UsageError('--input must hold a JSON object');
  }
  return parsed as Record<string, unknown>;
}

/** Flags win over `--input`. Unknown flags are an error, not ignored. */
export function parseArgs(op: Operation, argv: string[]): Record<string, unknown> {
  const fields = new Map(Object.keys(op.input).map((field) => [toFlag(field), field]));
  let fromFile: Record<string, unknown> = {};
  const fromFlags: Record<string, unknown> = {};

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i] as string;
    if (flag === '--input') {
      fromFile = readInputFile(argv[++i]);
      continue;
    }
    const negated = flag.startsWith('--no-') ? `--${flag.slice(5)}` : null;
    const field = fields.get(flag) ?? (negated ? fields.get(negated) : undefined);
    if (!field) throw new UsageError(`Unknown option ${flag} for ${toCommand(op.name)}`);

    const kind = kindOf(op.input[field] as z.ZodTypeAny);
    if (kind === 'boolean') {
      fromFlags[field] = fields.has(flag);
    } else if (!fields.has(flag)) {
      throw new UsageError(`${flag}: only true/false options can be negated`);
    } else {
      fromFlags[field] = readValue(kind, flag, argv[++i]);
    }
  }
  return { ...fromFile, ...fromFlags };
}

/** True for a true/false option that is on unless switched off. */
function defaultsToTrue(schema: z.ZodTypeAny): boolean {
  return schema instanceof z.ZodDefault && schema._def.defaultValue() === true;
}

function describeField(field: string, schema: z.ZodTypeAny): string {
  const kind = kindOf(schema);
  const flag = defaultsToTrue(schema) ? `--no-${toFlag(field).slice(2)}` : toFlag(field);
  const value = kind === 'boolean' ? '' : kind === 'json' ? ' <json>' : ` <${kind}>`;
  const required = schema.isOptional() ? '' : ' (required)';
  const text = schema.description ? `  ${schema.description}` : '';
  return `  ${flag}${value}${required}${text}`;
}

export function operationHelp(op: Operation): string {
  const fields = Object.entries(op.input).map(([f, s]) => describeField(f, s as z.ZodTypeAny));
  return [
    `cheapskate-cli ${toCommand(op.name)} [options]`,
    '',
    op.description,
    '',
    'Options:',
    ...fields,
    '  --input <file|->  Read the whole input as a JSON object; flags override it.',
  ].join('\n');
}

export function topLevelHelp(operations: Operation[], envNames: string[]): string {
  const width = Math.max(...operations.map((op) => op.name.length));
  const lines = operations.map(
    (op) =>
      `  ${toCommand(op.name).padEnd(width)}  ${op.writes ? '[writes] ' : ''}${op.description}`,
  );
  return [
    'cheapskate-cli <command> [options]',
    '',
    'Commands:',
    ...lines,
    '',
    `Environment: ${envNames.join(', ')}`,
    'Run a command with --help for its options. Output is JSON on stdout.',
  ].join('\n');
}
