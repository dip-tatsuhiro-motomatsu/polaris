/**
 * AIサービス抽象レイヤー
 */

export type { IAIService, AIServiceOptions, AIServiceConfig } from "./types";
export { VercelAIService, getAIService, setAIService, resetAIService } from "./vercel-ai-service";
