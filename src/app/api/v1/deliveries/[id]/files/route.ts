import { NextResponse } from "next/server";
import { withApiAuth, readBody, file } from "@/lib/apiAuth";
import { addDeliveryFile } from "@/lib/deliveries";
import { badRequest } from "@/lib/errors";
import { serializeAttachment } from "@/lib/apiSerialize";

type Ctx = { params: Promise<{ id: string }> };

// multipart/form-data with a `file` field. Deliverables can be large.
export const maxDuration = 60;

export const POST = withApiAuth<Ctx>(async (req, actor, { params }) => {
  const { id } = await params;
  const body = await readBody(req);
  const upload = file(body);
  if (!upload) throw badRequest("Send multipart/form-data with a non-empty `file` field.");
  const attachment = await addDeliveryFile(actor, id, upload);
  return NextResponse.json({ file: serializeAttachment(attachment) }, { status: 201 });
});
