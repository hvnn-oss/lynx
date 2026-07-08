import type { EventEntity } from '@repo/database';
import type { EventPayload, LynxRiskLevel } from '../types/debug-event.types';

export const isRecord = (value: unknown): value is EventPayload =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const getPayload = (event?: EventEntity): EventPayload =>
  event && isRecord(event.payload) ? event.payload : {};

export const getPayloadString = (
  payload: EventPayload,
  key: string,
): string | undefined => {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
};

export const getPayloadNumber = (
  payload: EventPayload,
  key: string,
): number | undefined => {
  const value = payload[key];
  return typeof value === 'number' ? value : undefined;
};

export const getPayloadBoolean = (
  payload: EventPayload,
  key: string,
): boolean | undefined => {
  const value = payload[key];
  return typeof value === 'boolean' ? value : undefined;
};

export const getPayloadRiskLevel = (
  payload: EventPayload,
  key: string,
): LynxRiskLevel | undefined => {
  const value = payload[key];
  return value === 'LOW' ||
    value === 'MEDIUM' ||
    value === 'HIGH' ||
    value === 'CRITICAL'
    ? value
    : undefined;
};
