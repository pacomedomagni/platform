import React, { useEffect, useState } from 'react';
import { DocFieldDefinition, DocTypeDefinition } from './types';
import { DataField, IntField, DateField, SelectField, TextEditorField, CheckField } from './fields';
import { LinkField } from './link-field';
import { TableField } from './table-field';
import { Button, Badge, Card, Skeleton } from './atoms';
import { cn } from './utils';
import { Save, ChevronLeft, MoreHorizontal, CheckCircle, Ban } from 'lucide-react';

interface FormViewProps {
    docType: DocTypeDefinition;
    initialData?: any;
    onSave: (data: any) => Promise<void>;
    onNavigateBack?: () => void;
}

export const FormView = ({ docType, initialData, onSave, onNavigateBack }: FormViewProps) => {
    const [data, setData] = useState(initialData || {});
    const [loading, setLoading] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    const isNew = !data.name;

    useEffect(() => {
        // If initialData changes (e.g. fetch complete), update state
        if (initialData) setData(initialData);
    }, [initialData]);

    const handleChange = (field: string, val: any) => {
        setData((prev: any) => ({ ...prev, [field]: val }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await onSave(data);
            setIsDirty(false);
        } catch (e) {
            console.error(e);
            alert('Failed to save');
        } finally {
            setLoading(false);
        }
    }

    const renderField = (field: DocFieldDefinition) => {
        const commonProps = {
            field,
            value: data[field.name],
            onChange: (val: any) => handleChange(field.name, val)
        };

        if (field.hidden) return null;

        let inputComponent;
        switch (field.type) {
            case 'Int': inputComponent = <IntField {...commonProps} />; break;
            case 'Currency':
            case 'Float': inputComponent = <IntField {...commonProps} />; break;
            case 'Date': inputComponent = <DateField {...commonProps} />; break;
            case 'Select': inputComponent = <SelectField {...commonProps} />; break;
            case 'Link': inputComponent = <LinkField {...commonProps} />; break;
            case 'Table': inputComponent = <TableField {...commonProps} />; break;
            case 'TextEditor': inputComponent = <TextEditorField {...commonProps} />; break;
            case 'Check': inputComponent = <CheckField {...commonProps} />; break;
            case 'Code': inputComponent = <TextEditorField {...commonProps} />; break; // Fallback for code
            case 'Data': 
            default: inputComponent = <DataField {...commonProps} />; break;
        }

        const isFullWidth = field.type === 'Table' || field.type === 'TextEditor' || field.type === 'Code';

        return (
            <div key={field.name} className={cn(isFullWidth ? "col-span-1 md:col-span-2" : "col-span-1")}>
                {inputComponent}
            </div>
        );
    };

    const StatusBadge = ({ status }: { status?: number }) => {
        switch (status) {
            case 0: return <Badge variant="secondary" className="ml-2">Draft</Badge>;
            case 1: return <Badge variant="success" className="ml-2">Submitted</Badge>;
            case 2: return <Badge variant="destructive" className="ml-2">Cancelled</Badge>;
            default: return isNew ? <Badge variant="secondary" className="ml-2">New</Badge> : null;
        }
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/20 py-6 px-4 sm:px-8 min-h-screen">
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur py-2 border-b sm:border-b-0">
                <div className="flex items-center gap-2">
                    {onNavigateBack && (
                        <Button variant="ghost" size="icon" onClick={onNavigateBack} className="-ml-2">
                            <ChevronLeft className="h-5 w-5 text-slate-500" />
                        </Button>
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                                {isNew ? `New ${docType.name}` : data.name}
                            </h1>
                            <StatusBadge status={data.docstatus} />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                             {isDirty ? 'Unsaved Changes' : (isNew ? 'Not Saved' : 'Last Saved: Just now')}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                     {/* Workflow Actions */}
                     {data.docstatus === 0 && !isNew && (
                         <Button variant="secondary" size="sm">
                            <CheckCircle className="mr-2 h-4 w-4" /> Submit
                         </Button>
                     )}
                     {data.docstatus === 1 && (
                         <Button variant="destructive" size="sm">
                             <Ban className="mr-2 h-4 w-4" /> Cancel
                         </Button>
                     )}
                     
                     <div className="flex-1 sm:flex-none"></div>

                     <Button onClick={handleSave} disabled={loading || (data.docstatus === 1)} size="sm">
                        {loading ? 'Saving...' : (
                            <>
                                <Save className="mr-2 h-4 w-4" /> Save
                            </>
                        )}
                     </Button>

                     <Button variant="ghost" size="icon">
                         <MoreHorizontal className="h-4 w-4" />
                     </Button>
                </div>
            </header>
            
            {/* Form Layout */}
            <div className="mx-auto w-full max-w-5xl">
                <Card className="p-6 md:p-8 bg-white dark:bg-slate-950">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        {docType.fields.length === 0 && (
                            <div className="col-span-2 py-10 text-center text-slate-500">
                                No fields defined for this DocType.
                            </div>
                        )}
                        {docType.fields.map(renderField)}
                    </div>
                </Card>
            </div>
        </div>
    );
};
