import React from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './ui.jsx'
import './styles/base.css'
import './styles/site.css'
import './styles/site2.css'
import './styles/admin.css'

import { AppProvider } from './store.jsx'
import AdminRoot from './admin/AdminApp.jsx'

createRoot(document.getElementById('root')).render(
  <AppProvider>
    <ErrorBoundary>
      <AdminRoot />
    </ErrorBoundary>
  </AppProvider>,
)
