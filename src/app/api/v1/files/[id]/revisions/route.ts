import { NextResponse } from "next/server";
import { withApiAuth, readBody, file } from "@/lib/apiAuth";
import { addDeliveryRevision } from "@/lib/deliveries";
import { badRequest } from "@/lib/errors";
import { serializeAttachment } from "@/lib/apiSerialize";

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 60;

// Upload the next version of an existing file. The preview link of the first
// version keeps working and now shows this one.
export const POST = withApiAuth<Ctx>(async (req, actor, { params }) => {
  const { id } = await params;
  const body = await readBody(req);
  const upload = file(body);
  if (!upload) throw badRequest("Send multipart/form-data with a non-empty `file` field.");
  const attachment = await addDeliveryRevision(actor, id, upload);
  return NextResponse.json({ file: serializeAttachment(attachment) }, { status: 201 });
});
