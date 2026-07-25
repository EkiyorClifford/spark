import SharedBriefClient from "@/components/SharedBriefClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SharedBriefPage({ params }: PageProps) {
  const { id } = await params;
  return <SharedBriefClient id={id} />;
}
