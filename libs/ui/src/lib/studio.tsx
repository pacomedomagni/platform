import React, { useState } from 'react';
import { DocTypeDefinition, DocFieldDefinition } from './types';
import { Button, Input, Card, Badge, NativeSelect, Label, Textarea } from './atoms';
import { Plus, Save, Trash2, GripVertical, Settings, Database, Code, Type, LayoutList, CheckSquare, Calendar, Link as LinkIcon } from 'lucide-react';
import { cn } from './utils';

interface StudioProps {
    initialDocTypes?: DocTypeDefinition[];
    onSaveDocType: (docType: DocTypeDefinition) => Promise<void>;
}

export const Studio = ({ initialDocTypes = [], onSaveDocType }: StudioProps) => {
    const [docTypes, setDocTypes] = useState<DocTypeDefinition[]>(initialDocTypes);
    const [selectedDocType, setSelectedDocType] = useState<DocTypeDefinition | null>(null);
    const [isDirty, setIsDirty] = useState(false);

    // If we are creating a new one
    const handleNewDocType = () => {
        const newDoc: DocTypeDefinition = {
            name: 'New DocType',
            module: 'Core',
            fields: []
        };
        setSelectedDocType(newDoc);
        setIsDirty(true);
    };

    const handleSelectDocType = (dt: DocTypeDefinition) => {
        if (isDirty && !window.confirm("You have unsaved changes. Discard?")) return;
        setSelectedDocType(JSON.parse(JSON.stringify(dt))); // Deep copy
        setIsDirty(false);
    };

    const handleSave = async () => {
        if (!selectedDocType) return;
        await onSaveDocType(selectedDocType);
        
        // Update list
        const exists = docTypes.find(d => d.name === selectedDocType.name);
        if (exists) {
            setDocTypes(docTypes.map(d => d.name === selectedDocType.name ? selectedDocType : d));
        } else {
            setDocTypes([...docTypes, selectedDocType]);
        }
        setIsDirty(false);
    };

    const addField = () => {
        if (!selectedDocType) return;
        const newField: DocFieldDefinition = {
            name: 'new_field_' + (selectedDocType.fields.length + 1),
            label: 'New Field',
            type: 'Data',
            hidden: false
        };
        setSelectedDocType({
            ...selectedDocType,
            fields: [...selectedDocType.fields, newField]
        });
        setIsDirty(true);
    };

    const updateField = (index: number, updates: Partial<DocFieldDefinition>) => {
        if (!selectedDocType) return;
        const newFields = [...selectedDocType.fields];
        newFields[index] = { ...newFields[index], ...updates };
        setSelectedDocType({ ...selectedDocType, fields: newFields });
        setIsDirty(true);
    };

    const removeField = (index: number) => {
        if (!selectedDocType) return;
        const newFields = [...selectedDocType.fields];
        newFields.splice(index, 1);
        setSelectedDocType({ ...selectedDocType, fields: newFields });
        setIsDirty(true);
    };

    const fieldTypes = [
        { value: 'Data', label: 'Text (Data)', icon: Type },
        { value: 'Int', label: 'Number (Int)', icon: Code },
        { value: 'Float', label: 'Decimal (Float)', icon: Code },
        { value: 'Currency', label: 'Currency', icon: Database },
        { value: 'Date', label: 'Date', icon: Calendar },
        { value: 'Select', label: 'Select (Dropdown)', icon: LayoutList },
        { value: 'Check', label: 'Checkbox', icon: CheckSquare },
        { value: 'Link', label: 'Link (Relation)', icon: LinkIcon },
        { value: 'TextEditor', label: 'Rich Text', icon: File },
        { value: 'Table', label: 'Table (Child)', icon: LayoutList },
    ];

    return (
        <div className="flex h-[calc(100vh-3.5rem)] bg-slate-50 dark:bg-slate-950">
            {/* Sidebar */}
            <div className="w-64 border-r bg-white dark:bg-slate-900 flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                    <span className="font-semibold text-sm">DocTypes</span>
                    <Button size="sm" variant="ghost" onClick={handleNewDocType}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {docTypes.map(dt => (
                        <button
                            key={dt.name}
                            onClick={() => handleSelectDocType(dt)}
                            className={cn(
                                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                                selectedDocType?.name === dt.name 
                                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-medium" 
                                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                            )}
                        >
                            <Database className="h-4 w-4 opacity-50" />
                            {dt.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Editor */}
            <div className="flex-1 flex flex-col min-w-0">
                {selectedDocType ? (
                    <>
                        {/* Toolbar */}
                        <header className="h-14 border-b bg-white dark:bg-slate-900 flex items-center justify-between px-6">
                            <div className="flex items-center gap-4">
                                <h2 className="font-semibold text-lg">{selectedDocType.name}</h2>
                                {isDirty && <Badge variant="warning">Unsaved Changes</Badge>}
                            </div>
                            <Button onClick={handleSave} disabled={!isDirty}>
                                <Save className="mr-2 h-4 w-4" /> Save Schema
                            </Button>
                        </header>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="max-w-4xl mx-auto space-y-8">
                                {/* Basic Settings */}
                                <Card className="p-6 space-y-4">
                                    <h3 className="font-medium flex items-center gap-2">
                                        <Settings className="h-4 w-4" /> General Settings
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>DocType Name</Label>
                                            <Input 
                                                value={selectedDocType.name} 
                                                onChange={e => {
                                                    setSelectedDocType({...selectedDocType, name: e.target.value});
                                                    setIsDirty(true);
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Module</Label>
                                            <NativeSelect 
                                                value={selectedDocType.module}
                                                onChange={e => {
                                                    setSelectedDocType({...selectedDocType, module: e.target.value});
                                                    setIsDirty(true);
                                                }}
                                            >
                                                <option>Core</option>
                                                <option>Accounting</option>
                                                <option>HR</option>
                                                <option>CRM</option>
                                                <option>Stock</option>
                                            </NativeSelect>
                                        </div>
                                    </div>
                                </Card>

                                {/* Fields Editor */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-medium">Fields ({selectedDocType.fields.length})</h3>
                                        <Button size="sm" onClick={addField} variant="secondary">
                                            <Plus className="mr-2 h-4 w-4" /> Add Field
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        {selectedDocType.fields.map((field, idx) => (
                                            <Card key={idx} className="p-4 flex items-start gap-4 group hover:border-indigo-300 transition-colors">
                                                <div className="mt-2 cursor-grab text-slate-400 hover:text-slate-600">
                                                    <GripVertical className="h-5 w-5" />
                                                </div>
                                                
                                                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4">
                                                    <div className="col-span-3 space-y-1">
                                                        <Label className="text-xs text-slate-500">Label</Label>
                                                        <Input 
                                                            value={field.label} 
                                                            onChange={e => updateField(idx, { label: e.target.value })}
                                                            className="h-8"
                                                        />
                                                    </div>
                                                    <div className="col-span-3 space-y-1">
                                                        <Label className="text-xs text-slate-500">Field Name</Label>
                                                        <Input 
                                                            value={field.name} 
                                                            onChange={e => updateField(idx, { name: e.target.value })}
                                                            className="h-8 font-mono text-xs"
                                                        />
                                                    </div>
                                                    <div className="col-span-3 space-y-1">
                                                        <Label className="text-xs text-slate-500">Type</Label>
                                                        <NativeSelect 
                                                            value={field.type}
                                                            onChange={e => updateField(idx, { type: e.target.value })}
                                                            className="h-8"
                                                        >
                                                            {fieldTypes.map(t => (
                                                                <option key={t.value} value={t.value}>{t.label}</option>
                                                            ))}
                                                        </NativeSelect>
                                                    </div>
                                                    <div className="col-span-3 space-y-1">
                                                        {(field.type === 'Select' || field.type === 'Link') && (
                                                            <>
                                                                <Label className="text-xs text-slate-500">
                                                                    {field.type === 'Link' ? 'Target DocType' : 'Options (newline)'}
                                                                </Label>
                                                                <Input 
                                                                     value={field.options || field.target || ''}
                                                                     onChange={e => updateField(idx, field.type === 'Link' ? { target: e.target.value } : { options: e.target.value })}
                                                                     className="h-8"
                                                                     placeholder={field.type === 'Link' ? 'e.g. User' : 'Option 1...'}
                                                                />
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-600" onClick={() => removeField(idx)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </Card>
                                        ))}
                                        
                                        {selectedDocType.fields.length === 0 && (
                                            <div className="text-center py-12 border-2 border-dashed rounded-lg text-slate-400">
                                                No fields yet. Click "Add Field" to start building.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <Database className="h-16 w-16 mb-4 opacity-20" />
                        <p>Select a DocType to edit or create a new one.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
