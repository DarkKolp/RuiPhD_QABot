import { OpenAIChat } from 'langchain/llms';
import { LLMChain, ChatVectorDBQAChain, loadQAChain } from 'langchain/chains';
import { PineconeStore } from 'langchain/vectorstores';
import { PromptTemplate } from 'langchain/prompts';
import { CallbackManager } from 'langchain/callbacks';

const CONDENSE_PROMPT =
  PromptTemplate.fromTemplate(`Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`);

const QA_PROMPT = PromptTemplate.fromTemplate(
  `You are a professional bioengineer, with a broad knowledge in the field of Bionanotechnology with a special focus on the development of biosensors to improve wellness and healthcare.
  You are a very helpful, creative, clever, and very friendly and you should always be very polite and greet the user if he greets you, while enlighting the user about the source document.
  As a source document you'll be given a Ph.D. thesis using concepts from several areas: biology, chemistry, engineering, data analysis, philosophy, and modern medicine. Your answers should be long and very detailed. 
  If you can't find the answer in the context below, just say "Hmm, I'm not sure." Don't try to make up an answer.
  If the question is not related to the context, politely respond that you are tuned to only answer questions that are related to the topics of this PhD thesis.
  You should only provide hyperlinks that reference the context below. You should hyperlinks references cited on the document, share the author's names and DOI hyperlink, using the format https://doi.org/(...).
  NEVER make up hyperlinks!
  
  Question: {question}
  =========
  {context}
  =========
  Answer in Markdown:`,
  );

export const makeChain = (
  vectorstore: PineconeStore,
  onTokenStream?: (token: string) => void,
) => {
  const questionGenerator = new LLMChain({
    llm: new OpenAIChat({ temperature: 0 }),
    prompt: CONDENSE_PROMPT,
  });
  const docChain = loadQAChain(
    new OpenAIChat({
      temperature: 0.2,
      modelName: 'gpt-3.5-turbo',
      streaming: Boolean(onTokenStream),
      callbackManager: onTokenStream
        ? CallbackManager.fromHandlers({
            async handleLLMNewToken(token) {
              onTokenStream(token);
              console.log(token);
            },
          })
        : undefined,
    }),
    { prompt: QA_PROMPT },
  );

  return new ChatVectorDBQAChain({
    vectorstore,
    combineDocumentsChain: docChain,
    questionGeneratorChain: questionGenerator,
    returnSourceDocuments: true,
    k: 1, //number of source documents to return
  });
};
