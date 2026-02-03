import { Injectable, Logger } from '@nestjs/common';
import { DocHooks } from './types';

@Injectable()
export class HookService {
    private readonly logger = new Logger(HookService.name);
    private hooks = new Map<string, DocHooks>();

    register(docType: string, hook: DocHooks) {
        this.logger.log(`Registering hooks for ${docType}`);
        const existing = this.hooks.get(docType) || {};
        this.hooks.set(docType, { ...existing, ...hook });
    }

    async trigger(docType: string, event: keyof DocHooks, doc: any, user: any) {
        const hook = this.hooks.get(docType);
        if (hook && hook[event]) {
            // this.logger.debug(`Triggering ${event} for ${docType}`);
            // If beforeSave (or others returning modified doc), we might capture result
            // For now, we assume mutation of 'doc' object or side effects
            const result = await hook[event]!(doc, user);
            // If the hook returns an object, we assume it's the mutated doc?
            // For simplicity in this architecture, let's rely on pass-by-reference mutation for 'doc'
            // or explicit return if needed. 
            if (result && typeof result === 'object') {
                return result;
            }
        }
        return doc;
    }
}
