import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { embeddings } from '@/app/lib/ollama';
import { llm } from '@/app/lib/ollama';
import db from '@/app/lib/database';

interface Document {
    pageContent: string;
    metadata: Record<string, any>;
}

interface ScoredDocument extends Document {
    similarity: number;
}

export class CustomRetriever {
    private userId: string;

    constructor(userId: string) {
        this.userId = userId;
    }

    async getRelevantDocuments(query: string): Promise<Document[]> {
        console.log('Processing query:', query);
        console.log('User ID:', this.userId);

        try {
            // Generate embedding for the query
            const queryEmbedding = await embeddings.embedQuery(query);
            console.log('Query embedding generated');

            // Get documents from database
            const documents = db.prepare(`
                SELECT content, metadata, embedding
                FROM documents
                WHERE user_id = ?
            `).all(this.userId);

            console.log('Found documents:', documents.length);

            // Calculate similarity scores
            const scoredDocs = documents.map((doc: { content: string; metadata: string; embedding: string }) => {
                const docEmbedding = JSON.parse(doc.embedding);
                const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);
                const metadata = JSON.parse(doc.metadata);
                
                // Log document details and similarity score
                console.log('\n=== Document Similarity Details ===');
                console.log('Content preview:', doc.content.substring(0, 100) + '...');
                console.log('Page:', metadata.loc?.pageNumber || 'N/A');
                console.log('Similarity score:', similarity);
                console.log('================================\n');
                
                return {
                    pageContent: doc.content,
                    metadata: metadata,
                    similarity
                };
            });

            // Sort by similarity and get top 3
            const relevantDocs = scoredDocs
                .sort((a: ScoredDocument, b: ScoredDocument) => b.similarity - a.similarity)
                .slice(0, 3);

            console.log('\n=== Selected Documents ===');
            relevantDocs.forEach((doc: ScoredDocument, index: number) => {
                console.log(`\nTop ${index + 1} Document:`);
                console.log('Content preview:', doc.pageContent.substring(0, 100) + '...');
                console.log('Page:', doc.metadata.loc?.pageNumber || 'N/A');
                console.log('Similarity score:', doc.similarity);
            });
            console.log('\n=========================');

            return relevantDocs;
        } catch (error) {
            console.error('Error in getRelevantDocuments:', error);
            throw error;
        }
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }
}

export function createRetriever(userId: string) {
    return new CustomRetriever(userId);
}

export function createRetrieverChain(userId: string) {
    const retriever = createRetriever(userId);

    const prompt = PromptTemplate.fromTemplate(`
        다음은 사용자의 질문과 관련된 문서 내용입니다:

        {context}

        사용자의 질문: {question}

        위 문서 내용을 바탕으로 사용자의 질문에 답변해주세요. 문서에서 찾은 정보를 사용하여 정확하고 명확하게 답변해주세요.
        답변은 한국어로 작성해주세요.
    `);

    const chain = RunnableSequence.from([
        {
            context: async (input: { question: string }) => {
                const docs = await retriever.getRelevantDocuments(input.question);
                return docs.map(doc => `
                    [문서 ${docs.indexOf(doc) + 1}]
                    페이지: ${doc.metadata.page}
                    출처: ${doc.metadata.source}
                    
                    내용:
                    ${doc.pageContent}
                `).join('\n\n');
            },
            question: new RunnablePassthrough()
        },
        prompt,
        llm,
        new StringOutputParser()
    ]);

    return chain;
}
