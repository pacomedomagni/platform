'use client';

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CSSEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CSSEditor({ value, onChange, className }: CSSEditorProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  return (
    <div
      className={cn(
        'relative rounded-lg border overflow-hidden',
        isFullscreen && 'fixed inset-4 z-50 bg-background',
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
        <span className="text-sm font-medium">Custom CSS</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Editor */}
      <Editor
        height={isFullscreen ? 'calc(100vh - 120px)' : '400px'}
        language="css"
        theme="vs-dark"
        value={value}
        onChange={handleEditorChange}
        options={{
          minimap: { enabled: isFullscreen },
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          formatOnPaste: true,
          formatOnType: true,
        }}
      />
    </div>
  );
}
