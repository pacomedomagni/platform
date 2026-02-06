'use client';

import { useState } from 'react';
import { FileJson, Palette, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { themeService } from '@/lib/services/theme-service';
import type { Theme } from '@/lib/theme/types';

interface CreateThemeDialogProps {
  presetThemes: Theme[];
  onThemeCreated?: (theme: Theme) => void;
}

export function CreateThemeDialog({
  presetThemes,
  onThemeCreated,
}: CreateThemeDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'preset' | 'scratch' | 'import' | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [importJson, setImportJson] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const router = useRouter();
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a theme name',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      let newTheme: Theme;

      if (mode === 'preset' && selectedPreset) {
        // Duplicate from preset
        const preset = presetThemes.find((t) => t.id === selectedPreset);
        if (!preset) throw new Error('Preset not found');

        newTheme = await themeService.duplicateTheme(preset.id, {
          name,
          description: description || `Based on ${preset.name}`,
        });
      } else if (mode === 'import') {
        // Import from JSON
        const themeData = JSON.parse(importJson);
        newTheme = await themeService.createTheme({
          ...themeData,
          name,
          description: description || themeData.description,
        });
      } else {
        // Create from scratch
        newTheme = await themeService.createTheme({
          name,
          description,
          tenantId: '', // Will be set by service
        });
      }

      toast({
        title: 'Theme created',
        description: `${newTheme.name} has been created successfully`,
      });

      setOpen(false);
      onThemeCreated?.(newTheme);
      router.push(`/app/themes/${newTheme.id}`);
    } catch (error) {
      console.error('Failed to create theme:', error);
      toast({
        title: 'Failed to create theme',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const resetDialog = () => {
    setMode(null);
    setSelectedPreset(null);
    setName('');
    setDescription('');
    setImportJson('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetDialog();
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg">
          <Palette className="mr-2 h-5 w-5" />
          Create New Theme
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Theme</DialogTitle>
          <DialogDescription>
            Choose how you want to create your new theme
          </DialogDescription>
        </DialogHeader>

        {!mode ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
            {/* Start from Preset */}
            <button
              className="p-6 border-2 rounded-lg hover:border-primary hover:bg-muted/50 transition-all text-center space-y-3"
              onClick={() => setMode('preset')}
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Copy className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Start from Preset</h3>
              <p className="text-sm text-muted-foreground">
                Duplicate and customize one of our preset themes
              </p>
            </button>

            {/* Start from Scratch */}
            <button
              className="p-6 border-2 rounded-lg hover:border-primary hover:bg-muted/50 transition-all text-center space-y-3"
              onClick={() => setMode('scratch')}
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Palette className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Start from Scratch</h3>
              <p className="text-sm text-muted-foreground">
                Create a completely custom theme with default settings
              </p>
            </button>

            {/* Import Theme */}
            <button
              className="p-6 border-2 rounded-lg hover:border-primary hover:bg-muted/50 transition-all text-center space-y-3"
              onClick={() => setMode('import')}
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <FileJson className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Import Theme</h3>
              <p className="text-sm text-muted-foreground">
                Upload a theme JSON file to import
              </p>
            </button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Preset Selection */}
            {mode === 'preset' && (
              <div className="space-y-2">
                <Label>Select Preset</Label>
                <div className="grid grid-cols-2 gap-2">
                  {presetThemes.map((preset) => (
                    <button
                      key={preset.id}
                      className={`p-4 border-2 rounded-lg hover:border-primary transition-all ${
                        selectedPreset === preset.id
                          ? 'border-primary bg-primary/5'
                          : ''
                      }`}
                      onClick={() => setSelectedPreset(preset.id)}
                    >
                      <div className="font-medium mb-2">{preset.name}</div>
                      <div className="flex gap-1">
                        {[
                          preset.colors.primary,
                          preset.colors.secondary,
                          preset.colors.accent,
                        ].map((color, i) => (
                          <div
                            key={i}
                            className="flex-1 h-6 rounded"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Import JSON */}
            {mode === 'import' && (
              <div className="space-y-2">
                <Label>Theme JSON</Label>
                <Textarea
                  placeholder="Paste your theme JSON here..."
                  rows={10}
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            )}

            {/* Theme Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Theme Name *</Label>
              <Input
                id="name"
                placeholder="My Custom Theme"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Theme Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="A brief description of your theme..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={resetDialog}>
                Back
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Theme'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
