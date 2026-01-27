"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { EvaluationBadge } from "./EvaluationBadge";
import type { Issue } from "@/types/issue";

interface IssueTableProps {
  issues: Issue[];
  showSpeedEvaluation?: boolean;
  showQualityEvaluation?: boolean;
  onIssueClick?: (issue: Issue) => void;
}

export function IssueTable({
  issues,
  showSpeedEvaluation = true,
  showQualityEvaluation = false,
  onIssueClick,
}: IssueTableProps) {
  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ja-JP");
  };

  if (issues.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Issueがありません</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">#</TableHead>
          <TableHead>タイトル</TableHead>
          <TableHead className="w-24">状態</TableHead>
          <TableHead className="w-32">担当者</TableHead>
          {showSpeedEvaluation && <TableHead className="w-24">速度</TableHead>}
          {showQualityEvaluation && <TableHead className="w-24">品質</TableHead>}
          <TableHead className="w-28">作成日</TableHead>
          <TableHead className="w-28">クローズ日</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => (
          <TableRow
            key={issue.id}
            className={onIssueClick ? "cursor-pointer hover:bg-muted/50" : ""}
            onClick={() => onIssueClick?.(issue)}
          >
            <TableCell className="font-mono">{issue.number}</TableCell>
            <TableCell>
              <div>
                <span className="font-medium">{issue.title}</span>
                {issue.labels.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {issue.labels.slice(0, 3).map((label) => (
                      <Badge key={label} variant="secondary" className="text-xs">
                        {label}
                      </Badge>
                    ))}
                    {issue.labels.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{issue.labels.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant={issue.state === "open" ? "default" : "secondary"}
              >
                {issue.state === "open" ? "オープン" : "クローズ"}
              </Badge>
            </TableCell>
            <TableCell>{issue.assignee || "-"}</TableCell>
            {showSpeedEvaluation && (
              <TableCell>
                <EvaluationBadge evaluation={issue.speedEvaluation} />
              </TableCell>
            )}
            {showQualityEvaluation && (
              <TableCell>
                <EvaluationBadge evaluation={issue.qualityEvaluation} />
              </TableCell>
            )}
            <TableCell>{formatDate(issue.createdAt)}</TableCell>
            <TableCell>{formatDate(issue.closedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
