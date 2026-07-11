import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ThemeSelectionProvider from './themes/ThemeSelectionProvider'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 1000, // 15 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeSelectionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeSelectionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
