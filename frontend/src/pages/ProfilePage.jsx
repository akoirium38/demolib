import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import dayjs from 'dayjs'
import FormField from '../components/FormField'
import { changePassword, fetchProfile, updateProfile } from '../api/me'
import { applyServerErrors, getErrorMessage } from '../api/client'
import { useAuth } from '../context/auth'

// Khớp backend/src/validators/me.validator.js
const PHONE_PATTERN = /^(0|\+84)(3|5|7|8|9)\d{8}$/

const formatMoney = (n) => `${n.toLocaleString('vi-VN')} đ`

const requiredTrimmed = (message, max, maxMessage) => (v) => {
  const value = v.trim()
  if (!value) return message
  return value.length <= max || maxMessage
}

function InfoRow({ label, value, testId }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd data-testid={testId} className={value ? 'text-slate-900' : 'italic text-slate-400'}>
        {value || 'Chưa cập nhật'}
      </dd>
    </div>
  )
}

function StatCard({ label, value, testId }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p data-testid={testId} className="mt-1 text-xl font-semibold text-slate-900">
        {value}
      </p>
    </div>
  )
}

function SuccessMessage({ children }) {
  return (
    <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
      {children}
    </p>
  )
}

function ServerError({ error }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {error.message}
    </p>
  )
}

function ProfileForm({ profile, onSaved }) {
  const [saved, setSaved] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: 'onTouched',
    values: { name: profile.name, phone: profile.phone ?? '', address: profile.address ?? '' },
  })

  const onSubmit = async (values) => {
    setSaved(false)
    try {
      onSaved(await updateProfile(values))
      setSaved(true)
    } catch (err) {
      if (!applyServerErrors(err, setError)) setError('root.server', { message: getErrorMessage(err) })
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Cập nhật thông tin</h2>
      <FormField
        id="name"
        label="Tên"
        autoComplete="name"
        error={errors.name}
        {...register('name', { validate: requiredTrimmed('Vui lòng nhập tên', 50, 'Tên tối đa 50 ký tự') })}
      />
      <FormField
        id="phone"
        label="Số điện thoại"
        type="tel"
        autoComplete="tel"
        error={errors.phone}
        {...register('phone', {
          validate: (v) => {
            const value = v.trim()
            if (!value) return 'Vui lòng nhập số điện thoại'
            return PHONE_PATTERN.test(value) || 'Số điện thoại không hợp lệ'
          },
        })}
      />
      <FormField
        id="address"
        label="Địa chỉ"
        autoComplete="street-address"
        error={errors.address}
        {...register('address', {
          validate: requiredTrimmed('Vui lòng nhập địa chỉ', 255, 'Địa chỉ tối đa 255 ký tự'),
        })}
      />
      <ServerError error={errors.root?.server} />
      {saved && <SuccessMessage>Cập nhật thành công</SuccessMessage>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isSubmitting ? 'Đang lưu...' : 'Lưu thông tin'}
      </button>
    </form>
  )
}

function PasswordForm() {
  const [message, setMessage] = useState(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onTouched' })

  const passwordRules = {
    required: 'Vui lòng nhập mật khẩu mới',
    minLength: { value: 8, message: 'Mật khẩu tối thiểu 8 ký tự' },
    maxLength: { value: 16, message: 'Mật khẩu tối đa 16 ký tự' },
    validate: (v, values) => v !== values.currentPassword || 'Mật khẩu mới phải khác mật khẩu hiện tại',
  }

  const onSubmit = async (values) => {
    setMessage(null)
    try {
      const { message: ok } = await changePassword(values)
      reset()
      setMessage(ok)
    } catch (err) {
      if (!applyServerErrors(err, setError, { WRONG_PASSWORD: 'currentPassword' })) {
        setError('root.server', { message: getErrorMessage(err) })
      }
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Đổi mật khẩu</h2>
      <FormField
        id="currentPassword"
        label="Mật khẩu hiện tại"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword}
        {...register('currentPassword', { required: 'Vui lòng nhập mật khẩu hiện tại' })}
      />
      <FormField
        id="newPassword"
        label="Mật khẩu mới"
        type="password"
        autoComplete="new-password"
        error={errors.newPassword}
        {...register('newPassword', passwordRules)}
      />
      <FormField
        id="confirmPassword"
        label="Xác nhận mật khẩu mới"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword}
        {...register('confirmPassword', {
          required: 'Vui lòng xác nhận mật khẩu mới',
          validate: (v, values) => v === values.newPassword || 'Mật khẩu xác nhận không khớp',
        })}
      />
      <ServerError error={errors.root?.server} />
      {message && <SuccessMessage>{message}</SuccessMessage>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isSubmitting ? 'Đang xử lý...' : 'Đổi mật khẩu'}
      </button>
    </form>
  )
}

// 2.1.3 Hồ sơ cá nhân — mọi vai trò; thống kê chỉ hiện cho Reader
export default function ProfilePage() {
  const { updateUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    fetchProfile()
      .then(setProfile)
      .catch((err) => setLoadError(getErrorMessage(err)))
  }, [])

  const handleSaved = (updated) => {
    setProfile((prev) => ({ ...updated, stats: prev.stats }))
    updateUser({ name: updated.name, phone: updated.phone, address: updated.address })
  }

  if (loadError) return <p className="py-10 text-red-600">{loadError}</p>
  if (!profile) return <p className="py-10 text-slate-600">Đang tải...</p>

  return (
    <section className="space-y-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Hồ sơ cá nhân</h1>

      <dl className="divide-y divide-slate-100 rounded-lg bg-white px-6 py-2 shadow-sm">
        <InfoRow label="Tên" value={profile.name} testId="profile-name" />
        <InfoRow label="Email" value={profile.email} testId="profile-email" />
        <InfoRow label="Số điện thoại" value={profile.phone} testId="profile-phone" />
        <InfoRow label="Địa chỉ" value={profile.address} testId="profile-address" />
        <InfoRow label="Ngày tham gia" value={dayjs(profile.createdAt).format('DD/MM/YYYY')} testId="profile-joined" />
      </dl>

      {profile.role === 'READER' && (
        <div data-testid="profile-stats" className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Số lần mượn" value={profile.stats.borrowCount} testId="stat-borrow-count" />
          <StatCard label="Tổng tiền phạt" value={formatMoney(profile.stats.totalFine)} testId="stat-total-fine" />
          <StatCard label="Còn nợ" value={formatMoney(profile.stats.unpaidFine)} testId="stat-unpaid-fine" />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <ProfileForm profile={profile} onSaved={handleSaved} />
        <PasswordForm />
      </div>
    </section>
  )
}
