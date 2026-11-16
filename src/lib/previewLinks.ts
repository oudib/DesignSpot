// Many sites (Gmail, Google Calendar, most SaaS apps) refuse to load inside a
// frame, so a design's link to one of them shows "refused to connect" when it
// navigates the preview iframe. This script is appended to HTML designs served
// for preview: a plain click on a link to another site opens it in a new tab
// instead. Links within the design (same origin, #anchors) are left alone, as
// are links that already open elsewhere and clicks the page handled itself.
const SCRIPT = `
<script>
(function () {
  if (window.top === window) return;
  window.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var target = (a.getAttribute("target") || "").toLowerCase();
    if (target && target !== "_self" && target !== "_parent" && target !== "_top") return;
    var url;
    try { url = new URL(a.getAttribute("href"), location.href); } catch (_) { return; }
    if (!/^https?:$/.test(url.protocol) || url.origin === location.origin) return;
    e.preventDefault();
    window.open(url.href, "_blank", "noopener");
  });
})();
</script>
`;

/** The appended script's source, so the file route can version its cache on it. */
export const PREVIEW_SCRIPT_SOURCE = SCRIPT;

const TAIL = new TextEncoder().encode(SCRIPT);

/** Append the outside-link script to a streamed HTML body, without buffering it. */
export function withOutsideLinksInNewTab(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      flush(controller) {
        controller.enqueue(TAIL);
      },
    })
  );
}
