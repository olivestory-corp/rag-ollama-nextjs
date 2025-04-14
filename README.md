# RAG-Ollama-JS
https://github.com/olivestory-corp/rag-ollama-nextjs/blob/main/screenshot1.png?raw=true

## Introduction
RAG-Ollama-JS is a Next.js application that implements Retrieval-Augmented Generation (RAG) using LangChain.js, Ollama, and Supabase. This project provides a user-friendly interface for document-based question-answering with PDF support. It also supports secured RAG with embeddings used only for logged in users.

## Features
- **PDF Document Support**: Upload and view PDF documents with built-in navigation
- **Real-time Chat Interface**: Interactive chat interface with streaming responses
- **RAG Implementation**: 
  - Uses LangChain.js for structured question processing
  - Integrates with Ollama for language model capabilities
  - Leverages Supabase for vector storage and document management
- **Responsive UI**: Split-screen layout with PDF viewer and chat interface
- **Context-Aware Responses**: Generates answers based on document content

## Prerequisites
- Node.js (Latest LTS version)
- Ollama running locally or remotely

## Installation

1. Clone the repository:
```bash
git clone https://github.com/olivestory-corp/rag-ollama-nextjs.git
cd rag-ollama-nextjs
```

2. Install dependencies:
```bash
npm install
npm rebuild better-sqlite3
```

3. Configure environment variables:
   - Copy `env.example` to `.env`
   - Update the following variables:
```plaintext
SUPABASE_URL=your_supabase_project_url
OLLAMA_LLM_BASE_URL=exaone3.5:latest
OLLAMA_LLM_MODEL=your_preferred_model
OLLAMA_EMBEDDINGS_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDINGS_MODEL=exaone3.5:latest
```

5. Start the development server:
```bash
npm run electron:dev
```

## Usage

1. **Upload Document**:
   - Click the "Upload File" button in the right panel
   - Select a PDF document to upload
   - The document will be processed and stored in Supabase

2. **View Document**:
   - Navigate through pages using arrow buttons or scroll
   - Page number indicator shows current position

3. **Ask Questions**:
   - Type your question in the chat input
   - Receive context-aware responses based on the document content
   - View conversation history in the chat panel

## Technical Stack

- **Frontend**: Next.js with TypeScript
- **UI Framework**: Tailwind CSS
- **PDF Handling**: react-pdf
- **Language Model**: Ollama
- **Vector Store**: Supabase
- **RAG Implementation**: LangChain.js

## Project Structure

```plaintext
src/
├── app/
│   ├── api/         # API routes for chat and document handling
│   ├── home/        # Main application page
│   ├── lib/         # Core libraries (Ollama, prompts)
│   └── utils/       # Helper functions and environment config
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
