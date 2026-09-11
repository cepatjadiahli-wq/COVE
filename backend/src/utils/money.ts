export type MoneyInput = string | number;
export type MoneyString = string;

export const MAX_NUMERIC_MINOR_UNITS = 999999999999999999n; // 9,999,999,999,999,999.99

export function parseMoneyToMinorUnits(input: MoneyInput): bigint {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) {
      throw new Error(`Nilai uang tidak valid: ${input}`);
    }
    // Only accept JS numbers if they safely fit within IEEE-754 integer cents
    const safeCents = Math.round(input * 100);
    if (!Number.isSafeInteger(safeCents)) {
      throw new Error(`Nilai angka JavaScript (${input}) melebihi batas presisi aman. Gunakan string desimal.`);
    }
    input = input.toFixed(2);
  }

  if (typeof input !== 'string') {
    throw new Error(`Tipe nilai uang harus berupa string atau number: ${typeof input}`);
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Nilai uang tidak boleh kosong.');
  }

  // Enforce positive decimal with up to 2 decimal places: e.g. "123", "123.4", "123.45"
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`Format nilai uang tidak valid: "${input}". Gunakan format desimal positif hingga 2 digit pecahan (misal: "1250000000.00").`);
  }

  const parts = trimmed.split('.');
  const intPart = BigInt(parts[0]);
  const fracPart = parts[1] ? parts[1].padEnd(2, '0') : '00';
  const minor = intPart * 100n + BigInt(fracPart);

  if (minor > MAX_NUMERIC_MINOR_UNITS) {
    throw new Error(`Nilai uang melebihi batas maksimum NUMERIC(18,2) (9.999.999.999.999.999,99).`);
  }

  return minor;
}

export function minorUnitsToMoney(minor: bigint): MoneyString {
  const isNeg = minor < 0n;
  const abs = isNeg ? -minor : minor;
  const intPart = abs / 100n;
  const fracPart = (abs % 100n).toString().padStart(2, '0');
  return `${isNeg ? '-' : ''}${intPart.toString()}.${fracPart}`;
}

export function parseMoney(input: MoneyInput): MoneyString {
  return minorUnitsToMoney(parseMoneyToMinorUnits(input));
}

export function addMoney(a: MoneyInput, b: MoneyInput): MoneyString {
  const res = parseMoneyToMinorUnits(a) + parseMoneyToMinorUnits(b);
  if (res > MAX_NUMERIC_MINOR_UNITS) {
    throw new Error('Hasil penjumlahan melebihi batas maksimum NUMERIC(18,2).');
  }
  return minorUnitsToMoney(res);
}

export function subtractMoney(a: MoneyInput, b: MoneyInput): MoneyString {
  const res = parseMoneyToMinorUnits(a) - parseMoneyToMinorUnits(b);
  return minorUnitsToMoney(res);
}

export function compareMoney(a: MoneyInput, b: MoneyInput): number {
  const diff = parseMoneyToMinorUnits(a) - parseMoneyToMinorUnits(b);
  if (diff < 0n) return -1;
  if (diff > 0n) return 1;
  return 0;
}

export function isZeroMoney(a: MoneyInput): boolean {
  return parseMoneyToMinorUnits(a) === 0n;
}

export function isPositiveMoney(a: MoneyInput): boolean {
  return parseMoneyToMinorUnits(a) > 0n;
}
