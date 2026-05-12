import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import 'katex/dist/katex.min.css'
import 'markstream-react/index.css'
import 'monaco-editor/min/vs/editor/editor.main.css'
import '../../playground-react18/src/shared/test-lab.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="markstream-vue">
      <App />
    </div>
  </React.StrictMode>,
)
