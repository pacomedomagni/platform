import React, { useState } from 'react';
import { DocFieldDefinition } from './types';
import { Input, Label, Textarea, NativeSelect } from './atoms';
import { LinkField } from './link-field';
import { cn } from './utils';

interface FieldProps {
    field: DocFieldDefinition;
    value: any;
    onChange: (val: any) => void;
}

export const DataField = ({ field, value, onChange }: FieldProps) => {
    return (
        <div className="space-y-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input 
                id={field.name} 
                value={value || ''} 
                onChange={e => onChange(e.target.value)} 
                readOnly={field.readonly}
                required={field.required}
            />
        </div>
    );
};

export const IntField = ({ field, value, onChange }: FieldProps) => {
    return (
        <div className="space-y-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input 
                id={field.name} 
                type="number"
                step={field.type === 'Float' || field.type === 'Currency' ? "0.01" : "1"}
                value={value || ''} 
                onChange={e => onChange(field.type === 'Int' ? parseInt(e.target.value) : parseFloat(e.target.value))} 
                readOnly={field.readonly}
                required={field.required}
            />
        </div>
    );
};

export const DateField = ({ field, value, onChange }: FieldProps) => {
    // Value format should probably be YYYY-MM-DD
    return (
        <div className="space-y-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input 
                id={field.name} 
                type="date"
                value={value ? new Date(value).toISOString().split('T')[0] : ''} 
                onChange={e => onChange(e.target.value)} // Sends string '2024-01-01'
                readOnly={field.readonly}
                required={field.required}
            />
        </div>
    );
};

export const SelectField = ({ field, value, onChange }: FieldProps) => {
    const options = field.options ? field.options.split('\n') : [];
    return (
        <div className="space-y-2">
             <Label htmlFor={field.name}>{field.label}</Label>
             <NativeSelect 
                id={field.name}
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                disabled={field.readonly}
             >
                 <option value="">Select...</option>
                 {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
             </NativeSelect>
        </div>
    )
}

// TODO: Implement LinkField (Autocomplete) and TableField (Child Grid)

export const TextEditorField = ({ field, value, onChange }: FieldProps) => {
    return (
        <div className="space-y-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Textarea
                id={field.name} 
                value={value || ''} 
                onChange={e => onChange(e.target.value)} 
                rows={4}
                readOnly={field.readonly}
            />
        </div>
    );
};

export const CheckField = ({ field, value, onChange }: FieldProps) => {
    return (
         <div className="flex items-center space-x-2 pt-6">
            <input 
                type="checkbox" 
                id={field.name}
                checked={!!value} 
                onChange={e => onChange(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={field.readonly}
            />
            <Label htmlFor={field.name} className="leading-none cursor-pointer">
                {field.label}
            </Label>
        </div>
    );
}
