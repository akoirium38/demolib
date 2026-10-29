import { BrowserRouter, Link, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/auth'
import ProtectedRoute from './components/ProtectedRoute'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import CategoriesPage from './pages/CategoriesPage'
import AddBookPage from './pages/AddBookPage'
import BookListPage from './pages/BookListPage'

function NotFoundPage() {
  return <p className="py-10 text-slate-600">Không tìm thấy trang.</p>
}

function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link to="/" className="font-semibold text-indigo-600">
          DemoLib
        </Link>
        {user && user.role !== 'READER' && (
          <>
            <Link to="/dashboard" className="text-sm text-slate-700 hover:text-indigo-600">
              Dashboard
            </Link>
            <Link to="/categories" className="text-sm text-slate-700 hover:text-indigo-600">
              Thể loại
            </Link>
          </>
        )}
        <div className="ml-auto flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link to="/profile" className="text-slate-700 hover:text-indigo-600">
                Hồ sơ
              </Link>
              <span data-testid="current-user" className="text-slate-700">
                {user.name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-slate-700 hover:text-indigo-600">
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-slate-50">
          <Header />
          <main className="mx-auto max-w-6xl px-4">
            <Routes>
              <Route path="/" element={<BookListPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
              <Route element={<ProtectedRoute roles={['LIBRARIAN', 'ADMIN']} />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/books/new" element={<AddBookPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
