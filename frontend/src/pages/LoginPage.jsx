import { useLocation } from 'react-router-dom'

// Tạm thời: chỉ hiển thị thông báo sau đăng ký. Form đăng nhập làm ở 3.2 (2.1.2).
export default function LoginPage() {
  const flash = useLocation().state?.flash

  return (
    <section className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Đăng nhập</h1>
      {flash && (
        <p role="status" className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {flash}
        </p>
      )}
    </section>
  )
}
