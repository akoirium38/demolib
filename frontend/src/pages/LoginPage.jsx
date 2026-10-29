import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import FormField from '../components/FormField'
import { applyServerErrors, getErrorMessage } from '../api/client'
import { homePathFor, useAuth } from '../context/auth'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 2.1.2 Đăng nhập — rule khớp với loginSchema ở backend/src/validators/auth.validator.js
export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onTouched' })

  // Đang đăng nhập rồi thì không hiện lại form (trừ khi vừa submit xong — onSubmit tự điều hướng)
  if (user && !isSubmitting) return <Navigate to={homePathFor(user.role)} replace />

  const onSubmit = async (values) => {
    try {
      const loggedIn = await login({ ...values, email: values.email.trim() })
      navigate(state?.from ?? homePathFor(loggedIn.role), { replace: true })
    } catch (err) {
      // INVALID_CREDENTIALS / ACCOUNT_DISABLED không gắn với field nào → hiển thị chung
      if (!applyServerErrors(err, setError)) {
        setError('root.server', { message: getErrorMessage(err) })
      }
    }
  }

  return (
    <section className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Đăng nhập</h1>
      {state?.flash && (
        <p role="status" className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.flash}
        </p>
      )}
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email}
          {...register('email', {
            validate: (v) => {
              const value = v.trim()
              if (!value) return 'Vui lòng nhập email'
              if (value.length > 255) return 'Email tối đa 255 ký tự'
              return EMAIL_PATTERN.test(value) || 'Email không hợp lệ'
            },
          })}
        />
        <FormField
          id="password"
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          error={errors.password}
          {...register('password', {
            required: 'Vui lòng nhập mật khẩu',
            minLength: { value: 8, message: 'Mật khẩu tối thiểu 8 ký tự' },
            maxLength: { value: 16, message: 'Mật khẩu tối đa 16 ký tự' },
          })}
        />

        {errors.root?.server && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors.root.server.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Đang xử lý...' : 'Đăng nhập'}
        </button>
        <p className="text-center text-sm text-slate-600">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-medium text-indigo-600 hover:underline">
            Đăng ký
          </Link>
        </p>
      </form>
    </section>
  )
}
