'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ThemeFiltersProps {
  filter: 'all' | 'presets' | 'custom';
  search: string;
  onFilterChange: (filter: 'all' | 'presets' | 'custom') => void;
  onSearchChange: (search: string) => void;
}

export function ThemeFilters({
  filter,
  search,
  onFilterChange,
  onSearchChange,
}: ThemeFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <Tabs value={filter} onValueChange={(v) => onFilterChange(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All Themes</TabsTrigger>
          <TabsTrigger value="presets">Presets</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search themes..."
          className="pl-10"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </div>
  );
}
