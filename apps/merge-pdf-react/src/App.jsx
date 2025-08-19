import { Routes, Route, Navigate } from 'react-router-dom'
import Merge from './pages/Merge.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/en" replace />} />
      <Route path="/:locale" element={<Merge />} />
    </Routes>
  )
}
