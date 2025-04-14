import { Document } from 'langchain/document';

export function combineDocuments(docs: Document[]): Document[] {
    return docs.map(doc => ({
        pageContent: doc.pageContent,
        metadata: doc.metadata
    }));
} 