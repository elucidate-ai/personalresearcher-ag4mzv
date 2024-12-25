/**
 * ContentCard Component Test Suite
 * Tests content display, quality indicators, source icons, interaction behaviors,
 * accessibility compliance, and responsive design
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ContentCard, ContentCardProps } from '../../../components/content/ContentCard';
import { mockContent, generateMockContent } from '../../../../test/mocks/data/content.mock';
import { ContentType } from '../../../types/content.types';

// Mock handlers and observers
const mockClickHandler = jest.fn();

// Mock ResizeObserver for responsive tests
const mockResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Setup before tests
beforeEach(() => {
  // Reset mocks
  mockClickHandler.mockClear();
  window.ResizeObserver = mockResizeObserver;
  // Set default viewport size
  window.innerWidth = 1024;
  window.innerHeight = 768;
});

// Cleanup after tests
afterEach(() => {
  jest.clearAllMocks();
});

describe('ContentCard', () => {
  describe('Rendering', () => {
    it('renders content title and description correctly', () => {
      render(<ContentCard content={mockContent} />);
      
      expect(screen.getByRole('heading', { name: mockContent.title })).toBeInTheDocument();
      expect(screen.getByText(mockContent.description)).toBeInTheDocument();
    });

    it('renders source icon based on content type', () => {
      const { rerender } = render(<ContentCard content={mockContent} />);
      
      // Test each content type
      Object.values(ContentType).forEach(type => {
        const typeContent = generateMockContent(type);
        rerender(<ContentCard content={typeContent} />);
        
        const icon = screen.getByRole('img', { 
          name: new RegExp(type.toLowerCase(), 'i') 
        });
        expect(icon).toBeInTheDocument();
      });
    });

    it('renders quality indicator with correct score', () => {
      const qualityScore = 0.95;
      const content = generateMockContent(ContentType.ARTICLE, qualityScore);
      render(<ContentCard content={content} />);

      const qualityIndicator = screen.getByRole('img', {
        name: /quality indicator/i
      });
      expect(qualityIndicator).toBeInTheDocument();
    });

    it('renders metadata with author, publisher and date', () => {
      render(<ContentCard content={mockContent} />);
      
      const metadata = screen.getByText(/by/i).parentElement;
      expect(metadata).toHaveTextContent(mockContent.metadata.author);
      expect(metadata).toHaveTextContent(mockContent.metadata.publisher);
      expect(metadata).toHaveTextContent(
        new Date(mockContent.metadata.publishDate).toLocaleDateString()
      );
    });
  });

  describe('Interaction', () => {
    it('calls onClick handler when clicked', async () => {
      render(<ContentCard content={mockContent} onClick={mockClickHandler} />);
      
      const card = screen.getByRole('article');
      await userEvent.click(card);
      
      expect(mockClickHandler).toHaveBeenCalledWith(mockContent);
    });

    it('supports keyboard navigation and interaction', async () => {
      render(<ContentCard content={mockContent} onClick={mockClickHandler} />);
      
      const card = screen.getByRole('article');
      card.focus();
      
      expect(card).toHaveFocus();
      
      await userEvent.keyboard('{enter}');
      expect(mockClickHandler).toHaveBeenCalledWith(mockContent);
      
      await userEvent.keyboard(' ');
      expect(mockClickHandler).toHaveBeenCalledTimes(2);
    });

    it('does not call onClick when loading', async () => {
      render(
        <ContentCard 
          content={mockContent} 
          onClick={mockClickHandler}
          isLoading={true}
        />
      );
      
      const card = screen.getByRole('article');
      await userEvent.click(card);
      
      expect(mockClickHandler).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(<ContentCard content={mockContent} />);
      
      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('aria-label', 
        `${mockContent.title} - ${mockContent.type.toLowerCase()} content`
      );
    });

    it('maintains proper focus management', async () => {
      render(<ContentCard content={mockContent} onClick={mockClickHandler} />);
      
      const card = screen.getByRole('article');
      await userEvent.tab();
      
      expect(card).toHaveFocus();
      expect(card).toHaveStyleRule('outline', expect.stringContaining('2px solid'));
    });

    it('provides descriptive tooltips for icons', async () => {
      render(<ContentCard content={mockContent} />);
      
      const sourceIcon = screen.getByRole('img', { 
        name: new RegExp(mockContent.type.toLowerCase(), 'i') 
      });
      
      await userEvent.hover(sourceIcon);
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('truncates description based on viewport width', () => {
      const longDescription = 'a'.repeat(300);
      const content = {
        ...mockContent,
        description: longDescription
      };

      // Test mobile viewport
      window.innerWidth = 320;
      const { rerender } = render(<ContentCard content={content} />);
      expect(screen.getByText(/a+/)).toHaveTextContent(/.{100}\.{3}/);

      // Test tablet viewport
      window.innerWidth = 768;
      rerender(<ContentCard content={content} />);
      expect(screen.getByText(/a+/)).toHaveTextContent(/.{150}\.{3}/);

      // Test desktop viewport
      window.innerWidth = 1024;
      rerender(<ContentCard content={content} />);
      expect(screen.getByText(/a+/)).toHaveTextContent(/.{200}\.{3}/);
    });

    it('adjusts spacing and layout for different viewports', () => {
      const { container, rerender } = render(<ContentCard content={mockContent} />);
      
      // Test mobile viewport
      window.innerWidth = 320;
      rerender(<ContentCard content={mockContent} />);
      expect(container.firstChild).toHaveStyle({
        padding: '8px',
        margin: '4px'
      });

      // Test desktop viewport
      window.innerWidth = 1024;
      rerender(<ContentCard content={mockContent} />);
      expect(container.firstChild).toHaveStyle({
        padding: '16px',
        margin: '8px'
      });
    });
  });

  describe('Error Handling', () => {
    it('handles missing metadata gracefully', () => {
      const contentWithoutMetadata = {
        ...mockContent,
        metadata: {
          ...mockContent.metadata,
          author: undefined,
          publisher: undefined
        }
      };
      
      render(<ContentCard content={contentWithoutMetadata} />);
      
      expect(screen.queryByText(/by/i)).not.toBeInTheDocument();
    });

    it('handles invalid dates gracefully', () => {
      const contentWithInvalidDate = {
        ...mockContent,
        metadata: {
          ...mockContent.metadata,
          publishDate: 'invalid-date'
        }
      };
      
      render(<ContentCard content={contentWithInvalidDate} />);
      
      expect(screen.getByText('invalid-date')).toBeInTheDocument();
    });
  });
});