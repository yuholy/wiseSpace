import * as nextEntry from 'markstream-react/next'
import * as serverEntry from 'markstream-react/server'
import { SsrLabPage } from '../../src/ssr-lab-page'

export default function AppSsrLabPage() {
  return (
    <SsrLabPage
      version="next15"
      router="app"
      nextEntry={nextEntry}
      serverEntry={serverEntry}
    />
  )
}
