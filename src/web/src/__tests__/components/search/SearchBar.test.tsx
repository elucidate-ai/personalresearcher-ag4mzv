/**
 * SearchBar Component Tests
 * @version 1.0.0
 * @description Comprehensive test suite for the SearchBar component validating search functionality,
 * accessibility, loading states, error handling, and responsive behavior.
 */

import React from 'react'; // ^18.0.0
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // ^4.7.0
import { SearchBar } from '../../../components/search/SearchBar';
import { useSearch } from '../../../hooks/useSearch';

// Mock the useSearch hook
jest.mock('../../../hooks/useSearch');

// Mock ResizeObserver for responsive tests
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('SearchBar', () => {
  // Test setup
  const mockHandleSearch = jest.fn();
  const mockClearSearch = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    (useSearch as jest.Mock).mockImplementation(() => ({
      searchQuery: '',
      isLoading: false,
      error: null,
      handleSearch: mockHandleSearch,
      clearSearch: mockClearSearch,
      suggestions: []
    }));
  });

  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<SearchBar />);
      const searchInput = screen.getByRole('searchbox');
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('placeholder', 'Search topics...');
    });

    it('renders with custom placeholder', () => {
      render(<SearchBar placeholder="Custom placeholder" />);
      expect(screen.getByRole('searchbox')).toHaveAttribute(
        'placeholder',
        'Custom placeholder'
      );
    });

    it('renders with search icon', () => {
      render(<SearchBar />);
      const searchIcon = screen.getByTestId('SearchRoundedIcon');
      expect(searchIcon).toBeInTheDocument();
      expect(searchIcon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Functionality', () => {
    it('handles input changes with debouncing', async () => {
      const user = userEvent.setup();
      render(<SearchBar debounceMs={300} />);
      
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'test query');

      // Wait for debounce
      await waitFor(() => {
        expect(mockHandleSearch).toHaveBeenCalledWith('test query');
      }, { timeout: 400 });
    });

    it('validates minimum length requirement', async () => {
      const user = userEvent.setup();
      render(<SearchBar minLength={3} />);
      
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'te');

      expect(screen.getByText('Please enter at least 3 characters')).toBeInTheDocument();
      expect(mockHandleSearch).not.toHaveBeenCalled();
    });

    it('handles clear button click', async () => {
      const user = userEvent.setup();
      (useSearch as jest.Mock).mockImplementation(() => ({
        searchQuery: 'test',
        isLoading: false,
        error: null,
        handleSearch: mockHandleSearch,
        clearSearch: mockClearSearch
      }));

      render(<SearchBar />);
      
      const clearButton = screen.getByRole('button', { name: /clear search/i });
      await user.click(clearButton);

      expect(mockClearSearch).toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('displays loading spinner when searching', () => {
      (useSearch as jest.Mock).mockImplementation(() => ({
        searchQuery: 'test',
        isLoading: true,
        error: null,
        handleSearch: mockHandleSearch,
        clearSearch: mockClearSearch
      }));

      render(<SearchBar />);
      
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('disables input during loading', () => {
      (useSearch as jest.Mock).mockImplementation(() => ({
        searchQuery: 'test',
        isLoading: true,
        error: null,
        handleSearch: mockHandleSearch,
        clearSearch: mockClearSearch
      }));

      render(<SearchBar />);
      
      const searchInput = screen.getByRole('searchbox');
      expect(searchInput).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Error Handling', () => {
    it('displays error message when search fails', () => {
      const error = new Error('Search failed');
      (useSearch as jest.Mock).mockImplementation(() => ({
        searchQuery: 'test',
        isLoading: false,
        error,
        handleSearch: mockHandleSearch,
        clearSearch: mockClearSearch
      }));

      render(<SearchBar onError={mockOnError} />);
      
      expect(screen.getByRole('alert')).toHaveTextContent('Search failed');
      expect(mockOnError).toHaveBeenCalledWith(error);
    });

    it('shows validation error for invalid input', async () => {
      const user = userEvent.setup();
      render(<SearchBar minLength={3} />);
      
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'a');

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Please enter at least 3 characters'
      );
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG accessibility guidelines', async () => {
      const { container } = render(<SearchBar />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('handles keyboard navigation correctly', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);
      
      const searchInput = screen.getByRole('searchbox');
      await user.tab();
      
      expect(searchInput).toHaveFocus();
    });

    it('announces loading state to screen readers', () => {
      (useSearch as jest.Mock).mockImplementation(() => ({
        searchQuery: 'test',
        isLoading: true,
        error: null,
        handleSearch: mockHandleSearch,
        clearSearch: mockClearSearch
      }));

      render(<SearchBar />);
      
      expect(screen.getByText('Loading')).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Responsive Behavior', () => {
    it('renders full width on mobile viewport', () => {
      global.innerWidth = 320;
      global.dispatchEvent(new Event('resize'));

      render(<SearchBar fullWidth />);
      
      const searchContainer = screen.getByRole('search');
      expect(searchContainer).toHaveClass('w-full');
    });

    it('adjusts input size based on viewport', () => {
      global.innerWidth = 1024;
      global.dispatchEvent(new Event('resize'));

      render(<SearchBar />);
      
      const searchContainer = screen.getByRole('search');
      expect(searchContainer).toHaveClass('md:w-auto');
    });
  });

  describe('Integration', () => {
    it('integrates correctly with useSearch hook', async () => {
      const user = userEvent.setup();
      (useSearch as jest.Mock).mockImplementation(() => ({
        searchQuery: '',
        isLoading: false,
        error: null,
        handleSearch: mockHandleSearch,
        clearSearch: mockClearSearch,
        suggestions: ['suggestion1', 'suggestion2']
      }));

      render(<SearchBar />);
      
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'test query');

      await waitFor(() => {
        expect(mockHandleSearch).toHaveBeenCalledWith('test query');
      });
    });

    it('handles search lifecycle correctly', async () => {
      const user = userEvent.setup();
      let isLoading = false;
      
      (useSearch as jest.Mock).mockImplementation(() => ({
        searchQuery: '',
        isLoading,
        error: null,
        handleSearch: (query: string) => {
          isLoading = true;
          mockHandleSearch(query);
        },
        clearSearch: mockClearSearch
      }));

      render(<SearchBar />);
      
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'test query');

      await waitFor(() => {
        expect(isLoading).toBe(true);
      });
    });
  });
});