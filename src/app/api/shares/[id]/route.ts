import { getShare } from "@/lib/share-store";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const record = await getShare(id);
  if (!record) {
    return Response.json({ error: "Share not found." }, { status: 404 });
  }

  return Response.json({
    id: record.id,
    idea: record.idea,
    stack: record.stack,
    output: record.output,
    answers: record.answers ?? [],
    author: record.author ?? null,
    generatedAt: record.generatedAt,
  });
}
