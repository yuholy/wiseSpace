import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="home-shell">
      <h1>Next 14 Playground</h1>
      <p>Use the dedicated SSR lab routes for formal acceptance.</p>
      <nav>
        <ul>
          <li><Link href="/app-ssr-lab">/app-ssr-lab</Link></li>
          <li><Link href="/pages-ssr-lab">/pages-ssr-lab</Link></li>
        </ul>
      </nav>
    </main>
  )
}
