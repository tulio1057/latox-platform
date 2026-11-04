import sanitizeHtml from "sanitize-html";

const MEDIA_SRC = /^\/api\/v1\/public\/media\/[A-Za-z0-9_-]{8,64}$/;

/**
 * Allow-list sanitizer for rich text produced by the admin editor.
 * Everything not explicitly allowed (scripts, event handlers, styles, iframes,
 * javascript:/data: URLs, external images) is removed before storage.
 */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "h4", "blockquote",
      "ul", "ol", "li", "a", "img", "hr", "code", "pre",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
    },
    allowedSchemes: ["https", "mailto"],
    allowedSchemesByTag: { img: [] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    exclusiveFilter: (frame) => frame.tag === "img" && !MEDIA_SRC.test(frame.attribs.src ?? ""),
    transformTags: {
      a: (tagName, attribs) => {
        const out: Record<string, string> = { href: attribs.href ?? "" };
        if (attribs.title) out.title = attribs.title;
        if (/^https:/i.test(attribs.href ?? "")) {
          out.target = "_blank";
          out.rel = "noopener noreferrer nofollow";
        }
        return { tagName, attribs: out };
      },
    },
  });
}

/** Strips all markup — for plain text fields. */
export function plainText(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}
