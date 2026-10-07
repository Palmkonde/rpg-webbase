export const metadata = {
  title: 'Game Engine Playground',
}

// Every overlay sizes in rem, so this one root font size scales all of them.
const HTML_STYLE = { fontSize: '150%' }

const BODY_STYLE = { margin: 0 }

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en" style={HTML_STYLE}>
      <body style={BODY_STYLE}>{children}</body>
    </html>
  )
}
