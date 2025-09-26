import React, { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { cn, debounce } from '../../utils';

export interface TaskFiltersProps {
  searchQuery: string;
  sortBy: 'name' | 'total_executions' | 'success_rate' | 'average_duration';
  sortOrder: 'asc' | 'desc';
  onSearchChange: (query: string) => void;
  onSortChange: (sortBy: TaskFiltersProps['sortBy'], sortOrder: TaskFiltersProps['sortOrder']) => void;
  onClearFilters: () => void;
  className?: string;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  searchQuery,
  sortBy,
  sortOrder,
  onSearchChange,
  onSortChange,
  onClearFilters,
  className,
}) => {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Debounced search to avoid too many API calls
  const debouncedSearch = debounce((query: string) => {
    onSearchChange(query);
  }, 300);

  useEffect(() => {
    debouncedSearch(localSearchQuery);
  }, [localSearchQuery, debouncedSearch]);

  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  const handleSortChange = (newSortBy: TaskFiltersProps['sortBy']) => {
    if (newSortBy === sortBy) {
      // Toggle sort order if same field
      onSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to ascending for new field
      onSortChange(newSortBy, 'asc');
    }
  };

  const getSortIcon = (field: TaskFiltersProps['sortBy']) => {
    if (sortBy !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
      </svg>
    );
  };

  const hasActiveFilters = searchQuery.trim() !== '' || sortBy !== 'name' || sortOrder !== 'asc';

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search Bar */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search tasks by name or description..."
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            leftIcon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            rightIcon={
              localSearchQuery && (
                <button
                  onClick={() => setLocalSearchQuery('')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )
            }
          />
        </div>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="whitespace-nowrap"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Sort Options */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Sort by:</span>
        
        <Button
          variant={sortBy === 'name' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => handleSortChange('name')}
          className="flex items-center space-x-1"
        >
          <span>Name</span>
          {getSortIcon('name')}
        </Button>

        <Button
          variant={sortBy === 'total_executions' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => handleSortChange('total_executions')}
          className="flex items-center space-x-1"
        >
          <span>Total Runs</span>
          {getSortIcon('total_executions')}
        </Button>

        <Button
          variant={sortBy === 'success_rate' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => handleSortChange('success_rate')}
          className="flex items-center space-x-1"
        >
          <span>Success Rate</span>
          {getSortIcon('success_rate')}
        </Button>

        <Button
          variant={sortBy === 'average_duration' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => handleSortChange('average_duration')}
          className="flex items-center space-x-1"
        >
          <span>Avg Duration</span>
          {getSortIcon('average_duration')}
        </Button>
      </div>
    </div>
  );
};