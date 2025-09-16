'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Filter,
  SortAsc,
  SortDesc,
  TrendingUp,
  Zap,
  Target,
  Clock,
  Shield,
  Search,
} from 'lucide-react';

export type OpportunityType =
  | 'all'
  | 'quick-win'
  | 'strategic'
  | 'incremental'
  | 'long-term'
  | 'maintain';
export type SortBy = 'score' | 'impact' | 'name' | 'products' | 'revenue';
export type SortOrder = 'asc' | 'desc';

export interface FilterControlsProps {
  onOpportunityScoreChange: (min: number, max: number) => void;
  onOpportunityTypeChange: (type: OpportunityType) => void;
  onSortByChange: (sortBy: SortBy, order: SortOrder) => void;
  onSearchChange: (query: string) => void;
  onReset: () => void;
  currentFilters?: {
    opportunityScore?: [number, number];
    opportunityType?: OpportunityType;
    sortBy?: SortBy;
    sortOrder?: SortOrder;
    search?: string;
  };
}

export function FilterControls({
  onOpportunityScoreChange,
  onOpportunityTypeChange,
  onSortByChange,
  onSearchChange,
  onReset,
  currentFilters = {},
}: FilterControlsProps) {
  const [scoreRange, setScoreRange] = React.useState<[number, number]>(
    currentFilters.opportunityScore || [0, 100]
  );
  const [opportunityType, setOpportunityType] = React.useState<OpportunityType>(
    currentFilters.opportunityType || 'all'
  );
  const [sortBy, setSortBy] = React.useState<SortBy>(currentFilters.sortBy || 'score');
  const [sortOrder, setSortOrder] = React.useState<SortOrder>(currentFilters.sortOrder || 'desc');
  const [searchQuery, setSearchQuery] = React.useState(currentFilters.search || '');

  const handleScoreChange = (value: number[]) => {
    if (value.length === 2) {
      const range: [number, number] = [value[0], value[1]];
      setScoreRange(range);
      onOpportunityScoreChange(range[0], range[1]);
    }
  };

  const handleTypeChange = (value: string) => {
    const type = value as OpportunityType;
    setOpportunityType(type);
    onOpportunityTypeChange(type);
  };

  const handleSortChange = (value: string) => {
    const sort = value as SortBy;
    setSortBy(sort);
    onSortByChange(sort, sortOrder);
  };

  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    onSortByChange(sortBy, newOrder);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(searchQuery);
  };

  const handleReset = () => {
    setScoreRange([0, 100]);
    setOpportunityType('all');
    setSortBy('score');
    setSortOrder('desc');
    setSearchQuery('');
    onReset();
  };

  const getTypeIcon = (type: OpportunityType) => {
    switch (type) {
      case 'quick-win':
        return <Zap className="w-3 h-3" />;
      case 'strategic':
        return <Target className="w-3 h-3" />;
      case 'incremental':
        return <TrendingUp className="w-3 h-3" />;
      case 'long-term':
        return <Clock className="w-3 h-3" />;
      case 'maintain':
        return <Shield className="w-3 h-3" />;
      default:
        return <Filter className="w-3 h-3" />;
    }
  };

  return (
    <Card className="p-4 mb-4">
      <div className="space-y-4">
        {/* Search */}
        <div className="flex gap-2">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Opportunity Score Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Opportunity Score
            </label>
            <div className="px-2">
              <Slider
                value={scoreRange}
                onValueChange={handleScoreChange}
                max={100}
                min={0}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{scoreRange[0]}</span>
                <span>{scoreRange[1]}</span>
              </div>
            </div>
          </div>

          {/* Opportunity Type Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Opportunity Type</label>
            <Select value={opportunityType} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    {getTypeIcon('all')}
                    <span>All Types</span>
                  </div>
                </SelectItem>
                <SelectItem value="quick-win">
                  <div className="flex items-center gap-2">
                    {getTypeIcon('quick-win')}
                    <span>Quick Win</span>
                  </div>
                </SelectItem>
                <SelectItem value="strategic">
                  <div className="flex items-center gap-2">
                    {getTypeIcon('strategic')}
                    <span>Strategic</span>
                  </div>
                </SelectItem>
                <SelectItem value="incremental">
                  <div className="flex items-center gap-2">
                    {getTypeIcon('incremental')}
                    <span>Incremental</span>
                  </div>
                </SelectItem>
                <SelectItem value="long-term">
                  <div className="flex items-center gap-2">
                    {getTypeIcon('long-term')}
                    <span>Long-term</span>
                  </div>
                </SelectItem>
                <SelectItem value="maintain">
                  <div className="flex items-center gap-2">
                    {getTypeIcon('maintain')}
                    <span>Maintain</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort By */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Sort By</label>
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Opportunity Score</SelectItem>
                  <SelectItem value="impact">Projected Impact</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="products">Product Count</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={toggleSortOrder} className="shrink-0">
                {sortOrder === 'asc' ? (
                  <SortAsc className="w-4 h-4" />
                ) : (
                  <SortDesc className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Reset Button */}
          <div className="space-y-2">
            <label className="text-sm font-medium">&nbsp;</label>
            <Button variant="outline" onClick={handleReset} className="w-full">
              Reset Filters
            </Button>
          </div>
        </div>

        {/* Active Filters Summary */}
        {(opportunityType !== 'all' || scoreRange[0] > 0 || scoreRange[1] < 100 || searchQuery) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Active filters:</span>
            <div className="flex gap-2 flex-wrap">
              {opportunityType !== 'all' && (
                <span className="px-2 py-1 bg-gray-100 rounded-md">Type: {opportunityType}</span>
              )}
              {(scoreRange[0] > 0 || scoreRange[1] < 100) && (
                <span className="px-2 py-1 bg-gray-100 rounded-md">
                  Score: {scoreRange[0]}-{scoreRange[1]}
                </span>
              )}
              {searchQuery && (
                <span className="px-2 py-1 bg-gray-100 rounded-md">Search: "{searchQuery}"</span>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
