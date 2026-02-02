import React, { useState, useEffect } from 'react';
import { DocFieldDefinition, DocTypeDefinition } from './types';
import { Button, Input } from './atoms';
import { LinkField } from './link-field';
import { Trash2, Plus } from 'lucide-react';
import { cn } from './utils';

interface TableFieldProps {
    field: DocFieldDefinition;
    value: any[];
    onChange: (val: any[]) => void;
}

export const TableField = ({ field, value, onChange }: TableFieldProps) => {
    const [meta, setMeta] = useState<DocTypeDefinition | null>(null);
    const rows = Array.isArray(value) ? value : [];

    useEffect(() => {
        if (field.options) {
             fetch(`/api/v1/meta/${field.options}`)
                 .then(res => res.json())
                 .then(setMeta)
                 .catch(console.error);
        }
    }, [field.options]);

    const updateRow = (idx: number, key: string, val: any) => {
        const newRows = [...rows];
        newRows[idx] = { ...newRows[idx], [key]: val };
        onChange(newRows);
    };

    const addRow = () => {
        onChange([...rows, {}]); 
    };

    const removeRow = (idx: number) => {
        onChange(rows.filter((_, i) => i !== idx));
    };

    if (!meta) return <div className="text-sm text-gray-500 py-2">Loading Table Schema...</div>;

    const columns = meta.fields.filter(f => !f.hidden);

    return (
        <div className="border rounded-md p-4 bg-white/50 space-y-3">
             <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">{field.label}</label>
             </div>
             
             <div className="border rounded-md overflow-hidden">
                 <div className="overflow-x-auto">
                     <table className="w-full text-sm">
                        <thead className="bg-muted text-muted-foreground">
                            <tr>
                                <th className="p-2 w-10 text-center font-medium">#</th>
                                {columns.map(c => (
                                    <th key={c.name} className="p-2 text-left font-medium min-w-[150px]">
                                        {c.label}
                                    </th>
                                ))}
                                <th className="p-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-background">
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={columns.length + 2} className="p-4 text-center text-muted-foreground">
                                        No items yet.
                                    </td>
                                </tr>
                            )}
                            {rows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-muted/50">
                                    <td className="p-2 text-center text-xs text-muted-foreground">{idx + 1}</td>
                                    {columns.map(col => (
                                        <td key={col.name} className="p-2">
                                            <Cell 
                                                field={col} 
                                                value={row[col.name]} 
                                                onChange={(v) => updateRow(idx, col.name, v)} 
                                            />
                                        </td>
                                    ))}
                                    <td className="p-2">
                                        <button 
                                            onClick={() => removeRow(idx)} 
                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                            title="Remove Row"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                     </table>
                 </div>
             </div>
             
             <Button variant="outline" type="button" onClick={addRow} className="w-full sm:w-auto h-8 text-xs">
                <Plus size={14} className="mr-2" /> Add Row
             </Button>
        </div>
    );
};

// Simple Cell Renderer
const Cell = ({ field, value, onChange }: { field: DocFieldDefinition, value: any, onChange: (v: any) => void }) => {
    
    if (field.type === 'Link') {
        // LinkField expects full field definition
        return <LinkField field={field} value={value} onChange={onChange} />;
    }

    if (field.type === 'Select') {
        // Basic Select implementation if options are string split by \n
        const options = field.options ? field.options.split('\n') : [];
        return (
            <select 
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
            >
                <option value="">Select...</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        )
    }

    if (field.type === 'Check') {
        return (
             <input 
                type="checkbox" 
                checked={!!value} 
                onChange={e => onChange(e.target.checked ? 1 : 0)} 
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
        )
    }

    return (
        <Input 
            className="h-8 text-sm" 
            value={value || ''} 
            onChange={e => onChange(field.type === 'Int' || field.type === 'Currency' || field.type === 'Float' ? parseFloat(e.target.value) : e.target.value)} 
            type={field.type === 'Int' || field.type === 'Currency' || field.type === 'Float' ? 'number' : 'text'}
            placeholder={field.label}
        />
    )
}
