"use client";

import { useState, useEffect, useRef } from "react";
import { parse } from 'marked';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { useRouter } from "next/navigation";

// Electron IPC 통신을 위한 타입 정의
declare global {
    interface Window {
        electronAPI: {
            uploadFile: (fileData: { name: string; data: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
        };
    }
}

// PDF.js 워커 설정 업데이트
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface Message {
    text: string;
    sender: 'user' | 'assistant';
    sourceDocuments?: Array<{
        id: number;
        page: number;
        source: string;
        content: string;
    }>;
}

interface SourceDocument {
    id: number;
    page: number;
    source: string;
    content: string;
}

export default function Home() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [numPages, setNumPages] = useState<number>();
    const [user, setUser] = useState<string>('');
    const [file, setFile] = useState<File | null>(null);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);
    const [questionStatus, setQuestionStatus] = useState<string>("");
    const [answer, setAnswer] = useState<string>("");
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState<string | null>(null);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [isQuestionProcessing, setIsQuestionProcessing] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [sourceDocs, setSourceDocs] = useState<SourceDocument[]>([]);

    const pdfRef = useRef<HTMLDivElement>(null);
    const lastScrollTop = useRef<number>(0);
    const router = useRouter();

    useEffect(() => {
        const handleScroll = () => {
            if (pdfRef.current) {
                const { scrollTop, clientHeight, scrollHeight } = pdfRef.current;
                const isAtBottom = scrollTop + clientHeight >= scrollHeight;
                const isAtTop = scrollTop === 0;

                if (isAtBottom && pageNumber < (numPages || 0) && lastScrollTop.current !== scrollTop) {
                    lastScrollTop.current = scrollTop;
                    handleNextPage();
                } else if (isAtTop && pageNumber > 1 && lastScrollTop.current !== scrollTop) {
                    lastScrollTop.current = scrollTop;
                    handlePrevPage();
                }
            }
        };

        const currentPdfRef = pdfRef.current;
        currentPdfRef?.addEventListener("scroll", handleScroll);

        return () => {
            currentPdfRef?.removeEventListener("scroll", handleScroll);
        };
    }, [pdfRef, pageNumber, numPages]);

    useEffect(() => {
        const userId = sessionStorage.getItem('userId') || '';
        setUser(userId);
    }, [])

    useEffect(() => {
        if (user && sessionStorage.getItem('hasUploaded')) {
            getFile();
        }
    }, [user])

    useEffect(() => {
        // Set dummy user info in session storage
        sessionStorage.setItem('userId', 'test-user');
    }, []);

    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        const target = event.target as HTMLAnchorElement;
        const hrefAttribute = target?.attributes?.getNamedItem('href');
        if (hrefAttribute?.value) {
            event.preventDefault();
            const pageNum = hrefAttribute?.value.split(".")[0]?.replace('#', '');
            setPageNumber(Number(pageNum))
        }
    }

    const handleSendMessage = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!input.trim()) return;

        setLoading(true);
        setQuestionStatus('Processing question...');

            try {
                const response = await fetch('/api/chat', {
                method: 'POST',
                    headers: {
                    'Content-Type': 'application/json',
                    'User-Id': user || 'test-user'
                },
                body: JSON.stringify({
                    question: input,
                    history: messages
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get answer');
            }

            const data = await response.json();
            console.log('Received response:', data);
            
            // Add user message
            setMessages(prev => [...prev, { text: input, sender: "user" }]);
            
            // Add system response
            if (data.answer) {
                setMessages(prev => [...prev, { text: data.answer, sender: "assistant" }]);
                } else {
                setMessages(prev => [...prev, { 
                    text: "죄송합니다. 관련된 문서를 찾을 수 없습니다.", 
                    sender: "assistant" 
                }]);
            }
            
            setInput("");
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, { 
                text: "죄송합니다. 처리 중 오류가 발생했습니다.", 
                sender: "assistant" 
            }]);
        } finally {
            setLoading(false);
            setQuestionStatus("");
        }
    };

    function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
        setNumPages(numPages);
        setPdfError(null);
        setIsPdfLoading(false);
    }

    function onDocumentLoadError(error: Error): void {
        console.error('PDF load error:', error);
        setPdfError('PDF 파일을 로드하는 중 오류가 발생했습니다.');
        setIsPdfLoading(false);
    }

    const handleNextPage = () => {
        if (pageNumber < (numPages || 0)) {
            setPageNumber(pageNumber + 1);
        }
    };

    const handlePrevPage = () => {
        if (pageNumber > 1) {
            setPageNumber(pageNumber - 1);
        }
    };

    const getFile = async () => {
        try {
            const response = await fetch('/api/document', {
            headers: {
                    'User-Id': user || 'test-user'
                }
            });
            const data = await response.json();
            
            if (data.success && data.documents && data.documents.length > 0) {
                const fileData = data.documents[0];
                const metadata = JSON.parse(fileData.metadata);
                setFile(new File([new Blob()], metadata.source.split('/').pop() || 'document.pdf'));
                // 초기 메시지 설정
                setMessages([{
                    text: '안녕하세요! 문서에 대해 어떤 것이든 물어보세요.',
                    sender: 'assistant'
                }]);
                // 채팅창이 나타나면 스크롤
                setTimeout(() => {
                    window.scrollTo({
                        top: document.documentElement.scrollHeight,
                        behavior: 'smooth'
                    });
                }, 100);
            }
        } catch (error) {
            console.error('Error fetching file:', error);
            setFile(null);
            setMessages([]);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        console.log('Starting file upload:', file.name);
        setIsUploading(true);
        setUploadProgress(0);
        setUploadStatus('파일 업로드 중...');
        setFile(null);
        setMessages([]);

        try {
            const formData = new FormData();
            formData.append('file', file);

            console.log('Sending file to server...');
            const response = await fetch('/api/document', {
                method: 'POST',
                headers: {
                    'User-Id': user || 'test-user'
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '업로드 실패');
            }

            const data = await response.json();
            console.log('Upload response:', data);

            if (data.success) {
                setUploadStatus('파일이 성공적으로 업로드되었습니다!');
                setUploadProgress(100);
                sessionStorage.setItem('hasUploaded', 'true');

                // Start document processing
                console.log('Starting document processing...');
                setIsProcessing(true);
                setProcessingProgress(0);
                setProcessingStatus('문서 처리 준비 중...');

                const processResponse = await fetch('/api/document', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Id': user || 'test-user'
                    },
                    body: JSON.stringify({ 
                        path: data.path,
                        filename: file.name
                    })
                });

                if (!processResponse.ok) {
                    throw new Error('문서 처리 시작 실패');
                }

                const reader = processResponse.body?.getReader();
                const decoder = new TextDecoder();

                if (!reader) {
                    throw new Error('응답을 읽을 수 없습니다.');
                }

                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        console.log('Processing complete');
                        setProcessingStatus('문서 처리가 완료되었습니다.');
                        setProcessingProgress(100);
                        setFile(file);
                        // 처리 완료 후 파일 정보 가져오기
                        await getFile();
                        break;
                    }

                    const chunk = decoder.decode(value);
                    console.log('Received chunk:', chunk);
                    
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (!line.trim()) continue;

                        try {
                            const update = JSON.parse(line);
                            console.log('Parsed update:', update);
                            
                            if (update.status) {
                                setProcessingStatus(update.status);
                            }
                            
                            if (typeof update.progress === 'number') {
                                setProcessingProgress(update.progress);
                            }

                            if (update.success) {
                                console.log('Processing successful');
                                setProcessingStatus('문서 처리가 완료되었습니다.');
                                setProcessingProgress(100);
                                setFile(file);
                                // 처리 완료 후 파일 정보 가져오기
                                await getFile();
                                return;
                            }
                        } catch (e) {
                            console.error('Error parsing update:', e);
                        }
                    }
                }
            } else {
                throw new Error(data.error || '업로드 실패');
            }
        } catch (error) {
            console.error('Error:', error);
            setUploadStatus('업로드 실패: ' + (error as Error).message);
            setProcessingStatus('문서 처리 중 오류가 발생했습니다.');
            setFile(null);
            setMessages([]);
        } finally {
            setIsUploading(false);
            setIsProcessing(false);
        }
    };

    const handleQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !file) return;

        setIsQuestionProcessing(true);
        setProcessingStatus('🤔 지금 생각중이에요...');

        const newMessage: Message = {
            text: input,
            sender: 'user'
        };

        setMessages(prev => [...prev, newMessage]);
        setInput('');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: input,
                    userId: user || 'test-user'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            // Get source documents from header
            const sourceDocsHeader = response.headers.get('X-Source-Documents');
            let currentSourceDocs: SourceDocument[] = [];
            if (sourceDocsHeader) {
                try {
                    currentSourceDocs = JSON.parse(Buffer.from(sourceDocsHeader, 'base64').toString('utf-8')) as SourceDocument[];
                    setSourceDocs(currentSourceDocs);
                } catch (e) {
                    console.error('Error parsing source documents:', e);
                }
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No reader available');
            }

            const assistantMessage: Message = {
                text: '',
                sender: 'assistant',
                sourceDocuments: currentSourceDocs
            };

            setMessages(prev => [...prev, assistantMessage]);
            // 스트리밍 시작 시 처리 상태 메시지와 인디케이터 제거
            setIsQuestionProcessing(false);
            setProcessingStatus('');

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // 스트리밍이 완료되면 스크롤
                    setTimeout(() => {
                        const chatContainer = document.querySelector('.overflow-y-auto');
                        if (chatContainer) {
                            chatContainer.scrollTo({
                                top: chatContainer.scrollHeight,
                                behavior: 'smooth'
                            });
                        }
                    }, 100);
                    break;
                }

                const text = new TextDecoder().decode(value);
                setMessages(prev => {
                    const lastMessage = prev[prev.length - 1];
                    return [
                        ...prev.slice(0, -1),
                        { ...lastMessage, text: lastMessage.text + text }
                    ];
                });
            }
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, {
                text: '오류가 발생했습니다. 다시 시도해주세요.',
                sender: 'assistant'
            }]);
        } finally {
            setIsQuestionProcessing(false);
            setProcessingStatus('');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPdfError(null);
            setIsPdfLoading(true);
            handleFileUpload(e);
        }
    };

    return (
        <div className="flex flex-col h-screen">
            <h1 className="text-4xl font-bold p-4">Local PDF LLM</h1>
            
            {/* Combined Scrollable Container */}
            <div className="flex-1 overflow-y-auto">
                {/* PDF Upload Section */}
                <div className="p-4">
                    <p className="mb-2">PDF 파일을 올려주세요!</p>
                    <div className={`border-2 border-dashed ${file && !isProcessing ? 'border-blue-300 bg-blue-50' : 'border-gray-300'} rounded-lg p-8 text-center`}>
                        {(!file || isProcessing) && (
                            <div className="flex flex-col items-center justify-center">
                                <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="mb-2">Drag and drop file here</p>
                                <p className="text-sm text-gray-500 mb-4">Limit 200MB per file • PDF</p>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="fileInput"
                                />
                                <label
                                    htmlFor="fileInput"
                                    className="bg-white border border-gray-300 rounded-lg px-4 py-2 cursor-pointer hover:bg-gray-50"
                                >
                                    Browse files
                                </label>
                            </div>
                        )}
                        {file && !isProcessing && (
                            <div className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                                <div className="flex items-center">
                                    <svg className="w-8 h-8 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <div>
                                        <p className="font-medium text-gray-900">{file.name}</p>
                                        {file.size > 0 && (
                                            <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)}KB</p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setFile(null);
                                        setMessages([]);
                                        fetch('/api/document', {
                                            method: 'DELETE',
                                            headers: {
                                                'User-Id': user || 'test-user'
                                            }
                                        }).catch(console.error);
                                    }}
                                    className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                    {isProcessing && (
                        <div className="mt-4">
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium text-gray-700">{processingStatus}</span>
                                <span className="text-sm font-medium text-gray-700">{processingProgress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${processingProgress}%` }}
                            />
                        </div>
                        </div>
                    )}
                </div>

                {/* Chat Messages */}
                {file && !isProcessing && (
                    <div className="px-4 pb-28">
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`mb-4 flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {message.sender === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                        </svg>
                                    </div>
                                )}
                                <div
                                    className={`max-w-[80%] p-3 rounded-lg ${
                                        message.sender === 'user'
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-100 text-gray-800'
                                    }`}
                                >
                                    <div className="whitespace-pre-wrap">{message.text}</div>
                                    {message.sourceDocuments && message.sourceDocuments.length > 0 && (
                                        <div className="mt-2">
                                            <details>
                                                <summary className="cursor-pointer text-sm font-medium">
                                                    참고 문서 확인
                                                </summary>
                                                <div className="mt-2 space-y-2">
                                                    {message.sourceDocuments.map((doc) => (
                                                        <div key={doc.id} className="p-2 bg-white rounded text-sm">
                                                            <p>페이지: {doc.page}</p>
                                                            <p>출처: {doc.source}</p>
                                                            <p className="mt-1 text-gray-600">{doc.content}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        </div>
                                    )}
                                </div>
                                {message.sender === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center ml-2">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        ))}
                        {isQuestionProcessing && (
                            <div className="flex items-center space-x-2 text-gray-500 mb-4">
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                                <span className="ml-2">{processingStatus}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Fixed Chat Input */}
            {file && !isProcessing && (
                <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t">
                    <form onSubmit={handleQuestion} className="flex gap-2 max-w-screen-2xl mx-auto">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="질문을 입력하세요"
                            className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isQuestionProcessing}
                        />
                        <button
                            type="submit"
                            disabled={isQuestionProcessing}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>
                    </div>
                )}
        </div>
    );
}