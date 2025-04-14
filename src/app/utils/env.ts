export const env = {
    supabase: {
        apiKey: process.env.SUPABASE_API_KEY || '',
        url: process.env.SUPABASE_URL || '',
    },
    ollama: {
        llm: {
            baseUrl: process.env.OLLAMA_LLM_BASE_URL || '',
            model: process.env.OLLAMA_LLM_MODEL || '',
        },
        embeddings: {
            baseUrl: process.env.OLLAMA_EMBEDDINGS_BASE_URL || '',
            model: process.env.OLLAMA_EMBEDDINGS_MODEL || '',
        }
    }
}