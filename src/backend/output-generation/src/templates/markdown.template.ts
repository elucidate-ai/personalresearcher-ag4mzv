/**
 * @fileoverview Markdown template implementation for generating secure and well-structured documents
 * Supports multimedia content, knowledge graphs, and personalized learning paths
 * @version 1.0.0
 */

import { marked } from 'marked'; // v9.0.0
import {
  DocumentContent,
  DocumentSection,
  Reference,
  GraphData
} from '../models/document.model';

// Constants for markdown formatting
const MARKDOWN_HEADING_CHARS = '#';
const MARKDOWN_CODE_BLOCK = '```';
const MARKDOWN_MERMAID_START = '```mermaid';
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^\)]+)\)/g;
const MAX_HEADING_LEVEL = 6;

/**
 * Generates a secure and well-structured markdown document
 * @param content - Document content to be formatted
 * @returns Sanitized and formatted markdown content
 */
export function generateMarkdown(content: DocumentContent): string {
  // Configure marked for secure rendering
  marked.setOptions({
    headerIds: false,
    mangle: false,
    sanitize: true
  });

  let markdown = '';

  // Add document metadata
  markdown += `# ${marked.parseInline(content.metadata.title)}\n\n`;
  markdown += `> Generated on: ${content.metadata.createdAt.toISOString()}\n`;
  markdown += `> Author: ${marked.parseInline(content.metadata.author)}\n`;
  markdown += `> Version: ${content.metadata.version}\n\n`;

  // Add tags if present
  if (content.metadata.tags.length > 0) {
    markdown += '**Tags**: ' + content.metadata.tags
      .map(tag => `\`${marked.parseInline(tag)}\``)
      .join(', ') + '\n\n';
  }

  // Process main content sections
  content.sections.forEach(section => {
    markdown += formatSection(section, 1) + '\n';
  });

  // Add knowledge graphs if present
  if (content.graphs.length > 0) {
    markdown += '\n## Knowledge Graphs\n\n';
    markdown += formatGraphs(content.graphs);
  }

  // Add references if present
  if (content.references.length > 0) {
    markdown += formatReferences(content.references);
  }

  return markdown;
}

/**
 * Formats a document section into markdown with proper heading levels
 * @param section - Section to format
 * @param level - Current heading level
 * @returns Formatted section markdown
 */
function formatSection(section: DocumentSection, level: number): string {
  if (level > MAX_HEADING_LEVEL) {
    level = MAX_HEADING_LEVEL;
  }

  let sectionMd = '';

  // Add section heading
  sectionMd += `${MARKDOWN_HEADING_CHARS.repeat(level)} ${marked.parseInline(section.title)}\n\n`;

  // Add section content with proper sanitization
  if (section.content) {
    sectionMd += `${marked(section.content)}\n\n`;
  }

  // Process subsections recursively
  if (section.subsections && section.subsections.length > 0) {
    section.subsections
      .sort((a, b) => a.order - b.order)
      .forEach(subsection => {
        sectionMd += formatSection(subsection, level + 1);
      });
  }

  return sectionMd;
}

/**
 * Converts knowledge graphs into secure mermaid diagrams
 * @param graphs - Array of graph data to format
 * @returns Markdown representation of graphs
 */
function formatGraphs(graphs: GraphData[]): string {
  let graphsMd = '';

  graphs.forEach((graph, index) => {
    graphsMd += `### Graph ${index + 1}: ${marked.parseInline(graph.nodes[0]?.label || 'Knowledge Graph')}\n\n`;
    graphsMd += `${MARKDOWN_MERMAID_START}\n`;
    graphsMd += `graph TD\n`;

    // Add nodes
    graph.nodes.forEach(node => {
      graphsMd += `    ${node.id}["${marked.parseInline(node.label)}"]\n`;
    });

    // Add edges
    graph.edges.forEach(edge => {
      graphsMd += `    ${edge.source} --> |${marked.parseInline(edge.type)}| ${edge.target}\n`;
    });

    graphsMd += `${MARKDOWN_CODE_BLOCK}\n\n`;

    // Add graph metadata if present
    if (graph.metadata?.style) {
      graphsMd += '> Graph Style: ' + JSON.stringify(graph.metadata.style) + '\n\n';
    }
  });

  return graphsMd;
}

/**
 * Formats document references in markdown with proper citations
 * @param references - Array of references to format
 * @returns Formatted references section
 */
function formatReferences(references: Reference[]): string {
  let refMd = '\n## References\n\n';

  references.forEach((ref, index) => {
    // Format reference with proper citation style
    refMd += `${index + 1}. `;
    
    // Add authors if present
    if (ref.authors && ref.authors.length > 0) {
      refMd += ref.authors
        .map(author => marked.parseInline(author))
        .join(', ') + '. ';
    }

    // Add title with link if URL is present
    if (ref.url) {
      refMd += `[${marked.parseInline(ref.title)}](${encodeURI(ref.url)})`;
    } else {
      refMd += marked.parseInline(ref.title);
    }

    // Add reference type if present
    if (ref.type) {
      refMd += ` _(${marked.parseInline(ref.type)})_`;
    }

    refMd += '\n';
  });

  return refMd;
}

export default generateMarkdown;