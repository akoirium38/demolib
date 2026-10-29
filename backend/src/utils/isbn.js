// 2.2.2 BR-03: chuẩn hóa ISBN — bỏ dấu "-" và khoảng trắng, chữ x cuối viết hoa
export const normalizeIsbn = (value) => value.replace(/[-\s]/g, '').toUpperCase();

const isValidIsbn10 = (isbn) => {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = [...isbn].reduce((s, ch, i) => s + (ch === 'X' ? 10 : Number(ch)) * (10 - i), 0);
  return sum % 11 === 0;
};

const isValidIsbn13 = (isbn) => {
  if (!/^\d{13}$/.test(isbn)) return false;
  const sum = [...isbn].reduce((s, ch, i) => s + Number(ch) * (i % 2 ? 3 : 1), 0);
  return sum % 10 === 0;
};

// Nhận ISBN đã chuẩn hóa: đúng độ dài và đúng chữ số kiểm tra
export const isValidIsbn = (isbn) => isValidIsbn10(isbn) || isValidIsbn13(isbn);
