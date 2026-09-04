import { describe, expect, it } from 'vitest';
import { formatCzk, parseCzk, paymentState, sumHalere } from './money';

const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatCzk', () => {
  it('formátuje haléře jako koruny', () => {
    expect(plain(formatCzk(1234550))).toBe('12 345,50 Kč');
    expect(plain(formatCzk(0))).toBe('0,00 Kč');
  });
});

describe('parseCzk', () => {
  it('převede zápis v korunách na haléře', () => {
    expect(parseCzk('120 000')).toBe(12000000);
    expect(parseCzk('1 234,5 Kč')).toBe(123450);
    expect(parseCzk('99.99')).toBe(9999);
  });

  it('odmítne nesmysly, záporné částky a víc než dvě desetinná místa', () => {
    expect(parseCzk('')).toBeNull();
    expect(parseCzk('abc')).toBeNull();
    expect(parseCzk('-500')).toBeNull();
    expect(parseCzk('12,345')).toBeNull();
  });
});

describe('sumHalere', () => {
  it('sčítá celé haléře bez chyb zaokrouhlení', () => {
    expect(sumHalere([833333, 833333, 833334])).toBe(2500000);
    expect(sumHalere([10, 20])).toBe(30);
    expect(sumHalere([])).toBe(0);
  });
});

describe('paymentState', () => {
  it('rozliší neuhrazený, částečně uhrazený, uhrazený a přeplacený doklad', () => {
    expect(paymentState(3000000, 0)).toBe('unpaid');
    expect(paymentState(3000000, 1000000)).toBe('partial');
    expect(paymentState(3000000, 3000000)).toBe('paid');
    expect(paymentState(3000000, 3630000)).toBe('overpaid');
  });
});
