import { linkifySegments } from '@/lib/comment-thread';

/**
 * Plain-text comment body: line breaks preserved, http(s)/www URLs auto-linked.
 * Everything is rendered as React text nodes (never as HTML).
 */
export function CommentBody({ body }: { body: string }) {
  return (
    <p className="text-[14px] leading-relaxed font-medium break-words whitespace-pre-wrap text-cocoon-ink lg:text-[15px]">
      {linkifySegments(body).map((segment, index) =>
        segment.type === 'link' ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-cocoon-blue underline"
          >
            {segment.label}
          </a>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </p>
  );
}
