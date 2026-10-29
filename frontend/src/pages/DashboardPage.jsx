import { useAuth } from '../context/auth'

// Tạm thời: trang đích sau đăng nhập của Librarian/Admin. Nội dung báo cáo làm ở 3.19 (2.7.1).
export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <section className="py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-2 text-slate-600">Xin chào, {user.name}.</p>
    </section>
  )
}
