/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Serverless evaluation endpoint (e.g. "/api/evaluate"). Empty = disabled. */
  readonly VITE_EVAL_ENDPOINT?: string;
}
