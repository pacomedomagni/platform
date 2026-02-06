'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { ThemeCard } from './_components/theme-card';
import { ThemeFilters } from './_components/theme-filters';
import { CreateThemeDialog } from './_components/create-theme-dialog';
import { themeService } from '@/lib/services/theme-service';
import { useToast } from '@/hooks/use-toast';
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
import type { Theme } from '@/lib/theme/types';

export default function ThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'presets' | 'custom'>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [themeToDelete, setThemeToDelete] = useState<Theme | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    try {
      setIsLoading(true);
      const [allThemes, activeTheme] = await Promise.all([
        themeService.getAllThemes(),
        themeService.getActiveTheme(),
      ]);

      setThemes(allThemes);
      setActiveThemeId(activeTheme?.id || null);
    } catch (error) {
      console.error('Failed to load themes:', error);
      toast({
        title: 'Failed to load themes',
        description: 'Please try refreshing the page',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async (themeId: string) => {
    try {
      await themeService.activateTheme(themeId);
      setActiveThemeId(themeId);

      toast({
        title: 'Theme activated',
        description: 'Your storefront has been updated with the new theme',
      });
    } catch (error) {
      console.error('Failed to activate theme:', error);
      toast({
        title: 'Failed to activate theme',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (themeId: string) => {
    router.push(`/app/themes/${themeId}`);
  };

  const handleDuplicate = async (theme: Theme) => {
    try {
      const duplicated = await themeService.duplicateTheme(theme.id, {
        name: `${theme.name} (Copy)`,
      });

      setThemes((prev) => [...prev, duplicated]);

      toast({
        title: 'Theme duplicated',
        description: `${duplicated.name} has been created`,
      });

      router.push(`/app/themes/${duplicated.id}`);
    } catch (error) {
      console.error('Failed to duplicate theme:', error);
      toast({
        title: 'Failed to duplicate theme',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (theme: Theme) => {
    setThemeToDelete(theme);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!themeToDelete) return;

    try {
      await themeService.deleteTheme(themeToDelete.id);
      setThemes((prev) => prev.filter((t) => t.id !== themeToDelete.id));

      toast({
        title: 'Theme deleted',
        description: `${themeToDelete.name} has been deleted`,
      });
    } catch (error) {
      console.error('Failed to delete theme:', error);
      toast({
        title: 'Failed to delete theme',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setThemeToDelete(null);
    }
  };

  // Filter themes
  const filteredThemes = themes.filter((theme) => {
    // Apply filter
    if (filter === 'presets' && !theme.isPreset) return false;
    if (filter === 'custom' && theme.isPreset) return false;

    // Apply search
    if (search) {
      const query = search.toLowerCase();
      return (
        theme.name.toLowerCase().includes(query) ||
        theme.description?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const presetThemes = themes.filter((t) => t.isPreset);
  const customThemes = themes.filter((t) => !t.isPreset);

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Themes</h1>
          <p className="text-muted-foreground mt-2">
            Manage your storefront themes and customize your brand appearance
          </p>
        </div>
        <CreateThemeDialog
          presetThemes={presetThemes}
          onThemeCreated={(theme) => setThemes((prev) => [...prev, theme])}
        />
      </div>

      {/* Stats */}
      <div className="flex gap-6 text-sm">
        <div>
          <span className="text-muted-foreground">Total Themes:</span>{' '}
          <span className="font-semibold">{themes.length}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Custom Themes:</span>{' '}
          <span className="font-semibold">{customThemes.length}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Presets:</span>{' '}
          <span className="font-semibold">{presetThemes.length}</span>
        </div>
      </div>

      {/* Filters */}
      <ThemeFilters
        filter={filter}
        search={search}
        onFilterChange={setFilter}
        onSearchChange={setSearch}
      />

      {/* Themes Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredThemes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {search
              ? 'No themes found matching your search'
              : 'No themes available'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isActive={theme.id === activeThemeId}
              onActivate={() => handleActivate(theme.id)}
              onEdit={() => handleEdit(theme.id)}
              onDuplicate={() => handleDuplicate(theme)}
              onDelete={() => handleDelete(theme)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{themeToDelete?.name}". This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
