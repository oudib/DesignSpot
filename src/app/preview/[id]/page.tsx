import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Logo from "@/components/Logo";

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
    include: { design: { include: { ticket: { include: { assignee: true } } } } },
  });
  if (!attachment) notFound();

  const owner = attachment.design.ticket?.assignee?.name ?? "Unassigned";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Logo className="h-8 w-auto shrink-0" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-slate-900">
              {attachment.design.title}
            </p>
            <p className="truncate text-xs text-slate-500">
              Owner: {owner} · Created: {fmtDate(attachment.design.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
