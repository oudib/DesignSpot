import { NextResponse } from "next/server";

// Unauthenticated index so an agent handed only the base URL can discover the
// API. The full reference is docs/API.md in the repo.
export function GET() {
  return NextResponse.json({
    name: "Sobrus DS API",
    version: 1,
    auth: "Authorization: Bearer <api key> — create one in /manage/settings.",
    docs: "https://github.com/oudib/DesignSpot/blob/main/docs/API.md",
    endpoints: {
      "GET /api/v1/me": "The user this key acts as.",
      "GET /api/v1/users": "Workspace users (for assigneeId).",
      "GET /api/v1/structure": "Solutions → modules → submodules → flows (for solutionId / flowId).",
      "POST /api/v1/flows": "Create a flow under a submodule.",
      "GET /api/v1/tickets": "List tickets. Filters: status, priority, assigneeId, solutionId, flowId, q, limit.",
      "POST /api/v1/tickets": "Create a ticket.",
      "GET /api/v1/tickets/{id}": "Ticket with comments and deliveries.",
      "PATCH /api/v1/tickets/{id}": "Update any ticket field (status, priority, flowId, …).",
      "DELETE /api/v1/tickets/{id}": "Delete a ticket.",
      "GET|POST /api/v1/tickets/{id}/comments": "Read / add comments.",
      "GET|POST /api/v1/tickets/{id}/deliveries": "Deliveries for a ticket / deliver a design to it.",
      "GET|POST /api/v1/deliveries": "List deliveries (ticketId, flowId filters) / create one by flowId.",
      "GET|PATCH|DELETE /api/v1/deliveries/{id}": "Read, edit, delete a delivery.",
      "POST /api/v1/deliveries/{id}/files": "Attach a file (multipart, field `file`).",
      "POST /api/v1/files/{id}/revisions": "Upload a new version of a file (multipart, field `file`).",
      "DELETE /api/v1/files/{id}": "Delete a file and all its versions.",
    },
  });
}
