"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Issue } from "@/types/issue";
import type { IssueQualityEvaluation, QualityGrade } from "@/types/evaluation";

interface QualityFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: Issue | null;
  evaluation: IssueQualityEvaluation | null;
}

const gradeColors: Record<QualityGrade, string> = {
  A: "bg-green-500 hover:bg-green-600 text-white",
  B: "bg-blue-500 hover:bg-blue-600 text-white",
  C: "bg-yellow-500 hover:bg-yellow-600 text-white",
  D: "bg-orange-500 hover:bg-orange-600 text-white",
  E: "bg-red-500 hover:bg-red-600 text-white",
};

const gradeLabels: Record<QualityGrade, string> = {
  A: "優秀",
  B: "良好",
  C: "普通",
  D: "要改善",
  E: "不十分",
};

export function QualityFeedbackModal({
  open,
  onOpenChange,
  issue,
  evaluation,
}: QualityFeedbackModalProps) {
  if (!issue) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-muted-foreground">#{issue.number}</span>
            <span>{issue.title}</span>
          </DialogTitle>
          <DialogDescription>Issue記述品質の評価詳細</DialogDescription>
        </DialogHeader>

        {evaluation ? (
          <div className="space-y-6">
            {/* 総合スコア */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">総合スコア</p>
                <p className="text-3xl font-bold">{evaluation.totalScore}</p>
              </div>
              <Badge className={`${gradeColors[evaluation.grade]} text-lg px-4 py-2`}>
                {evaluation.grade} - {gradeLabels[evaluation.grade]}
              </Badge>
            </div>

            {/* 全体フィードバック */}
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">総合評価</h3>
              <p className="text-muted-foreground">{evaluation.overallFeedback}</p>
            </div>

            {/* カテゴリ別スコア */}
            <div>
              <h3 className="font-semibold mb-3">カテゴリ別評価</h3>
              <div className="space-y-4">
                {evaluation.categories.map((category) => {
                  const percentage = (category.score / category.maxScore) * 100;
                  return (
                    <div key={category.categoryId} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{category.categoryName}</span>
                        <span className="text-sm text-muted-foreground">
                          {category.score} / {category.maxScore}
                        </span>
                      </div>
                      <Progress
                        value={percentage}
                        className="h-2"
                        role="progressbar"
                        aria-valuenow={percentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                      <p className="text-sm text-muted-foreground">{category.feedback}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 改善提案 */}
            {evaluation.improvementSuggestions.length > 0 && (
              <div className="p-4 border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800 rounded-lg">
                <h3 className="font-semibold mb-2 text-yellow-800 dark:text-yellow-200">
                  改善提案
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  {evaluation.improvementSuggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className="text-sm text-yellow-700 dark:text-yellow-300"
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">評価データがありません</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
