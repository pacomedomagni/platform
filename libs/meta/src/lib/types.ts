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

export interface DocTypeDefinition {
  name: string;
  module: string;
  isSingle?: boolean;
  isChild?: boolean;
  description?: string;
  fields: DocFieldDefinition[];
}
