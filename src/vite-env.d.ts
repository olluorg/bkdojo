/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** micro-platform LLM proxy URL (e.g. "https://api.ollu.example/functions/llm").
   *  Empty = server evaluator disabled. The user's OpenRouter key is supplied
   *  in-app and sent as the X-Provider-Key header. */
  readonly VITE_EVAL_ENDPOINT?: string;
}
