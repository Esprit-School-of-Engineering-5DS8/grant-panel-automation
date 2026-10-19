import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@material/web/typography/md-typescale-styles.css'
import './m3/tokens.css'
import './index.css'
import './m3/material.css'
import './m3/md'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
