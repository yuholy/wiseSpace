import '../styles/globals.css'

export const metadata = {
  title: 'Next 15 SSR Lab',
}

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
