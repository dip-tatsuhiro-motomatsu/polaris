import { NextRequest, NextResponse } from "next/server";
import { RegisterCollaboratorsUseCase } from "@/application/use-cases/register-collaborators";

export const dynamic = "force-dynamic";

/**
 * POST /api/repositories/[id]/collaborators
 * コラボレーターを登録
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const repositoryId = parseInt(id, 10);

    if (isNaN(repositoryId)) {
      return NextResponse.json(
        { error: "無効なリポジトリIDです" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { selectedGithubUsers } = body;

    const useCase = new RegisterCollaboratorsUseCase();
    const result = await useCase.execute({
      repositoryId,
      selectedGithubUsers,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { collaborators: result.collaborators },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error registering collaborators:", error);
    return NextResponse.json(
      { error: "コラボレーターの登録に失敗しました" },
      { status: 500 }
    );
  }
}
