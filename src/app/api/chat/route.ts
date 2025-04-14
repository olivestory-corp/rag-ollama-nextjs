import { NextRequest, NextResponse } from 'next/server';
import { llm } from '@/app/lib/ollama';
import { createRetriever } from '@/app/lib/runnables';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { question, userId } = await request.json();

        if (!question) {
            return NextResponse.json(
                { error: '질문을 입력해주세요.' },
                { status: 400 }
            );
        }

        // Create retriever for the user
        const retriever = createRetriever(userId);
        
        // Get relevant documents
        const sourceDocs = await retriever.getRelevantDocuments(question);
        if (!sourceDocs || sourceDocs.length === 0) {
            return NextResponse.json(
                { error: '관련 문서를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        // Format the context from source documents
        const context = sourceDocs.map((doc, index) => `
[문서 ${index + 1}]
페이지: ${doc.metadata.page}
출처: ${doc.metadata.source}

내용:
${doc.pageContent}
`).join('\n\n');

        // Create the messages array for the LLM
        const messages = [
            {
                role: 'system',
                content: `당신은 반드시 주어진 문서 내용에 기반하여 사용자의 질문에 답변하는 전문가입니다. 문서에 명시된 정보 외의 추가 설명이나 추측을 하지 말고, 오직 문서 내에 기재된 사실만을 활용하십시오. 만약 문서에 해당 정보가 명확히 나타나지 않는다면, "문서에 해당 정보가 명시되어 있지 않습니다."라고 답변하세요.\n\n다음은 관련된 문서 내용입니다:\n\n${context}`
            }            
            ,
            {
                role: 'user',
                content: question
            }
        ];

        // Verify Ollama model
        const modelName = process.env.OLLAMA_LLM_MODEL;
        if (!modelName) {
            throw new Error('OLLAMA_LLM_MODEL environment variable is not set');
        }
        console.log('Using Ollama model:', modelName);

        // Send request to Ollama API
        console.log('Sending request to Ollama API...');
        const response = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelName,
                messages: messages,
                stream: true,
                options: {
                    temperature: 0.7
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}\n${errorText}`);
        }

        if (!response.body) {
            throw new Error('No response body received');
        }

        // Create a new ReadableStream to process the response
        const stream = new ReadableStream({
            async start(controller) {
                const reader = response.body!.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        
                        if (done) {
                            console.log('Stream complete');
                            controller.close();
                            break;
                        }

                        // Decode the chunk and add it to the buffer
                        buffer += decoder.decode(value, { stream: true });
                        
                        // Process complete lines
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer

                        for (const line of lines) {
                            if (!line.trim()) continue;

                            try {
                                const data = JSON.parse(line);
                                if (data.message?.content) {
                                    // Encode and send the content with proper encoding
                                    const content = data.message.content;
                                    const encodedContent = new TextEncoder().encode(content);
                                    controller.enqueue(encodedContent);
                                }
                            } catch (e) {
                                console.error('Error parsing line:', e);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Stream processing error:', error);
                    controller.error(error);
                } finally {
                    reader.releaseLock();
                }
            }
        });

        // Prepare source documents data
        const sourceDocsData = sourceDocs.map((doc, index) => ({
            id: index + 1,
            page: doc.metadata.page,
            source: doc.metadata.source,
            content: doc.pageContent
        }));

        // Create headers with source documents
        const headers = new Headers();
        headers.set('Content-Type', 'text/event-stream; charset=utf-8');
        headers.set('Cache-Control', 'no-cache');
        headers.set('Connection', 'keep-alive');
        headers.set('X-Source-Documents', Buffer.from(JSON.stringify(sourceDocsData)).toString('base64'));

        // Return the streaming response
        return new Response(stream, { headers });

    } catch (error: any) {
        console.error('Error in chat route:', error);
        return NextResponse.json(
            { error: error.message || '서버 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
} 