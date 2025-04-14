import { NextRequest, NextResponse } from 'next/server';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { embeddings } from '@/app/lib/ollama';
import db from '@/app/lib/database';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import fs from 'fs';
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const userId = req.headers.get('User-Id') || 'test-user';
        
        // Get documents for the user
        const userDocuments = db.prepare(`
            SELECT content, metadata 
            FROM documents 
            WHERE user_id = ?
        `).all(userId);

        return NextResponse.json({ success: true, documents: userDocuments });
    } catch (error) {
        console.error('Document fetch error:', error);
        return NextResponse.json({ success: false, error: (error as Error).message });
    }
}

export async function POST(request: NextRequest) {
    console.log('=== Starting document processing ===');
    const userId = request.headers.get('User-Id') || 'test-user';
    console.log('User ID:', userId);

    try {
        // Check content type to handle both multipart form data and JSON
        const contentType = request.headers.get('Content-Type') || '';
        console.log('Content-Type:', contentType);

        let filePath: string;

        if (contentType.includes('multipart/form-data')) {
            console.log('Processing multipart/form-data request');
            const formData = await request.formData();
            const file = formData.get('file') as File;
            
            if (!file) {
                return new Response(JSON.stringify({ error: 'No file provided' }), { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            console.log('File received:', file.name, file.size, 'bytes');
            
            // Delete existing documents for the user
            console.log('Deleting existing documents for user:', userId);
            db.prepare('DELETE FROM documents WHERE user_id = ?').run(userId);
            console.log('Existing documents deleted');
            
            // Save the file to a temporary location
            const buffer = Buffer.from(await file.arrayBuffer());
            filePath = join(tmpdir(), file.name);
            await writeFile(filePath, buffer);
            console.log('File saved to:', filePath);

            // Return success for file upload
            return new Response(JSON.stringify({ 
                success: true, 
                message: '파일이 업로드되었습니다.',
                path: filePath 
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else if (contentType.includes('application/json')) {
            console.log('Processing application/json request');
            const { path } = await request.json();
            console.log('Request data:', { path });
            
            if (!path) {
                return new Response(JSON.stringify({ error: 'No file path provided' }), { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            filePath = path;
            console.log('File path:', filePath);

            // Check if file exists
            if (!fs.existsSync(filePath)) {
                return new Response(JSON.stringify({ error: 'File not found' }), { 
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Create transform stream for progress updates
            const stream = new TransformStream();
            const writer = stream.writable.getWriter();
            const encoder = new TextEncoder();

            // Start processing in the background
            (async () => {
                try {
                    // Initialize PDF loader with text splitter configuration
                    console.log('PDFLoader initialized with file:', filePath);
                    const loader = new PDFLoader(filePath, {
                        splitPages: true,
                        parsedItemSeparator: "\n",
                    });
                    
                    try {
                        // Load documents
                        console.log('Attempting to load PDF documents...');
                        const rawDocuments = await loader.load();
                        console.log('Documents loaded successfully:', rawDocuments.length);
                        
                        // Initialize text splitter with improved configuration
                        console.log('Initializing text splitter...');
                        const textSplitter = new RecursiveCharacterTextSplitter({
                            chunkSize: 1000,
                            chunkOverlap: 200,
                            lengthFunction: (text) => text.length,
                            separators: ["\n\n", "\n", "。", ".", "!", "?", "！", "？", " ", ""],
                        });
                        
                        // Split documents
                        console.log('Splitting documents...');
                        let documents = await textSplitter.splitDocuments(rawDocuments);
                        console.log('Documents split successfully:', documents.length);
                        
                        // Remove duplicate chunks
                        const seen = new Set();
                        documents = documents.filter(doc => {
                            const content = doc.pageContent.trim();
                            if (content.length < 10 || seen.has(content)) return false;
                            seen.add(content);
                            return true;
                        });
                        
                        const totalPages = documents.length;
                        console.log('Total pages after deduplication:', totalPages);
                        
                        // Process each document
                        for (let i = 0; i < documents.length; i++) {
                            const doc = documents[i];
                            const currentPage = i + 1;
                            
                            // Skip very short chunks
                            if (doc.pageContent.trim().length < 10) {
                                console.log('Skipping very short chunk:', doc.pageContent);
                                continue;
                            }
                            
                            console.log('Processing page:', currentPage);
                            
                            // Generate embeddings
                            const embedding = await embeddings.embedQuery(doc.pageContent);
                            console.log('Embeddings generated for page:', currentPage);
                            
                            // Store in database
                            const metadata = {
                                ...doc.metadata,
                                source: filePath
                            };
                            
                            db.prepare(`
                                INSERT INTO documents (user_id, content, metadata, embedding)
                                VALUES (?, ?, ?, ?)
                            `).run(
                                userId,
                                doc.pageContent,
                                JSON.stringify(metadata),
                                JSON.stringify(embedding)
                            );
                            
                            console.log('Page stored in database:', currentPage);

                            // Send progress update
                            const progress = Math.round((currentPage / totalPages) * 100);
                            await writer.write(encoder.encode(JSON.stringify({
                                progress,
                                currentPage,
                                totalPages,
                                status: `페이지 처리 중: ${currentPage}/${totalPages}`
                            }) + '\n'));
                        }

                        // Send completion message
                        await writer.write(encoder.encode(JSON.stringify({
                            success: true,
                            message: '문서 처리가 완료되었습니다.',
                            progress: 100,
                            currentPage: totalPages,
                            totalPages
                        }) + '\n'));

                        await writer.close();
                    } catch (error) {
                        console.error('Error processing document:', error);
                        await writer.write(encoder.encode(JSON.stringify({
                            error: (error as Error).message,
                            status: '문서 처리 중 오류가 발생했습니다.'
                        }) + '\n'));
                        await writer.abort(error as Error);
                    }
                } catch (error) {
                    console.error('Error processing document:', error);
                    await writer.write(encoder.encode(JSON.stringify({
                        error: (error as Error).message,
                        status: '문서 처리 중 오류가 발생했습니다.'
                    }) + '\n'));
                    await writer.abort(error as Error);
                }
            })();

            // Return the stream
            return new Response(stream.readable, {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        } else {
            return new Response(JSON.stringify({ error: 'Unsupported content type' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ 
            error: (error as Error).message,
            status: '문서 처리 중 오류가 발생했습니다.'
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const userId = req.headers.get('User-Id') || 'test-user';
        
        // Delete documents for the user
        const stmt = db.prepare('DELETE FROM documents WHERE user_id = ?');
        stmt.run(userId);

        return new Response(JSON.stringify({ 
            success: true,
            message: 'Documents deleted successfully'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Document deletion error:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to delete documents',
            details: (error as Error).message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}