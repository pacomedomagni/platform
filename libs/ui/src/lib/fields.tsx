import React, { useState } from 'react';
import { DocFieldDefinition } from './types';
import { Input, Label } from './atoms';
import { LinkField } from './link-field';
import { cn } from './utils';

interface FieldProps {

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
                value={value || ''} 
                onChange={e => onChange(parseInt(e.target.value))} 
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
             <select 
                id={field.name}
                className={cn("flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50")}
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                disabled={field.readonly}
             >
                 <option value="">Select...</option>
                 {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
             </select>
        </div>
    )
}

// TODO: Implement LinkField (Autocomplete) and TableField (Child Grid)
