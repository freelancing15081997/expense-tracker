import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useQuery } from '../src/hooks/useApi';

test('useQuery shows the cached value on the next screen immediately', async () => {
  const seen: (number | undefined)[] = [];
  function Probe() {
    const q = useQuery(() => Promise.resolve(7), [], 'cache-probe');
    useEffect(() => { seen.push(q.data); });
    return null;
  }
  let first!: TestRenderer.ReactTestRenderer;
  await act(async () => { first = TestRenderer.create(<Probe />); });
  expect(seen).toContain(7);
  await act(async () => { first.unmount(); });
  seen.length = 0;
  await act(async () => { TestRenderer.create(<Probe />); });
  expect(seen[0]).toBe(7);
});
