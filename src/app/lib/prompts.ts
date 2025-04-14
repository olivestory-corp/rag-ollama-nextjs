import { PromptTemplate } from "@langchain/core/prompts";

export const standaloneTemplate = PromptTemplate.fromTemplate(
    `대화 기록과 질문이 주어졌을 때, 질문을 독립적인 질문으로 변환하세요.
    대화 기록: {history}
    질문: {question} 
    독립적인 질문:`
);

export const answerTemplate = PromptTemplate.fromTemplate(`당신은 제공된 맥락을 바탕으로 질문에 답변하는 도움이 되고 열정적인 지원 봇입니다.
맥락은 메타데이터에 줄 번호와 페이지 번호가 포함된 청크들의 배열입니다.
당신의 목표는 맥락에서 가장 관련 있는 정보를 찾아 질문에 답변하는 것입니다.

- 답을 모르거나 맥락에서 찾을 수 없는 경우 "모르겠습니다"라고 말하고 답을 만들어내지 마세요.
- 청크 번호를 언급하지 마세요.
- 항상 친근하고 대화적인 톤으로 한국어로 답변하세요.

맥락:
{context}

질문:
{question}

답변:`);