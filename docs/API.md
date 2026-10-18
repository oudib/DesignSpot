# Sobrus DS REST API (v1)

A small JSON API so an agent (Claude, a script, a CI job) can manage **tickets**
and **deliveries** without the browser. Everything it can do, a signed-in
designer can do in `/manage` — it is the same code underneath.

## Authentication

1. Sign in, open **Workspace → Settings → API keys**, create a key. It is shown
   once; only a hash is stored.
2. Send it on every request:

```
Authorization: Bearer sds_…
```

(`X-Api-Key: sds_…` also works.) A request acts **as the key's owner**: the
same permission rules apply (admins can edit anything; a designer can edit
tickets and deliveries on flows they are assigned to), and Linear comments are
posted with the owner's Linear connection, if any. Revoking the key, or
removing the owner's workspace access, stops it immediately.

`GET /api/v1` (no auth) returns the endpoint list.

## Conventions

- Base path: `<APP_BASE_URL>/api/v1`. Bodies are JSON unless a file is
  uploaded, in which case send `multipart/form-data`.
- Success: `200` (`201` on create) with an object keyed by the resource
  (`{ "ticket": … }`, `{ "deliveries": [ … ] }`).
- Errors: `{ "error": "message" }` with `400` (bad input), `401` (bad key),
  `403` (not allowed), `404`, `500`.
- `PATCH` is partial: only the keys you send change. Send `null` to clear an
  optional relation (`assigneeId`, `solutionId`, `flowId`).
- Ticket `status`: `todo` | `in_progress` | `review` | `done`.
  Ticket `priority`: `low` | `medium` | `high` | `urgent`.
- Ids are opaque strings. Get them from `/structure`, `/users` and list calls.

