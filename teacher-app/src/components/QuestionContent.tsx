import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

type QuestionContentProps = {
  value?: string | null;
  className?: string;
};

function normalizeOcrMarkup(value: string) {
  return value
    .replace(/\\\\(?=[A-Za-z])/g, "\\")
    .replace(/\\\\(?=[{}])/g, "\\");
}

export function QuestionContent({ value, className }: QuestionContentProps) {
  if (!value) return null;
  return (
    <span className={["question-content", className].filter(Boolean).join(" ")}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <span>{children}</span>,
          strong: ({ children }) => <strong>{children}</strong>,
        }}
      >
        {normalizeOcrMarkup(value)}
      </ReactMarkdown>
    </span>
  );
}
