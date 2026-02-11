'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, X, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ColorPicker } from '@/components/themes/color-picker';
import { FontSelector } from '@/components/themes/font-selector';
import { PreviewFrame } from '@/components/themes/preview-frame';
import { CSSEditor } from '@/components/themes/css-editor';
import { ThemeSection } from '@/components/themes/theme-section';
import { useThemeEditorStore } from '@/lib/stores/theme-editor-store';
import { themeService } from '@/lib/services/theme-service';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function ThemeCustomizerPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const {
    currentTheme,
    isDirty,
    isSaving,
    previewMode,
    setTheme,
    updateColors,
    updateTypography,
    updateLayout,
    updateComponents,
    updateCustomCSS,
    setPreviewMode,
    setSaving,
    reset,
    hasChanges,
    discardChanges,
  } = useThemeEditorStore();

  const [isLoading, setIsLoading] = useState(true);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showAdvancedColors, setShowAdvancedColors] = useState(false);

  useEffect(() => {
    loadTheme();

    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [params.id]);

  const loadTheme = async () => {
    try {
      setIsLoading(true);
      const theme = await themeService.getTheme(params.id as string);
      setTheme(theme);
    } catch (error) {
      console.error('Failed to load theme:', error);
      toast({
        title: 'Failed to load theme',
        description: 'The theme could not be loaded',
        variant: 'destructive',
      });
      router.push('/app/themes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentTheme) return;

    try {
      setSaving(true);
      await themeService.updateTheme(currentTheme.id, currentTheme);

      toast({
        title: 'Changes saved',
        description: 'Your theme has been updated successfully',
      });

      // Update original theme to match current
      setTheme(currentTheme);
    } catch (error) {
      console.error('Failed to save theme:', error);
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges()) {
      setShowUnsavedDialog(true);
    } else {
      reset();
      router.push('/app/themes');
    }
  };

  const handleDiscard = () => {
    reset();
    router.push('/app/themes');
  };

  const handleReset = () => {
    discardChanges();
    toast({
      title: 'Changes discarded',
      description: 'Theme has been reset to last saved state',
    });
  };

  if (isLoading || !currentTheme) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">
              Customizing: {currentTheme.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isDirty ? 'Unsaved changes' : 'All changes saved'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Discard
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={isSaving || !isDirty}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Settings */}
        <div className="w-[400px] border-r overflow-y-auto">
          {/* Basic Info Section */}
          <ThemeSection title="Basic Information" defaultOpen>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Theme Name</Label>
                <Input
                  value={currentTheme.name}
                  onChange={(e) =>
                    setTheme({ ...currentTheme, name: e.target.value })
                  }
                  placeholder="My Theme"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={currentTheme.description || ''}
                  onChange={(e) =>
                    setTheme({ ...currentTheme, description: e.target.value })
                  }
                  placeholder="A beautiful theme for my store"
                  rows={3}
                />
              </div>
            </div>
          </ThemeSection>

          {/* Colors Section */}
          <ThemeSection title="Colors" description="Customize your color palette">
            <div className="space-y-4">
              <ColorPicker
                label="Primary Color"
                value={currentTheme.colors.primary}
                onChange={(color) => updateColors({ primary: color })}
              />
              <ColorPicker
                label="Secondary Color"
                value={currentTheme.colors.secondary}
                onChange={(color) => updateColors({ secondary: color })}
              />
              <ColorPicker
                label="Accent Color"
                value={currentTheme.colors.accent}
                onChange={(color) => updateColors({ accent: color })}
              />
              <ColorPicker
                label="Background"
                value={currentTheme.colors.background}
                onChange={(color) => updateColors({ background: color })}
              />
              <ColorPicker
                label="Foreground"
                value={currentTheme.colors.foreground}
                onChange={(color) => updateColors({ foreground: color })}
              />

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowAdvancedColors(!showAdvancedColors)}
              >
                {showAdvancedColors ? 'Hide' : 'Show'} Advanced Colors
              </Button>

              {showAdvancedColors && (
                <div className="space-y-4 pt-2">
                  <ColorPicker
                    label="Muted"
                    value={currentTheme.colors.muted}
                    onChange={(color) => updateColors({ muted: color })}
                  />
                  <ColorPicker
                    label="Card"
                    value={currentTheme.colors.card}
                    onChange={(color) => updateColors({ card: color })}
                  />
                  <ColorPicker
                    label="Border"
                    value={currentTheme.colors.border}
                    onChange={(color) => updateColors({ border: color })}
                  />
                  <ColorPicker
                    label="Destructive"
                    value={currentTheme.colors.destructive}
                    onChange={(color) => updateColors({ destructive: color })}
                  />
                </div>
              )}
            </div>
          </ThemeSection>

          {/* Typography Section */}
          <ThemeSection
            title="Typography"
            description="Configure fonts and text styles"
          >
            <div className="space-y-4">
              <FontSelector
                label="Body Font"
                value={currentTheme.typography.bodyFont}
                weight={currentTheme.typography.bodyWeight}
                onChange={(font) => updateTypography({ bodyFont: font })}
                onWeightChange={(weight) =>
                  updateTypography({ bodyWeight: weight })
                }
              />
              <FontSelector
                label="Heading Font"
                value={currentTheme.typography.headingFont}
                weight={currentTheme.typography.headingWeight}
                onChange={(font) => updateTypography({ headingFont: font })}
                onWeightChange={(weight) =>
                  updateTypography({ headingWeight: weight })
                }
              />

              <div className="space-y-2">
                <Label>Base Font Size</Label>
                <Select
                  value={currentTheme.typography.baseFontSize}
                  onValueChange={(value: any) =>
                    updateTypography({ baseFontSize: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Small</SelectItem>
                    <SelectItem value="base">Base</SelectItem>
                    <SelectItem value="lg">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ThemeSection>

          {/* Layout Section */}
          <ThemeSection title="Layout" description="Page layout and structure">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Layout Style</Label>
                <RadioGroup
                  value={currentTheme.layout.layoutStyle}
                  onValueChange={(value: any) =>
                    updateLayout({ layoutStyle: value })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="standard" id="standard" />
                    <Label htmlFor="standard">Standard</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="wide" id="wide" />
                    <Label htmlFor="wide">Wide</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="boxed" id="boxed" />
                    <Label htmlFor="boxed">Boxed</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Header Style</Label>
                <Select
                  value={currentTheme.layout.headerStyle}
                  onValueChange={(value: any) =>
                    updateLayout({ headerStyle: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">Classic</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="centered">Centered</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Footer Style</Label>
                <Select
                  value={currentTheme.layout.footerStyle}
                  onValueChange={(value: any) =>
                    updateLayout({ footerStyle: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Spacing</Label>
                <RadioGroup
                  value={currentTheme.layout.spacing}
                  onValueChange={(value: any) => updateLayout({ spacing: value })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="compact" id="compact" />
                    <Label htmlFor="compact">Compact</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="comfortable" id="comfortable" />
                    <Label htmlFor="comfortable">Comfortable</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="spacious" id="spacious" />
                    <Label htmlFor="spacious">Spacious</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Container Max Width (px)</Label>
                <Input
                  type="number"
                  value={currentTheme.layout.containerMaxWidth}
                  onChange={(e) =>
                    updateLayout({
                      containerMaxWidth: parseInt(e.target.value) || 1200,
                    })
                  }
                />
              </div>
            </div>
          </ThemeSection>

          {/* Components Section */}
          <ThemeSection
            title="Components"
            description="Customize UI components"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Button Style</Label>
                <RadioGroup
                  value={currentTheme.components.buttonStyle}
                  onValueChange={(value: any) =>
                    updateComponents({ buttonStyle: value })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="rounded" id="btn-rounded" />
                    <Label htmlFor="btn-rounded">Rounded</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="square" id="btn-square" />
                    <Label htmlFor="btn-square">Square</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pill" id="btn-pill" />
                    <Label htmlFor="btn-pill">Pill</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Button Size</Label>
                <Select
                  value={currentTheme.components.buttonSize}
                  onValueChange={(value: any) =>
                    updateComponents({ buttonSize: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Small</SelectItem>
                    <SelectItem value="md">Medium</SelectItem>
                    <SelectItem value="lg">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Card Style</Label>
                <RadioGroup
                  value={currentTheme.components.cardStyle}
                  onValueChange={(value: any) =>
                    updateComponents({ cardStyle: value })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="shadow" id="card-shadow" />
                    <Label htmlFor="card-shadow">Shadow</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="border" id="card-border" />
                    <Label htmlFor="card-border">Border</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="flat" id="card-flat" />
                    <Label htmlFor="card-flat">Flat</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Card Border Radius: {currentTheme.components.cardRadius}px</Label>
                <Slider
                  value={[currentTheme.components.cardRadius]}
                  onValueChange={([value]) =>
                    updateComponents({ cardRadius: value })
                  }
                  min={0}
                  max={32}
                  step={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Input Style</Label>
                <RadioGroup
                  value={currentTheme.components.inputStyle}
                  onValueChange={(value: any) =>
                    updateComponents({ inputStyle: value })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="outlined" id="input-outlined" />
                    <Label htmlFor="input-outlined">Outlined</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="filled" id="input-filled" />
                    <Label htmlFor="input-filled">Filled</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </ThemeSection>

          {/* Product Display Section */}
          <ThemeSection
            title="Product Display"
            description="Configure product grid settings"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Grid Columns</Label>
                <Select
                  value={currentTheme.productDisplay.gridColumns.toString()}
                  onValueChange={(value) =>
                    setTheme({
                      ...currentTheme,
                      productDisplay: {
                        ...currentTheme.productDisplay,
                        gridColumns: parseInt(value),
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Columns</SelectItem>
                    <SelectItem value="3">3 Columns</SelectItem>
                    <SelectItem value="4">4 Columns</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Image Ratio</Label>
                <RadioGroup
                  value={currentTheme.productDisplay.imageRatio}
                  onValueChange={(value: any) =>
                    setTheme({
                      ...currentTheme,
                      productDisplay: {
                        ...currentTheme.productDisplay,
                        imageRatio: value,
                      },
                    })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="square" id="img-square" />
                    <Label htmlFor="img-square">Square</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="portrait" id="img-portrait" />
                    <Label htmlFor="img-portrait">Portrait</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="landscape" id="img-landscape" />
                    <Label htmlFor="img-landscape">Landscape</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="quick-view">Quick View</Label>
                <Switch
                  id="quick-view"
                  checked={currentTheme.productDisplay.showQuickView}
                  onCheckedChange={(checked) =>
                    setTheme({
                      ...currentTheme,
                      productDisplay: {
                        ...currentTheme.productDisplay,
                        showQuickView: checked,
                      },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="wishlist">Wishlist Button</Label>
                <Switch
                  id="wishlist"
                  checked={currentTheme.productDisplay.showWishlist}
                  onCheckedChange={(checked) =>
                    setTheme({
                      ...currentTheme,
                      productDisplay: {
                        ...currentTheme.productDisplay,
                        showWishlist: checked,
                      },
                    })
                  }
                />
              </div>
            </div>
          </ThemeSection>

          {/* Advanced Section */}
          <ThemeSection title="Advanced" description="Custom CSS and assets">
            <div className="space-y-4">
              <CSSEditor
                value={currentTheme.customCSS || ''}
                onChange={updateCustomCSS}
              />
            </div>
          </ThemeSection>
        </div>

        {/* Right Panel - Preview */}
        <div className="flex-1">
          <PreviewFrame
            theme={currentTheme}
            responsive={previewMode}
            onResponsiveChange={setPreviewMode}
          />
        </div>
      </div>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your
              changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscard}>
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
