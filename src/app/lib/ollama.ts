import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { env } from "../utils/env";

const { ollama } = env;

export const llm = new ChatOllama({
    model: ollama.llm.model,
    temperature: 0,
    maxRetries: 2,
    baseUrl: ollama.llm.baseUrl,
});

export const embeddings = new OllamaEmbeddings({
    model: ollama.embeddings.model, 
    baseUrl: ollama.embeddings.baseUrl,
});
