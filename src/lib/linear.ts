// Linear integration — pushes comments to Linear issues from /manage actions.
//
// Direction is app → Linear, and each designer connects their OWN Linear via a
// Personal API key (stored encrypted per-user; see src/lib/crypto.ts). Every
// call therefore takes the acting designer's decrypted key, so comments are
// authored as that designer in Linear.
//
// Everything NO-OPS silently when no key is passed, and no Linear failure is
// ever allowed to break a server action — calls are wrapped and only logged.
//
// A designer creates their key at:
// Linear → Settings → Security & access → Personal API keys.

const LINEAR_API = "https://api.linear.app/graphql";

/** Public URL of a flow's page. Falls back to a relative path if no base set. */
export function flowUrl(flowId: string): string {
  const base = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");
  return base ? `${base}/flows/${flowId}` : `/flows/${flowId}`;
}

const STATUS_MESSAGES: Record<string, string> = {
  todo: "📋 Design queued.",
  in_progress: "🎨 Design is in progress.",
  review: "👀 Design is in review.",
  done: "✅ Design completed.",
};

/** Human message for a ticket status, or null if the status is unknown. */
export function statusMessage(status: string): string | null {
  return STATUS_MESSAGES[status] ?? null;
}

async function gql<T = any>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch(LINEAR_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: apiKey },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) {
      console.error("[linear] GraphQL errors:", JSON.stringify(json.errors));
      return null;
    }
    return json.data as T;
  } catch (err) {
    console.error("[linear] request failed:", err);
    return null;
  }
}

/**
 * Validate a key by fetching the authenticated Linear user. Returns the
 * viewer's name/email on success, or null if the key is invalid/unreachable.
 * Used by the settings page to confirm a connection without storing the name.
 */
export async function getLinearViewer(
  apiKey: string
): Promise<{ name: string; email: string } | null> {
  const data = await gql<{ viewer: { name: string; email: string } }>(
    apiKey,
    `query{ viewer { name email } }`,
    {}
  );
  return data?.viewer ?? null;
}

/** Parse a Linear issue URL (or bare identifier) into team key + number. */
function parseIdentifier(input: string): { key: string; number: number } | null {
  // Matches https://linear.app/<ws>/issue/ENG-123/slug  and bare "ENG-123".
  const m = input.match(/([A-Za-z][A-Za-z0-9]*)-(\d+)/);
  if (!m) return null;
  return { key: m[1].toUpperCase(), number: Number(m[2]) };
}

/** Resolve a Linear issue URL/identifier to its internal UUID. */
async function resolveIssueId(
  apiKey: string,
  urlOrId: string
): Promise<string | null> {
  const parsed = parseIdentifier(urlOrId);
  if (!parsed) return null;
  const data = await gql<{ issues: { nodes: { id: string }[] } }>(
    apiKey,
    `query($key:String!,$num:Float!){
      issues(filter:{ team:{ key:{ eq:$key } }, number:{ eq:$num } }){ nodes { id } }
    }`,
    { key: parsed.key, num: parsed.number }
  );
  return data?.issues.nodes[0]?.id ?? null;
}

export type LinearIssue = {
  identifier: string;
  title: string;
  description: string;
  url: string;
  state: string;
  priorityLabel: string;
  labels: string[];
};

/**
 * Fetch an issue's content (title, description, labels…) for building a design
 * brief. Returns null on no key, unresolvable URL, or any error.
 */
export async function getLinearIssue(
  apiKey: string | null | undefined,
  issueUrl: string
): Promise<LinearIssue | null> {
  if (!apiKey || !issueUrl) return null;
  const parsed = parseIdentifier(issueUrl);
  if (!parsed) return null;
  const data = await gql<{
    issues: {
      nodes: {
        identifier: string;
        title: string;
        description: string | null;
        url: string;
        state: { name: string } | null;
        priorityLabel: string | null;
        labels: { nodes: { name: string }[] };
      }[];
    };
  }>(
    apiKey,
    `query($key:String!,$num:Float!){
      issues(filter:{ team:{ key:{ eq:$key } }, number:{ eq:$num } }){
        nodes {
          identifier title description url
          state { name }
          priorityLabel
          labels { nodes { name } }
        }
      }
    }`,
    { key: parsed.key, num: parsed.number }
  );
  const n = data?.issues.nodes[0];
  if (!n) return null;
  return {
    identifier: n.identifier,
    title: n.title,
    description: n.description ?? "",
    url: n.url,
    state: n.state?.name ?? "",
    priorityLabel: n.priorityLabel ?? "",
    labels: n.labels.nodes.map((l) => l.name),
  };
}

/**
 * Post a comment (authored as the key's owner) on the Linear issue identified
 * by `issueUrl`. Silent no-op when no key, unresolvable URL, or on any error.
 */
export async function postLinearComment(
  apiKey: string | null | undefined,
  issueUrl: string,
  body: string
): Promise<void> {
  try {
    if (!apiKey || !issueUrl || !body) return;
    const issueId = await resolveIssueId(apiKey, issueUrl);
    if (!issueId) {
      console.error("[linear] could not resolve issue from URL:", issueUrl);
      return;
    }
    await gql(
      apiKey,
      `mutation($id:String!,$body:String!){
        commentCreate(input:{ issueId:$id, body:$body }){ success }
      }`,
      { id: issueId, body }
    );
  } catch (err) {
    console.error("[linear] postComment failed:", err);
  }
}
