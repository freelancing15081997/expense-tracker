import { takeQrOnce } from '../src/native/device';

test('a UPI payload is accepted once until the debounce window clears', () => {
  const code = 'upi://pay?pa=once@okaxis';
  expect(takeQrOnce(code)).toBe(true);
  expect(takeQrOnce(code)).toBe(false);
});
