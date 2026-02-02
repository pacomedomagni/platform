// libs/meta/src/lib/types.ts shared/copied for Frontend 
// Ideally we share the interface from @platform/meta but that might be backend code?
// If @platform/meta is NestJS specific, we might need a separate shared-types lib.
// For now, I will redefine here or assume we can import validation types if they are clean.
// Checking @platform/meta...

export interface DocFieldDefinition {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  hidden?: boolean;
  readonly?: boolean;
  options?: string;
  target?: string;
  idx?: number;
}

export interface DocTypeDefinition {
  name: string;
  module: string;
  isSingle?: boolean;
  isChild?: boolean;
  description?: string;
  fields: DocFieldDefinition[];
}
