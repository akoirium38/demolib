import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import FormField from '../components/FormField'
import { registerUser } from '../api/auth'
import { applyServerErrors, getErrorMessage } from '../api/client'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 2.1.1 Đăng ký — rule khớp với backend/src/validators/auth.validator.js
export default function RegisterPage() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onTouched' })

  const onSubmit = async (values) => {
    try {
      await registerUser(values)
      navigate('/login', { state: { flash: 'Đăng ký thành công. Vui lòng đăng nhập.' } })
    } catch (err) {
      if (!applyServerErrors(err, setError, { EMAIL_EXISTS: 'email' })) {
        setError('root.server', { message: getErrorMessage(err) })
      }
    }
  }

  return (
    <section className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Đăng ký</h1>
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
          id="name"
          label="Tên"
          autoComplete="name"
          error={errors.name}
          {...register('name', {
            validate: (v) => {
              const value = v.trim()
              if (!value) return 'Vui lòng nhập tên'
              return value.length <= 50 || 'Tên tối đa 50 ký tự'
            },
          })}
        />
        <FormField
          id="password"
          label="Mật khẩu"
          type="password"
          autoComplete="new-password"
          error={errors.password}
          {...register('password', {
            required: 'Vui lòng nhập mật khẩu',
            minLength: { value: 8, message: 'Mật khẩu tối thiểu 8 ký tự' },
            maxLength: { value: 16, message: 'Mật khẩu tối đa 16 ký tự' },
          })}
        />
        <FormField
          id="confirmPassword"
          label="Xác nhận mật khẩu"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword}
          {...register('confirmPassword', {
            required: 'Vui lòng xác nhận mật khẩu',
            validate: (v, values) => v === values.password || 'Mật khẩu xác nhận không khớp',
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
          {isSubmitting ? 'Đang xử lý...' : 'Đăng ký'}
        </button>
        <p className="text-center text-sm text-slate-600">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </form>
    </section>
  )
}