## Getting oriented

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/me` | `{ user, apiKey }` — who this key acts as |
| GET | `/users` | `{ users: [{ id, name, email, role }] }` for `assigneeId` |
| GET | `/structure` | `{ solutions: [{ id, name, modules: [{ id, name, submodules: [{ id, name, flows: [{ id, name, description }] }] }] }] }` |
| POST | `/flows` | Create a flow: `{ submoduleId, name, description? }` → `{ flow }` |

## Tickets

| Method | Path | Body / query |
| --- | --- | --- |
| GET | `/tickets` | Query: `status`, `priority`, `assigneeId`, `solutionId`, `flowId`, `q` (title/description/Linear URL search), `limit` (≤ 500, default 100). Newest updated first. |
| POST | `/tickets` | `{ title, description?, status?, priority?, linearUrl?, assigneeId?, solutionId?, flowId? }`. Unassigned tickets are assigned to the key's owner. |
| GET | `/tickets/{id}` | Ticket plus `comments[]` and `deliveries[]`. |
| PATCH | `/tickets/{id}` | Any subset of the POST fields. |
| DELETE | `/tickets/{id}` | `{ ok: true }` |
| GET | `/tickets/{id}/comments` | `{ comments }` |
| POST | `/tickets/{id}/comments` | `{ body }` → `{ comment }` |

A ticket looks like:

```json
{
  "id": "clx…", "title": "Checkout redesign", "description": "", 
  "status": "in_progress", "priority": "high",
  "linearUrl": "https://linear.app/sobrus/issue/DES-42/…",
  "assignee": { "id": "…", "name": "Sara", "email": "sara@sobrus.com" },
  "solution": { "id": "…", "name": "Sobrus Pharma", "slug": "sobrus-pharma" },
  "flow": { "id": "…", "name": "Checkout", "submodule": {…}, "module": {…}, "url": "https://…/flows/…" },
  "url": "https://…/manage/tickets/clx…",
  "createdAt": "…", "updatedAt": "…"
}
```

Linear side effects (only when the owner has connected Linear and the ticket
has a `linearUrl`): attaching or changing the flow posts a "Linked design flow"
comment; moving to `done` posts "Design completed".

## Deliveries

A delivery is a design attached to a **flow**: a link (Claude share link or
Google Drive link), an uploaded file (image, PDF, zip, standalone HTML export),
or both, optionally tied to the ticket it fulfils.

| Method | Path | Body / query |
| --- | --- | --- |
| GET | `/deliveries` | Query: `ticketId`, `flowId`, `limit`. |
| POST | `/deliveries` | `{ title, flowId?, ticketId?, linkUrl?, variant?, markDone? }` (+ `file`). `flowId` defaults to the ticket's flow. |
| GET | `/tickets/{id}/deliveries` | This ticket's deliveries. |
| POST | `/tickets/{id}/deliveries` | Same as `POST /deliveries` with `ticketId` preset. The usual way to deliver. |
| GET | `/deliveries/{id}` | `{ delivery }` |
| PATCH | `/deliveries/{id}` | `{ title?, linkUrl?, variant? }` |
| DELETE | `/deliveries/{id}` | Deletes the design and its files. |
| POST | `/deliveries/{id}/files` | multipart, field `file` → `{ file }`. Adds another file. |
| POST | `/files/{id}/revisions` | multipart, field `file` → `{ file }`. Uploads **v2/v3…** of an existing file; the preview link already shared keeps working and shows the new version. |
| DELETE | `/files/{id}` | Deletes a file and all its versions. |

`markDone: true` (with a ticket) also sets that ticket to `done`, in the same
Linear comment as the delivery.

A delivery looks like:

```json
{
  "id": "…", "title": "Checkout v2", "linkUrl": "https://claude.ai/…", "variant": "mobile",
  "flowId": "…", "flow": { "id": "…", "name": "Checkout" },
  "ticketId": "…", "ticket": { "id": "…", "title": "…", "status": "done" },
  "files": [{
    "id": "…", "name": "checkout.html", "mimeType": "text/html", "size": 48213, "kind": "html",
    "version": 2, "rootId": "…",
    "downloadUrl": "https://…/api/files/<driveId>",
    "previewUrl": "https://…/preview/<driveId>",
    "driveUrl": "https://drive.google.com/file/d/<driveId>/view"
  }],
  "createdAt": "…", "updatedAt": "…"
}
```

`previewUrl` and `downloadUrl` need a signed-in browser session (they are
behind the login wall, not the API key). `kind` is `html` for standalone HTML
exports, which the preview page renders directly.

## Examples

```bash
export SDS="https://ds.sobrus.com/api/v1"
export KEY="sds_…"

# Who am I?
curl -s "$SDS/me" -H "Authorization: Bearer $KEY"

# My open tickets
curl -s "$SDS/tickets?status=in_progress" -H "Authorization: Bearer $KEY"

# Create a ticket on a flow
curl -s -X POST "$SDS/tickets" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Checkout redesign","priority":"high","flowId":"<flowId>","solutionId":"<solutionId>","linearUrl":"https://linear.app/sobrus/issue/DES-42"}'

# Move it to review
curl -s -X PATCH "$SDS/tickets/<ticketId>" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"status":"review"}'

# Deliver a link-only design and mark the ticket done
curl -s -X POST "$SDS/tickets/<ticketId>/deliveries" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Checkout v1","linkUrl":"https://claude.ai/public/artifacts/…","markDone":true}'

# Deliver an HTML export (multipart)
curl -s -X POST "$SDS/tickets/<ticketId>/deliveries" -H "Authorization: Bearer $KEY" \
  -F title="Checkout v1" -F markDone=true -F file=@checkout.html

# Upload v2 of that file
curl -s -X POST "$SDS/files/<fileId>/revisions" -H "Authorization: Bearer $KEY" \
  -F file=@checkout-v2.html
```

## Giving the key to Claude

Paste the "Instructions to paste into Claude" block shown right after creating
a key (base URL, auth header, where to start). Claude can then read
`GET /api/v1` and this file, and use `curl` or `fetch` against the endpoints
above.
