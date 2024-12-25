/**
 * Content Mock Data
 * Version: 1.0.0
 * 
 * Provides mock content data for testing content-related functionality including
 * different content types, quality scores, metadata, and analysis results.
 * Supports testing of content discovery, ranking, and categorization features.
 */

import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { 
  Content, 
  ContentType, 
  ContentMetadata, 
  ContentAnalysis,
  QualityMetrics,
  MIN_QUALITY_THRESHOLD 
} from '../../../web/src/types/content.types';

// Mock content templates by type
const MOCK_CONTENT_TYPES: Record<ContentType, {
  titles: string[];
  descriptions: string[];
  urls: string[];
  metadata: Partial<ContentMetadata>[];
}> = {
  [ContentType.VIDEO]: {
    titles: [
      'Introduction to Machine Learning',
      'Deep Learning Fundamentals',
      'Neural Networks Explained'
    ],
    descriptions: [
      'Comprehensive overview of machine learning concepts and applications',
      'Deep dive into deep learning architectures and implementations',
      'Step-by-step explanation of neural network principles'
    ],
    urls: [
      'https://youtube.com/watch?v=ml-intro',
      'https://youtube.com/watch?v=deep-learning',
      'https://youtube.com/watch?v=neural-nets'
    ],
    metadata: [
      {
        contentSpecific: {
          duration: '45:30',
          resolution: '1080p',
          views: 150000
        }
      }
    ]
  },
  [ContentType.ARTICLE]: {
    titles: [
      'Understanding Data Structures',
      'Advanced Algorithm Design',
      'System Architecture Patterns'
    ],
    descriptions: [
      'In-depth guide to fundamental data structures',
      'Comprehensive coverage of algorithm design principles',
      'Overview of modern system architecture patterns'
    ],
    urls: [
      'https://medium.com/data-structures',
      'https://dev.to/algorithms',
      'https://blog.architecture'
    ],
    metadata: [
      {
        contentSpecific: {
          wordCount: 2500,
          readingTime: '12 min',
          citations: 15
        }
      }
    ]
  },
  [ContentType.PODCAST]: {
    titles: [
      'Tech Trends Weekly',
      'Developer Stories',
      'Cloud Computing Today'
    ],
    descriptions: [
      'Weekly discussion of emerging tech trends',
      'Interviews with leading developers',
      'Latest updates in cloud computing'
    ],
    urls: [
      'https://spotify.com/tech-trends',
      'https://spotify.com/dev-stories',
      'https://spotify.com/cloud-computing'
    ],
    metadata: [
      {
        contentSpecific: {
          duration: '58:20',
          episode: 42,
          season: 2
        }
      }
    ]
  },
  [ContentType.BOOK]: {
    titles: [
      'Clean Code',
      'Design Patterns',
      'Refactoring at Scale'
    ],
    descriptions: [
      'Guide to writing maintainable code',
      'Comprehensive coverage of software design patterns',
      'Strategies for large-scale code refactoring'
    ],
    urls: [
      'https://books.google.com/clean-code',
      'https://books.google.com/design-patterns',
      'https://books.google.com/refactoring'
    ],
    metadata: [
      {
        contentSpecific: {
          pages: 464,
          isbn: '978-0132350884',
          edition: '1st'
        }
      }
    ]
  }
};

// Mock analysis templates
const MOCK_ANALYSIS_TEMPLATES: Record<ContentType, Partial<ContentAnalysis>[]> = {
  [ContentType.VIDEO]: [
    {
      qualityMetrics: {
        relevance: 0.95,
        authority: 0.92,
        freshness: 0.88,
        completeness: 0.90,
        readability: 0.94
      }
    }
  ],
  [ContentType.ARTICLE]: [
    {
      qualityMetrics: {
        relevance: 0.93,
        authority: 0.89,
        freshness: 0.92,
        completeness: 0.95,
        readability: 0.91
      }
    }
  ],
  [ContentType.PODCAST]: [
    {
      qualityMetrics: {
        relevance: 0.91,
        authority: 0.94,
        freshness: 0.96,
        completeness: 0.89,
        readability: 0.92
      }
    }
  ],
  [ContentType.BOOK]: [
    {
      qualityMetrics: {
        relevance: 0.96,
        authority: 0.97,
        freshness: 0.85,
        completeness: 0.98,
        readability: 0.93
      }
    }
  ]
};

/**
 * Generates a single mock content item with specified characteristics
 */
export function generateMockContent(
  type: ContentType,
  qualityScore: number = 0.9,
  customMetadata?: Partial<ContentMetadata>
): Content {
  // Ensure quality score meets minimum threshold
  const normalizedQualityScore = Math.max(qualityScore, MIN_QUALITY_THRESHOLD);
  
  // Get random template data for the content type
  const templates = MOCK_CONTENT_TYPES[type];
  const titleIndex = Math.floor(Math.random() * templates.titles.length);
  
  // Generate base metadata
  const baseMetadata: ContentMetadata = {
    author: 'Test Author',
    publisher: 'Test Publisher',
    publishDate: new Date().toISOString(),
    language: 'en',
    keywords: ['test', 'mock', type.toLowerCase()],
    contentSpecific: {
      ...templates.metadata[0].contentSpecific,
      ...customMetadata?.contentSpecific
    }
  };

  // Generate analysis results
  const analysisTemplate = MOCK_ANALYSIS_TEMPLATES[type][0];
  const analysisResults: ContentAnalysis = {
    contentId: uuidv4(),
    qualityMetrics: analysisTemplate.qualityMetrics as QualityMetrics,
    analysisDate: new Date().toISOString(),
    version: '1.0.0'
  };

  return {
    id: uuidv4(),
    topicId: uuidv4(),
    type,
    title: templates.titles[titleIndex],
    description: templates.descriptions[titleIndex],
    sourceUrl: templates.urls[titleIndex],
    qualityScore: normalizedQualityScore,
    metadata: {
      ...baseMetadata,
      ...customMetadata
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analysisResults
  };
}

/**
 * Generates an array of mock content items with varied characteristics
 */
export function generateMockContentList(
  count: number,
  types?: ContentType[]
): Content[] {
  const contentTypes = types || Object.values(ContentType);
  const mockContents: Content[] = [];

  for (let i = 0; i < count; i++) {
    const type = contentTypes[i % contentTypes.length];
    const qualityScore = MIN_QUALITY_THRESHOLD + (Math.random() * (1 - MIN_QUALITY_THRESHOLD));
    mockContents.push(generateMockContent(type, qualityScore));
  }

  return mockContents;
}

// Export single mock content item for basic tests
export const mockContent: Content = generateMockContent(ContentType.ARTICLE);

// Export mock content list for list-based tests
export const mockContentList: Content[] = generateMockContentList(10);