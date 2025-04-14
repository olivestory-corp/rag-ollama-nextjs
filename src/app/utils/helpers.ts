export function combineDocuments(retrievedDocs: { pageContent: string }[] | null | undefined): string {
    if (!retrievedDocs || !Array.isArray(retrievedDocs)) {
        console.warn('No documents to combine');
        return '';
    }
    
    return retrievedDocs
        .map((doc: { pageContent: string }) => doc.pageContent)
        .filter(content => content && content.trim().length > 0)
        .join("\n");
}

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error('Vectors must have equal length');
    }
    if (a.length === 0 || b.length === 0) {
        throw new Error('Vectors must not be empty');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        magnitudeA += a[i] * a[i];
        magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
        throw new Error('Vector magnitude must not be zero');
    }

    return dotProduct / (magnitudeA * magnitudeB);
}