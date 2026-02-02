export interface DocFieldDefinition {
  name: string;
  label: string;
  type: string; // 'Data', 'Int', 'Link', 'Select', 'Date', etc.
  required?: boolean;
  unique?: boolean;
  hidden?: boolean;
  readonly?: boolean;
  options?: string; // For Select: "Option 1\nOption 2"
  target?: string; // For Link: "Another DocType"
  idx?: number;
}

export interface DocPermDefinition {
  role: string;
  read?: boolean;
  write?: boolean;
  create?: boolean;
  delete?: boolean;
  submit?: boolean;
  cancel?: boolean;
  amend?: boolean;
  report?: boolean;
  idx?: number;
}

export interface DocTypeDefinition {
  name: string;
  module: string;
  isSingle?: boolean;
  isChild?: boolean;
  description?: string;
  fields: DocFieldDefinition[];
  permissions?: DocPermDefinition[];
}

export interface DocHooks {
    beforeSave?: (doc: any, user: any) => Promise<any> | void;
    afterSave?: (doc: any, user: any) => Promise<void> | void;
    beforeDelete?: (doc: any, user: any) => Promise<void> | void;
    
    // Workflow
    onSubmit?: (doc: any, user: any) => Promise<void> | void;
    onCancel?: (doc: any, user: any) => Promise<void> | void;
}
