import { createShare } from "@/lib/share-store";

export const runtime = "nodejs";

type Body = {
  idea?: string;
  stack?: "nextjs" | "none" | "mobile";
  output?: string;
  answers?: Array<{ question: string; answer: string }>;
  author?: string;
  generatedAt?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const idea = typeof body.idea === "string" ? body.idea.trim() : "";
  const output = typeof body.output === "string" ? body.output.trim() : "";
  const stack =
    body.stack === "nextjs" || body.stack === "mobile" || body.stack === "none"
      ? body.stack
      : "none";
  const author =
    typeof body.author === "string" ? body.author.trim().slice(0, 60) : "";
  const generatedAt =
    typeof body.generatedAt === "string" && body.generatedAt
      ? body.generatedAt
      : new Date().toISOString();

  if (idea.length < 8 || output.length < 40) {
    return Response.json(
      { error: "Idea and brief output are required." },
      { status: 400 },
    );
  }

  const record = await createShare({
    idea,
    stack,
    output,
    answers: Array.isArray(body.answers) ? body.answers : undefined,
    author: author || undefined,
    generatedAt,
  });

  const origin = new URL(request.url).origin;
  const url = `${origin}/s/${record.id}`;

  return Response.json({
    id: record.id,
    url,
    author: record.author ?? null,
    generatedAt: record.generatedAt,
  });
}
