import React, { useEffect, useState } from 'react';
import { DocFieldDefinition, DocTypeDefinition } from './types';
import { DataField, IntField, DateField, SelectField } from './fields';
import { LinkField } from './link-field';
import { TableField } from './table-field';
import { Button } from './atoms';
import { cn } from './utils';

interface FormViewProps {
    docType: DocTypeDefinition;
    initialData?: any;
    onSave: (data: any) => Promise<void>;
}

export const FormView = ({ docType, initialData, onSave }: FormViewProps) => {
    const [data, setData] = useState(initialData || {});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // If initialData changes (e.g. fetch complete), update state
        if (initialData) setData(initialData);
    }, [initialData]);

    const handleChange = (field: string, val: any) => {
        setData((prev: any) => ({ ...prev, [field]: val }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await onSave(data);
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

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow space-y-6">
            <header className="flex justify-between items-center border-b pb-4">
                <h1 className="text-2xl font-bold">{docType.name}</h1>
                <div className="space-x-2">
                     <Button onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save'}
                     </Button>
                </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {docType.fields.map(renderField)}
            </div>
        </div>
    );
};
