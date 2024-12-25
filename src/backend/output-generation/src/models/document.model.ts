/**
 * @fileoverview Core document model for the output generation service
 * Defines structure and types for documents including content organization,
 * export formats, metadata, knowledge graphs, and references
 * @version 1.0.0
 */

// Interfaces
export interface DocumentMetadata {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    author: string;
    version: string;
    tags: string[];
}

export interface DocumentSection {
    id: string;
    title: string;
    content: string;  // Markdown format
    level: number;    // 1-6 for heading levels
    subsections: DocumentSection[];
    order: number;
}

export interface Node {
    id: string;
    label: string;
    properties: Record<string, unknown>;
}

export interface Edge {
    source: string;
    target: string;
    type: string;
    properties: Record<string, unknown>;
}

export interface GraphMetadata {
    layout: string;
    zoom: number;
    center: { x: number; y: number };
    style: Record<string, unknown>;
}

export interface GraphData {
    id: string;
    nodes: Node[];
    edges: Edge[];
    metadata: GraphMetadata;
}

export interface Reference {
    id: string;
    type: string;
    title: string;
    url: string;
    authors: string[];
}

export interface DocumentContent {
    metadata: DocumentMetadata;
    sections: DocumentSection[];
    graphs: GraphData[];
    references: Reference[];
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

interface ValidationError {
    code: string;
    message: string;
    path: string;
}

interface ValidationWarning {
    code: string;
    message: string;
    path: string;
}

// Enums
export enum ExportFormat {
    MARKDOWN = 'MARKDOWN',
    PDF = 'PDF',
    NOTION = 'NOTION',
    HTML = 'HTML',
    DOCX = 'DOCX'
}

/**
 * Core document class that manages document content and operations
 * with enhanced validation and security features
 */
export class Document {
    private _content: DocumentContent;
    private _format: ExportFormat;
    private _lastValidated: Date;
    private readonly VALIDATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Creates a new Document instance with content validation and sanitization
     * @param content - The document content structure
     * @param format - The desired export format
     */
    constructor(content: DocumentContent, format: ExportFormat) {
        this.validateInitialContent(content);
        this._content = this.deepCopyContent(content);
        this._format = format;
        this._lastValidated = new Date();
        this.sanitize();
    }

    /**
     * Retrieves a deep copy of the document content
     * @returns Complete document content structure
     */
    public getContent(): DocumentContent {
        this.validateContentIfNeeded();
        return this.deepCopyContent(this._content);
    }

    /**
     * Performs comprehensive document validation
     * @returns Detailed validation results
     */
    public validate(): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // Validate metadata
        this.validateMetadata(this._content.metadata, errors, warnings);

        // Validate sections
        this.validateSections(this._content.sections, errors, warnings);

        // Validate graphs
        this.validateGraphs(this._content.graphs, errors, warnings);

        // Validate references
        this.validateReferences(this._content.references, errors, warnings);

        this._lastValidated = new Date();

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Sanitizes document content for security
     */
    public sanitize(): void {
        this.sanitizeMetadata();
        this.sanitizeSections();
        this.sanitizeGraphs();
        this.sanitizeReferences();
    }

    private validateInitialContent(content: DocumentContent): void {
        if (!content || !content.metadata || !content.sections) {
            throw new Error('Invalid document content structure');
        }
    }

    private validateContentIfNeeded(): void {
        const now = new Date();
        if (now.getTime() - this._lastValidated.getTime() > this.VALIDATION_CACHE_TTL) {
            this.validate();
        }
    }

    private deepCopyContent(content: DocumentContent): DocumentContent {
        return JSON.parse(JSON.stringify(content));
    }

    private validateMetadata(
        metadata: DocumentMetadata,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        if (!metadata.id || !metadata.title) {
            errors.push({
                code: 'INVALID_METADATA',
                message: 'Required metadata fields missing',
                path: 'metadata'
            });
        }
    }

    private validateSections(
        sections: DocumentSection[],
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        sections.forEach((section, index) => {
            if (!section.id || !section.title) {
                errors.push({
                    code: 'INVALID_SECTION',
                    message: `Invalid section at index ${index}`,
                    path: `sections[${index}]`
                });
            }
            if (section.subsections) {
                this.validateSections(section.subsections, errors, warnings);
            }
        });
    }

    private validateGraphs(
        graphs: GraphData[],
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        graphs.forEach((graph, index) => {
            if (!graph.id || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
                errors.push({
                    code: 'INVALID_GRAPH',
                    message: `Invalid graph at index ${index}`,
                    path: `graphs[${index}]`
                });
            }
        });
    }

    private validateReferences(
        references: Reference[],
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        references.forEach((reference, index) => {
            if (!reference.id || !reference.title) {
                errors.push({
                    code: 'INVALID_REFERENCE',
                    message: `Invalid reference at index ${index}`,
                    path: `references[${index}]`
                });
            }
        });
    }

    private sanitizeMetadata(): void {
        this._content.metadata = {
            ...this._content.metadata,
            title: this.sanitizeString(this._content.metadata.title),
            tags: this._content.metadata.tags.map(tag => this.sanitizeString(tag))
        };
    }

    private sanitizeSections(): void {
        const sanitizeSection = (section: DocumentSection): DocumentSection => ({
            ...section,
            title: this.sanitizeString(section.title),
            content: this.sanitizeMarkdown(section.content),
            subsections: section.subsections.map(sanitizeSection)
        });

        this._content.sections = this._content.sections.map(sanitizeSection);
    }

    private sanitizeGraphs(): void {
        this._content.graphs = this._content.graphs.map(graph => ({
            ...graph,
            nodes: graph.nodes.map(node => ({
                ...node,
                label: this.sanitizeString(node.label)
            }))
        }));
    }

    private sanitizeReferences(): void {
        this._content.references = this._content.references.map(reference => ({
            ...reference,
            title: this.sanitizeString(reference.title),
            url: this.sanitizeUrl(reference.url),
            authors: reference.authors.map(author => this.sanitizeString(author))
        }));
    }

    private sanitizeString(str: string): string {
        return str.replace(/[<>]/g, '');
    }

    private sanitizeMarkdown(markdown: string): string {
        // Basic markdown sanitization
        return markdown.replace(/<(script|iframe|object|embed|form)/gi, '&lt;$1');
    }

    private sanitizeUrl(url: string): string {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.toString();
        } catch {
            return '';
        }
    }
}