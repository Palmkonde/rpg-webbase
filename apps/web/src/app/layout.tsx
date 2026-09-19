export const metadata = {
  title: 'Game Engine Playground',
}

const BODY_STYLE = { margin: 0 }

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en">
      <body style={BODY_STYLE}>{children}</body>
    </html>
  )
}
