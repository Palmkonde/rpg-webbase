export const metadata = {
  title: 'Game Engine Playground',
}

// Every overlay sizes in rem, so this one root font size scales all of them.
const HTML_STYLE = { fontSize: '150%' }

const BODY_STYLE = { margin: 0 }

// Browsers don't let <button> inherit font size by default; without this, plain Choice/Dismiss buttons wouldn't scale.
const GLOBAL_CSS = 'button { font: inherit; }'

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en" style={HTML_STYLE}>
      <head>
        <style>{GLOBAL_CSS}</style>
      </head>
      <body style={BODY_STYLE}>{children}</body>
    </html>
  )
}
