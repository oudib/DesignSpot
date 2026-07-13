import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Logo from "@/components/Logo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const attachment = await prisma.designAttachment.findFirst({
    where: { path: id },
  });
  return { title: attachment?.name ?? "Preview" };
}

export default async function AttachmentPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const attachment = await prisma.designAttachment.findFirst({
    where: { path: id },
  });
  if (!attachment) notFound();

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <Logo className="h-8 w-auto" />
        <div className="flex shrink-0 items-center gap-2">
          {attachment.kind === "html" && (
            <a href={`/api/files/${id}/assets`} className="btn-secondary">
              <span>🗂</span> Download Assets
            </a>
          )}
          <a
            href={`/api/files/${id}?download=1`}
            download={attachment.name}
            className="btn-secondary"
          >
            <span>⬇</span> Download {attachment.kind === "html" ? "HTML file" : "file"}
          </a>
        </div>
      </header>
      <iframe
        src={`/api/files/${id}`}
        title={attachment.name}
        sandbox="allow-scripts allow-popups"
        className="min-h-0 flex-1 border-0"
      />
    </div>
  );
}
