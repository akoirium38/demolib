import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'

function HomePage() {
  return (
    <section className="py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Thư viện DemoLib</h1>
      <p className="mt-2 text-slate-600">Hệ thống quản lý mượn trả sách.</p>
    </section>
  )
}

function NotFoundPage() {
  return <p className="py-10 text-slate-600">Không tìm thấy trang.</p>
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link to="/" className="font-semibold text-indigo-600">
              DemoLib
            </Link>
            <div className="ml-auto flex items-center gap-4 text-sm">
              <Link to="/login" className="text-slate-700 hover:text-indigo-600">
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
              >
                Đăng ký
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
