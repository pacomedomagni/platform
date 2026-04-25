'use client';

import { useState } from 'react';
import { Check, Copy, Edit, Eye, MoreVertical, Trash2 } from 'lucide-react';
import { StatusBadge } from '@platform/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Theme } from '@/lib/theme/types';

interface ThemeCardProps {
  theme: Theme;
  isActive: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Open the preview drawer for this theme. Owner page wires this up to a Sheet. */
  onPreview: () => void;
}

export function ThemeCard({
  theme,
  isActive,
  onActivate,
  onEdit,
  onDuplicate,
  onDelete,
  onPreview,
}: ThemeCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const colorPalette = [
    theme.colors.primary,
    theme.colors.secondary,
    theme.colors.accent,
    theme.colors.background,
    theme.colors.foreground,
  ];

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all hover:shadow-lg cursor-pointer',
        isActive && 'ring-2 ring-primary'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onEdit}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {theme.name}
              {isActive && (
                /* StatusBadge keeps the active marker visually consistent with the rest of the admin. */
                <StatusBadge kind="connection" status="ACTIVE" />
              )}
              {theme.isPreset && (
                <Badge variant="secondary" className="text-xs">
                  Preset
                </Badge>
              )}
            </CardTitle>
            {theme.description && (
              <CardDescription className="text-sm line-clamp-2">
                {theme.description}
              </CardDescription>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isActive && (
                <>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onActivate();
                  }}>
                    <Check className="mr-2 h-4 w-4" />
                    Activate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              {!theme.isPreset && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        {/* Color Palette Preview */}
        <div className="flex gap-2">
          {colorPalette.map((color, index) => (
            <div
              key={index}
              className="flex-1 h-16 rounded-md shadow-sm transition-transform group-hover:scale-105"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </CardContent>

      <CardFooter className="pt-3 flex flex-col gap-3">
        <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
          <span>Updated {new Date(theme.updatedAt).toLocaleDateString()}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono">{theme.typography.bodyFont}</span>
          </div>
        </div>
        {/*
          Preview opens the storefront in a side-sheet iframe; cheap and works without
          relying on a per-theme query param the storefront doesn't yet honour.
        */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
        >
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </Button>
      </CardFooter>

      {/* Hover Overlay */}
      {isHovered && !isActive && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="lg"
            onClick={(e) => {
              e.stopPropagation();
              onActivate();
            }}
          >
            <Check className="mr-2 h-4 w-4" />
            Activate Theme
          </Button>
        </div>
      )}
    </Card>
  );
}
