import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { fetchBooks } from '../api/books'
import { fetchCategories } from '../api/categories'
import { getErrorMessage } from '../api/client'

// Khớp backend/src/validators/book.validator.js (BOOK_SORTS)
const SORTS = [
  { value: 'title', label: 'Tên A-Z' },
  { value: 'newest', label: 'Năm xuất bản mới nhất' },
  { value: 'popular', label: 'Mượn nhiều nhất' },
]
const PAGE_SIZE = 10

// BR-05: tham số lấy từ URL; giá trị sai trên URL thì bỏ qua thay vì gọi API nhận 400
const readParams = (searchParams) => {
  const page = Number(searchParams.get('page'))
  const categoryId = Number(searchParams.get('categoryId'))
  const sort = searchParams.get('sort')
  return {
    q: (searchParams.get('q') ?? '').trim().slice(0, 100),
    categoryId: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : undefined,
    sort: SORTS.some((s) => s.value === sort) ? sort : 'title',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

const selectClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'

function StatusBadge({ status }) {
  const available = status === 'AVAILABLE'
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        available ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
      }`}
    >
      {available ? 'Có sẵn' : 'Hết sách'}
    </span>
  )
}

export default function BookListPage() {
  const { user } = useAuth()
  const isStaff = user && user.role !== 'READER'
  const [searchParams, setSearchParams] = useSearchParams()
  const params = readParams(searchParams)
  const { q, categoryId, sort, page } = params

  const [categories, setCategories] = useState([])
  // Kết quả gắn với khóa truy vấn → khi đổi bộ lọc, kết quả cũ tự thành "đang tải" mà không cần setState trong effect
  const queryKey = JSON.stringify(params)
  const [fetched, setFetched] = useState({ key: null, result: null, error: '' })
  const current = fetched.key === queryKey ? fetched : null
  const result = current?.result ?? null
  const error = current?.error ?? ''

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    let ignore = false
    fetchBooks({ q: q || undefined, categoryId, sort, page, limit: PAGE_SIZE })
      .then((res) => !ignore && setFetched({ key: queryKey, result: res, error: '' }))
      .catch((err) => !ignore && setFetched({ key: queryKey, result: null, error: getErrorMessage(err) }))
    return () => {
      ignore = true
    }
  }, [queryKey, q, categoryId, sort, page])

  // Đổi bộ lọc → về trang 1; bỏ tham số mặc định cho URL gọn
  const updateParams = (changes) => {
    const next = { ...params, page: 1, ...changes }
    const query = {}
    if (next.q) query.q = next.q
    if (next.categoryId) query.categoryId = String(next.categoryId)
    if (next.sort !== 'title') query.sort = next.sort
    if (next.page > 1) query.page = String(next.page)
    setSearchParams(query)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    updateParams({ q: new FormData(e.currentTarget).get('q').trim() })
  }

  const books = result?.data ?? []
  const totalPages = result?.meta.totalPages ?? 0

  return (
    <section className="py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Thư viện DemoLib</h1>
          <p className="mt-1 text-slate-600">Danh sách sách</p>
        </div>
        {isStaff && (
          <Link
            to="/books/new"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Thêm Sách Mới
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_14rem_14rem]">
        {/* key={q}: ô tìm kiếm lấy lại giá trị từ URL khi bấm Back/Forward */}
        <form key={q} role="search" onSubmit={handleSearch}>
          <label htmlFor="book-search" className="block text-sm font-medium text-slate-700">
            Tìm kiếm
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="book-search"
              type="search"
              name="q"
              defaultValue={q}
              maxLength={100}
              placeholder="Tên sách hoặc tác giả"
              className="block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Tìm
            </button>
          </div>
        </form>
        <div>
          <label htmlFor="book-category" className="block text-sm font-medium text-slate-700">
            Thể loại
          </label>
          <select
            id="book-category"
            value={categoryId ?? ''}
            onChange={(e) => updateParams({ categoryId: Number(e.target.value) || undefined })}
            className={selectClass}
          >
            <option value="">Tất cả thể loại</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="book-sort" className="block text-sm font-medium text-slate-700">
            Sắp xếp
          </label>
          <select
            id="book-sort"
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value })}
            className={selectClass}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!error && !result && <p className="mt-6 text-slate-500">Đang tải...</p>}

      {result && books.length === 0 && (
        <p className="mt-6 rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-slate-600">
          Không tìm thấy sách
        </p>
      )}

      {books.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Tên sách</th>
                <th className="px-4 py-3 font-medium">Tác giả</th>
                <th className="px-4 py-3 font-medium">Năm XB</th>
                <th className="px-4 py-3 font-medium">Thể loại</th>
                <th className="px-4 py-3 text-right font-medium">Có sẵn</th>
                <th className="px-4 py-3 text-right font-medium">Đang mượn</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {books.map((b) => (
                <tr key={b.id} data-testid="book-row">
                  {/* Tạm thời không bấm được; link tới chi tiết sách khi có 3.7 */}
                  <td className="px-4 py-3 font-medium text-slate-900">{b.title}</td>
                  <td className="px-4 py-3">{b.author}</td>
                  <td className="px-4 py-3">{b.publishYear}</td>
                  <td className="px-4 py-3">{b.category?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{b.availableQuantity}</td>
                  <td className="px-4 py-3 text-right">{b.borrowedQuantity}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && totalPages > 0 && (
        <nav aria-label="Phân trang" className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            {result.meta.total} sách · Trang {page}/{totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => updateParams({ page: Math.min(page - 1, totalPages) })}
              className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Trang trước
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => updateParams({ page: page + 1 })}
              className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Trang sau
            </button>
          </div>
        </nav>
      )}
    </section>
  )
}
