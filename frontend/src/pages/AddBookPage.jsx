import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import FormField from '../components/FormField'
import { fetchCategories } from '../api/categories'
import { createBook } from '../api/books'
import { applyServerErrors, getErrorMessage } from '../api/client'
import { isValidIsbn, normalizeIsbn } from '../utils/isbn'

// Khớp backend/src/validators/book.validator.js
const MIN_YEAR = 1900
const MAX_QUANTITY = 9999
const currentYear = () =>
  Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).format(new Date()))

const requiredText = (label, max) => (v) => {
  const value = v.trim()
  if (!value) return `Vui lòng nhập ${label}`
  return value.length <= max || `${label[0].toUpperCase()}${label.slice(1)} tối đa ${max} ký tự`
}

const integerIn = (label, min, max, minMessage, maxMessage) => (v) => {
  if (v.trim() === '') return `Vui lòng nhập ${label}`
  const n = Number(v)
  if (!Number.isFinite(n)) return `${label[0].toUpperCase()}${label.slice(1)} phải là số`
  if (!Number.isInteger(n)) return `${label[0].toUpperCase()}${label.slice(1)} phải là số nguyên`
  if (n < min) return minMessage
  return n <= max || maxMessage
}

const validateIsbn = (v) => {
  if (!v.trim()) return true
  return isValidIsbn(normalizeIsbn(v)) || 'ISBN không hợp lệ (cần ISBN-10 hoặc ISBN-13 đúng chữ số kiểm tra)'
}

const inputClass = (error) =>
  `mt-1 block w-full rounded-md border px-3 py-2 text-slate-900 shadow-sm outline-none focus:ring-2 ${
    error ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-200'
  }`

function FieldError({ id, error }) {
  if (!error) return null
  return (
    <p id={id} className="mt-1 text-sm text-red-600">
      {error.message}
    </p>
  )
}

const EMPTY = { title: '', author: '', publishYear: '', isbn: '', categoryId: '', description: '', quantity: '' }

// 2.2.2 Thêm sách mới — Librarian/Admin
export default function AddBookPage() {
  const [categories, setCategories] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [added, setAdded] = useState(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onTouched', defaultValues: EMPTY })

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((err) => setLoadError(getErrorMessage(err)))
  }, [])

  const onSubmit = async (values) => {
    setAdded(null)
    try {
      const book = await createBook({
        ...values,
        publishYear: Number(values.publishYear),
        categoryId: Number(values.categoryId),
        quantity: Number(values.quantity),
      })
      // Tạm thời ở lại form; chuyển sang trang chi tiết sách khi có 3.7 (2.2.4)
      reset(EMPTY)
      setAdded(book)
    } catch (err) {
      if (!applyServerErrors(err, setError, { ISBN_EXISTS: 'isbn' })) {
        setError('root.server', { message: getErrorMessage(err) })
      }
    }
  }

  if (loadError) return <p className="py-10 text-red-600">{loadError}</p>
  if (!categories) return <p className="py-10 text-slate-600">Đang tải...</p>

  return (
    <section className="mx-auto max-w-2xl py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Thêm sách mới</h1>

      {categories.length === 0 ? (
        <p role="alert" className="mt-6 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Cần tạo thể loại trước.{' '}
          <Link to="/categories" className="font-medium text-indigo-600 hover:underline">
            Đi tới trang Thể loại
          </Link>
        </p>
      ) : (
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4 rounded-lg bg-white p-6 shadow-sm">
          {added && (
            <div role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              <p className="font-medium">Thêm sách thành công</p>
              <p data-testid="added-book">
                Đã thêm "{added.title}" — {added.totalQuantity} cuốn, thể loại {added.category?.name}
              </p>
            </div>
          )}

          <FormField
            id="title"
            label="Tên sách"
            error={errors.title}
            {...register('title', { validate: requiredText('tên sách', 100) })}
          />
          <FormField
            id="author"
            label="Tác giả"
            error={errors.author}
            {...register('author', { validate: requiredText('tác giả', 100) })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="publishYear"
              label="Năm xuất bản"
              inputMode="numeric"
              error={errors.publishYear}
              {...register('publishYear', {
                validate: (v) =>
                  integerIn(
                    'năm xuất bản',
                    MIN_YEAR,
                    currentYear(),
                    `Năm xuất bản phải từ ${MIN_YEAR}`,
                    'Năm xuất bản không được lớn hơn năm hiện tại',
                  )(v),
              })}
            />
            <FormField
              id="isbn"
              label="ISBN (không bắt buộc)"
              error={errors.isbn}
              {...register('isbn', { validate: validateIsbn })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="categoryId" className="block text-sm font-medium text-slate-700">
                Thể loại
              </label>
              <select
                id="categoryId"
                aria-invalid={errors.categoryId ? 'true' : 'false'}
                aria-describedby={errors.categoryId ? 'categoryId-error' : undefined}
                className={inputClass(errors.categoryId)}
                {...register('categoryId', { required: 'Vui lòng chọn thể loại' })}
              >
                <option value="">-- Chọn thể loại --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <FieldError id="categoryId-error" error={errors.categoryId} />
            </div>
            <FormField
              id="quantity"
              label="Số lượng"
              inputMode="numeric"
              error={errors.quantity}
              {...register('quantity', {
                validate: integerIn(
                  'số lượng',
                  1,
                  MAX_QUANTITY,
                  'Số lượng phải lớn hơn 0',
                  `Số lượng tối đa ${MAX_QUANTITY}`,
                ),
              })}
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700">
              Mô tả
            </label>
            <textarea
              id="description"
              rows={3}
              aria-invalid={errors.description ? 'true' : 'false'}
              aria-describedby={errors.description ? 'description-error' : undefined}
              className={inputClass(errors.description)}
              {...register('description', { validate: requiredText('mô tả', 255) })}
            />
            <FieldError id="description-error" error={errors.description} />
          </div>

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
            {isSubmitting ? 'Đang lưu...' : 'Thêm sách'}
          </button>
        </form>
      )}
    </section>
  )
}
