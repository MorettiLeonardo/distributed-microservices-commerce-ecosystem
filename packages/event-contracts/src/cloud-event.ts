import { z } from 'zod';

/** CloudEvents 1.0 envelope (STYLE_GUIDE §8), shared by events and commands. */
const Envelope = z.object({
  specversion: z.literal('1.0'),
  /** Unique per message: consumers deduplicate by it. */
  id: z.string().min(1),
  source: z.string().min(1),
  type: z.string().min(1),
  time: z.iso.datetime(),
  datacontenttype: z.literal('application/json'),
  subject: z.string().optional(),
  correlationid: z.string().optional(),
});

/** Schema of one message type: the envelope with a fixed `type` and a typed `data`. */
export function cloudEventSchema<TType extends string, TData extends z.ZodType>(
  type: TType,
  data: TData,
) {
  return Envelope.extend({ type: z.literal(type), data });
}

export type CloudEventInput<TType extends string, TData> = {
  id: string;
  source: string;
  type: TType;
  time: Date;
  data: TData;
  subject?: string;
  correlationId?: string;
};

/** Builds the envelope; producers pass ids and time (no hidden clock or id generation here). */
export function createCloudEvent<TType extends string, TData>(
  input: CloudEventInput<TType, TData>,
) {
  return {
    specversion: '1.0' as const,
    id: input.id,
    source: input.source,
    type: input.type,
    time: input.time.toISOString(),
    datacontenttype: 'application/json' as const,
    ...(input.subject !== undefined && { subject: input.subject }),
    ...(input.correlationId !== undefined && { correlationid: input.correlationId }),
    data: input.data,
  };
}
