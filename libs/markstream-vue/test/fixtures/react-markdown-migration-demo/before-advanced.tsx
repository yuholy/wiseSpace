import Markdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

function rewriteDocsUrl(url: string) {
  if (url.startsWith('/docs/'))
    return `https://markstream.example.com${url}`
  return url
}

export function AdvancedArticle({ markdown }: { markdown: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      allowedElements={[
        'h1',
        'h2',
        'p',
        'a',
        'code',
        'pre',
        'ul',
        'ol',
        'li',
        'strong',
        'em',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
      ]}
      urlTransform={rewriteDocsUrl}
      components={{
        h1({ children }) {
          return <h1 className="docs-title">{children}</h1>
        },
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          )
        },
        code({ className, children, ...rest }) {
          const isBlock = /language-/.test(className || '')

          if (isBlock) {
            return (
              <pre className="docs-code">
                <code className={className} {...rest}>
                  {children}
                </code>
              </pre>
            )
          }

          return (
            <code className="inline-code" {...rest}>
              {children}
            </code>
          )
        },
      }}
    >
      {markdown}
    </Markdown>
  )
}
