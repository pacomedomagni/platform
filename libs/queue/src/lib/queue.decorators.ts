import { SetMetadata } from '@nestjs/common';
import { QUEUE_PROCESSOR_METADATA, QUEUE_JOB_METADATA } from './queue.types';

export interface ProcessorOptions {
  queueName: string;
  concurrency?: number;
}

export interface JobHandlerOptions {
  name: string;
}

/**
 * Decorator to mark a class as a queue processor
 * @param options - Queue processor options
 */
export function Processor(options: ProcessorOptions): ClassDecorator {
  return SetMetadata(QUEUE_PROCESSOR_METADATA, options);
}

/**
 * Decorator to mark a method as a job handler
 * @param options - Job handler options (name should match the job name)
 */
export function JobHandler(options: JobHandlerOptions): MethodDecorator {
  return SetMetadata(QUEUE_JOB_METADATA, options);
}

/**
 * Decorator to mark a method as the default handler for unmatched jobs
 */
export function DefaultHandler(): MethodDecorator {
  return SetMetadata(QUEUE_JOB_METADATA, { name: '__default__' });
}
