import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest không bật globals → Testing Library không tự cleanup DOM giữa các test
afterEach(cleanup)
