"use client";

import { useState, useCallback } from "react";

interface EvaluationResult {
  issueId: string;
  issueNumber: number;
  score: number;
  grade: string;
  message: string;
}

interface UseSpeedEvaluationResult {
  evaluate: (repositoryId: string, issueIds?: string[]) => Promise<void>;
  isEvaluating: boolean;
  results: EvaluationResult[] | null;
  evaluatedCount: number;
  error: string | null;
}

/**
 * 完了速度評価フック
 */
export function useSpeedEvaluation(): UseSpeedEvaluationResult {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [results, setResults] = useState<EvaluationResult[] | null>(null);
  const [evaluatedCount, setEvaluatedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const evaluate = useCallback(
    async (repositoryId: string, issueIds?: string[]) => {
      try {
        setIsEvaluating(true);
        setError(null);
        setResults(null);

        const response = await fetch("/api/evaluations/speed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repositoryId, issueIds }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to evaluate speed");
        }

        const data = await response.json();
        setResults(data.results);
        setEvaluatedCount(data.evaluated);
      } catch (err) {
        console.error("Error evaluating speed:", err);
        if (err instanceof Error) {
          setError(err.message);
        }
        throw err;
      } finally {
        setIsEvaluating(false);
      }
    },
    []
  );

  return {
    evaluate,
    isEvaluating,
    results,
    evaluatedCount,
    error,
  };
}

interface UseQualityEvaluationResult {
  evaluate: (repositoryId: string, issueIds?: string[]) => Promise<void>;
  isEvaluating: boolean;
  results: EvaluationResult[] | null;
  evaluatedCount: number;
  error: string | null;
}

/**
 * 品質評価フック（Phase 5で実装）
 */
export function useQualityEvaluation(): UseQualityEvaluationResult {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [results, setResults] = useState<EvaluationResult[] | null>(null);
  const [evaluatedCount, setEvaluatedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const evaluate = useCallback(
    async (repositoryId: string, issueIds?: string[]) => {
      try {
        setIsEvaluating(true);
        setError(null);
        setResults(null);

        const response = await fetch("/api/evaluations/quality", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repositoryId, issueIds }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to evaluate quality");
        }

        const data = await response.json();
        setResults(data.results);
        setEvaluatedCount(data.evaluated);
      } catch (err) {
        console.error("Error evaluating quality:", err);
        if (err instanceof Error) {
          setError(err.message);
        }
        throw err;
      } finally {
        setIsEvaluating(false);
      }
    },
    []
  );

  return {
    evaluate,
    isEvaluating,
    results,
    evaluatedCount,
    error,
  };
}

interface UseConsistencyEvaluationResult {
  evaluate: (repositoryId: string, prIds?: string[]) => Promise<void>;
  isEvaluating: boolean;
  results: EvaluationResult[] | null;
  evaluatedCount: number;
  error: string | null;
}

/**
 * 整合性評価フック（Phase 6で実装）
 */
export function useConsistencyEvaluation(): UseConsistencyEvaluationResult {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [results, setResults] = useState<EvaluationResult[] | null>(null);
  const [evaluatedCount, setEvaluatedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const evaluate = useCallback(
    async (repositoryId: string, prIds?: string[]) => {
      try {
        setIsEvaluating(true);
        setError(null);
        setResults(null);

        const response = await fetch("/api/evaluations/consistency", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repositoryId, prIds }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to evaluate consistency");
        }

        const data = await response.json();
        setResults(data.results);
        setEvaluatedCount(data.evaluated);
      } catch (err) {
        console.error("Error evaluating consistency:", err);
        if (err instanceof Error) {
          setError(err.message);
        }
        throw err;
      } finally {
        setIsEvaluating(false);
      }
    },
    []
  );

  return {
    evaluate,
    isEvaluating,
    results,
    evaluatedCount,
    error,
  };
}
