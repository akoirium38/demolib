import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import ConfirmDialog from '../components/ConfirmDialog'
import { createCategory, deleteCategory, fetchCategories, updateCategory } from '../api/categories'
import { applyServerErrors, getErrorMessage } from '../api/client'

// Khớp backend/src/validators/category.validator.js
const validateName = (v) => {
  const value = v.trim()
  if (!value) return 'Vui lòng nhập tên thể loại'
  return value.length <= 50 || 'Tên thể loại tối đa 50 ký tự'
}

const byName = (a, b) => a.name.localeCompare(b.name, 'vi')

function Notice({ notice }) {
  if (!notice) return null
  const isError = notice.type === 'error'
  return (
    <p
      role={isError ? 'alert' : 'status'}
      className={`rounded-md px-3 py-2 text-sm ${isError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}
    >
      {notice.text}
    </p>
  )
}

function AddCategoryForm({ onAdded }) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (values) => {
    try {
      onAdded(await createCategory(values))
      reset()
    } catch (err) {
      if (!applyServerErrors(err, setError, { CATEGORY_EXISTS: 'name' })) {
        setError('name', { type: 'server', message: getErrorMessage(err) })
      }
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-start gap-3">
      <div className="min-w-64 flex-1">
        <label htmlFor="new-category" className="sr-only">
          Tên thể loại mới
        </label>
        <input
          id="new-category"
          placeholder="Tên thể loại mới"
          aria-invalid={errors.name ? 'true' : 'false'}
          aria-describedby={errors.name ? 'new-category-error' : undefined}
          className={`block w-full rounded-md border px-3 py-2 text-slate-900 shadow-sm outline-none focus:ring-2 ${
            errors.name ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-200'
          }`}
          {...register('name', { validate: validateName })}
        />
        {errors.name && (
          <p id="new-category-error" className="mt-1 text-sm text-red-600">
            {errors.name.message}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isSubmitting ? 'Đang thêm...' : 'Thêm thể loại sách'}
      </button>
    </form>
  )
}

// BR-04: click tên → input; Enter/blur lưu, Esc hủy; lỗi → giữ tên cũ + thông báo
function EditableName({ category, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(category.name)
  const skipSave = useRef(false)

  const startEditing = () => {
    skipSave.current = false
    setDraft(category.name)
    setEditing(true)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      skipSave.current = true
      setEditing(false)
    }
  }

  const handleBlur = () => {
    if (skipSave.current) return
    skipSave.current = true
    setEditing(false)
    onSave(category, draft)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        title="Bấm để sửa"
        className="w-full rounded px-2 py-1 text-left text-slate-900 hover:bg-slate-100"
      >
        {category.name}
      </button>
    )
  }

  return (
    <input
      autoFocus
      aria-label={`Sửa tên thể loại ${category.name}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className="w-full rounded-md border border-indigo-400 px-2 py-1 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-200"
    />
  )
}

// 2.2.1 Quản lý thể loại sách — Librarian/Admin
export default function CategoriesPage() {
  const [categories, setCategories] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((err) => setLoadError(getErrorMessage(err)))
  }, [])

  const handleAdded = (category) => {
    setCategories((prev) => [...prev, category].sort(byName))
    setNotice({ type: 'success', text: `Đã thêm thể loại "${category.name}"` })
  }

  const handleRename = async (category, draft) => {
    const name = draft.trim()
    if (name === category.name) return
    const invalid = validateName(draft)
    if (invalid !== true) {
      setNotice({ type: 'error', text: invalid })
      return
    }
    try {
      const updated = await updateCategory(category.id, { name })
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)).sort(byName))
      setNotice({ type: 'success', text: `Đã đổi tên thành "${updated.name}"` })
    } catch (err) {
      setNotice({ type: 'error', text: getErrorMessage(err) })
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteCategory(toDelete.id)
      setCategories((prev) => prev.filter((c) => c.id !== toDelete.id))
      setNotice({ type: 'success', text: `Đã xóa thể loại "${toDelete.name}"` })
    } catch (err) {
      setNotice({ type: 'error', text: getErrorMessage(err) })
    } finally {
      setDeleting(false)
      setToDelete(null)
    }
  }

  if (loadError) return <p className="py-10 text-red-600">{loadError}</p>
  if (!categories) return <p className="py-10 text-slate-600">Đang tải...</p>

  return (
    <section className="space-y-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Thể loại sách</h1>

      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <AddCategoryForm onAdded={handleAdded} />
        <Notice notice={notice} />
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Tên thể loại</th>
              <th className="w-32 px-4 py-3 font-medium">Số sách</th>
              <th className="w-28 px-4 py-3 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.map((category) => (
              <tr key={category.id} data-testid="category-row">
                <td className="px-2 py-2">
                  <EditableName category={category} onSave={handleRename} />
                </td>
                <td className="px-4 py-2 text-slate-700">{category.bookCount}</td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => setToDelete(category)}
                    aria-label={`Xóa ${category.name}`}
                    className="font-medium text-red-600 hover:underline"
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  Chưa có thể loại nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Xóa thể loại"
          message={`Bạn có chắc muốn xóa thể loại ${toDelete.name}?`}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </section>
  )
}
