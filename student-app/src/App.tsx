import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Workbench from './pages/Workbench'
import Live from './pages/Live'
import LiveRoom from './pages/LiveRoom'
import Classes from './pages/Classes'
import Records from './pages/Records'
import Auth from './pages/Auth'
import { StudentApiProvider, useStudentApi } from './api'

function StudentRoutes() {
  const { user, ready } = useStudentApi()
  if (!ready) return <div className="grid min-h-screen place-items-center text-slate-400">正在恢复登录状态...</div>
  if (!user) return <Auth />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/workbench" element={<Workbench />} />
        <Route path="/live" element={<Live />} />
        <Route path="/classes" element={<Classes />} />
        <Route path="/records" element={<Records />} />
      </Route>
      <Route path="/live/room/:id" element={<LiveRoom />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App(){return <StudentApiProvider><StudentRoutes/></StudentApiProvider>}
