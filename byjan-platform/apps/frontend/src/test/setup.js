import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Required because the suite runs with isolate:false — render() output must
// be unmounted between tests, including across test-file boundaries.
afterEach(() => cleanup());
