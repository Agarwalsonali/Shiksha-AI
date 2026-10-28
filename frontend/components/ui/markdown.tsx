'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '@/lib/utils';
import { memo, useState } from 'react';
import { RiFileCopyLine, RiCheckLine } from '@remixicon/react';

// Import KaTeX CSS
import 'katex/dist/katex.min.css';

interface MarkdownProps {
  content: string;
  className?: string;
}

// Copy button for code blocks
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 p-1.5 rounded-md bg-background/80 hover:bg-background border border-border/50 opacity-0 group-hover:opacity-100 transition-opacity"
      title="Copy code"
    >
      {copied ? (
        <RiCheckLine className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <RiFileCopyLine className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

/**
 * Markdown renderer with support for:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists)
 * - Math equations (LaTeX via KaTeX) - use $...$ for inline, $$...$$ for block
 * - Code syntax highlighting with copy button
 * - Chemical equations (via mhchem in KaTeX)
 */
export const Markdown = memo(function Markdown({ content, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        // Base prose styling
        'prose prose-sm dark:prose-invert max-w-none',
        // Better text readability
        'prose-p:leading-relaxed prose-li:leading-relaxed',
        // Headings
        'prose-headings:font-semibold prose-headings:tracking-tight',
        'prose-h1:text-xl prose-h2:text-lg prose-h3:text-base',
        'prose-h1:mt-6 prose-h1:mb-3 prose-h2:mt-5 prose-h2:mb-2 prose-h3:mt-4 prose-h3:mb-2',
        'prose-h1:border-b prose-h1:pb-2 prose-h1:border-border/50',
        // Paragraphs
        'prose-p:my-2.5 prose-p:text-foreground/90',
        // Lists
        'prose-ul:my-2.5 prose-ol:my-2.5 prose-li:my-1',
        'prose-ul:pl-4 prose-ol:pl-4',
        '[&_ul]:list-disc [&_ol]:list-decimal',
        // Code
        'prose-code:text-[13px] prose-code:font-medium',
        'prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:my-3 prose-pre:p-0 prose-pre:bg-transparent',
        // Blockquote
        'prose-blockquote:my-3 prose-blockquote:not-italic',
        // Links
        'prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline',
        // Strong/Bold
        'prose-strong:font-semibold prose-strong:text-foreground',
        // Tables
        'prose-table:my-3',
        // HR
        'prose-hr:my-4 prose-hr:border-border/50',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeKatex,
          [rehypeHighlight, { detect: true, ignoreMissing: true }],
        ]}
        components={{
          // Code blocks with copy button
          pre: ({ children, ...props }) => {
            const codeElement = (children as any)?.props?.children;
            const codeText = typeof codeElement === 'string' ? codeElement : '';
            
            return (
              <div className="group relative my-3">
                <pre 
                  className="overflow-x-auto rounded-lg bg-muted/70 border border-border/50 p-4 text-[13px] leading-relaxed"
                  {...props}
                >
                  {children}
                </pre>
                {codeText && <CopyButton text={codeText} />}
              </div>
            );
          },
          // Inline code
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code 
                  className="rounded-md bg-muted/70 border border-border/30 px-1.5 py-0.5 text-[13px] font-medium text-foreground/90" 
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={cn('text-[13px]', className)} {...props}>
                {children}
              </code>
            );
          },
          // Tables with better styling
          table: ({ children, ...props }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full text-sm" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-muted/50 border-b border-border/50" {...props}>
              {children}
            </thead>
          ),
          th: ({ children, ...props }) => (
            <th className="px-3 py-2 text-left font-semibold text-foreground" {...props}>
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="px-3 py-2 border-t border-border/30" {...props}>
              {children}
            </td>
          ),
          // Blockquote with icon
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="my-3 rounded-r-lg border-l-4 border-primary/60 bg-primary/5 py-2 pl-4 pr-3 text-foreground/80"
              {...props}
            >
              {children}
            </blockquote>
          ),
          // Links
          a: ({ children, href, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium hover:underline underline-offset-2"
              {...props}
            >
              {children}
            </a>
          ),
          // Lists
          ul: ({ children, ...props }) => (
            <ul className="my-2.5 space-y-1 pl-1" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="my-2.5 space-y-1 pl-1" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="leading-relaxed text-foreground/90 marker:text-muted-foreground" {...props}>
              {children}
            </li>
          ),
          // Horizontal rule
          hr: ({ ...props }) => (
            <hr className="my-5 border-border/50" {...props} />
          ),
          // Images
          img: ({ src, alt, ...props }) => (
            <span className="block my-3">
              <img
                src={src}
                alt={alt}
                className="rounded-lg border border-border/50 max-w-full h-auto"
                loading="lazy"
                {...props}
              />
              {alt && (
                <span className="block text-center text-xs text-muted-foreground mt-1.5">
                  {alt}
                </span>
              )}
            </span>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default Markdown;
