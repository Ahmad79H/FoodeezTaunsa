import React from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './ui.jsx'
import './styles/base.css'
import './styles/site.css'
import './styles/site2.css'

import { installAutoScale } from './lib/scale.js'
import { AppProvider } from './store.jsx'
import { RouterProvider } from './router.jsx'
import SiteApp from './site/SiteApp.jsx'

installAutoScale()

createRoot(document.getElementById('root')).render(
  <AppProvider>
    <RouterProvider>
      <ErrorBoundary>
        <SiteApp />
      </ErrorBoundary>
    </RouterProvider>
  </AppProvider>,
)
