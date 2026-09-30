import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ByjanMark from './ByjanMark.jsx';
import ByjanLoader from './ByjanLoader.jsx';

describe('ByjanMark', () => {
  it('renders an accessible svg with the trace-loop path and accent circles', () => {
    const { container } = render(<ByjanMark size={40} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg).toHaveAttribute('viewBox', '0 0 200 200');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-label', 'byjan');
    // main path + 3 accent circles (mask holes live inside <defs>)
    expect(svg.querySelectorAll('path').length).toBe(1);
    const visibleCircles = [...svg.querySelectorAll('circle')].filter(c => !c.closest('defs'));
    expect(visibleCircles.length).toBe(3);
    // gradient + mask defs (unique per instance via useId)
    expect(svg.querySelector('linearGradient')).toBeTruthy();
    expect(svg.querySelector('mask')).toBeTruthy();
    expect(svg.querySelector('path')).toHaveAttribute('mask');
  });

  it('sizes to the given prop', () => {
    const { container } = render(<ByjanMark size={64} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '64');
    expect(svg).toHaveAttribute('height', '64');
  });

  it('dark theme flips ink and accent colours', () => {
    const light = render(<ByjanMark />);
    const dark = render(<ByjanMark theme="dark" />);
    const lStop = light.container.querySelector('linearGradient stop');
    const dStop = dark.container.querySelector('linearGradient stop');
    expect(lStop.getAttribute('stop-color') || lStop.getAttribute('stopColor')).toMatch(/#0f1c36/i);
    expect(dStop.getAttribute('stop-color') || dStop.getAttribute('stopColor')).toBe('#ffffff');
    // accent circle (first circle outside the <defs> mask)
    const lCircles = [...light.container.querySelectorAll('circle')].filter(c => !c.closest('defs'));
    const dCircles = [...dark.container.querySelectorAll('circle')].filter(c => !c.closest('defs'));
    expect(lCircles[1].getAttribute('fill')).toBe('#17b18c');
    expect(dCircles[1].getAttribute('fill')).toBe('#2fd3a8');
  });

  it('two instances use unique gradient ids', () => {
    const { container } = render(<><ByjanMark /><ByjanMark /></>);
    const grads = container.querySelectorAll('linearGradient');
    expect(grads[0].id).not.toBe(grads[1].id);
  });
});

describe('ByjanLoader', () => {
  it('renders the animated mark (SMIL dashoffset + pop circles)', () => {
    const { container } = render(<ByjanLoader size={72} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg).toHaveAttribute('role', 'img');
    // path carries the draw-on animation
    const path = svg.querySelector('path');
    expect(path.querySelector('animate[attributeName="stroke-dashoffset"]')).toBeTruthy();
    // pop animation on accent circle (visible circles, not mask holes)
    const circles = [...svg.querySelectorAll('circle')].filter(c => !c.closest('defs'));
    expect(circles.length).toBe(3);
    expect(svg.querySelectorAll('animate').length).toBeGreaterThanOrEqual(3);
  });

  it('dark theme uses light ink', () => {
    const { container } = render(<ByjanLoader theme="dark" />);
    expect(container.querySelector('linearGradient stop').getAttribute('stop-color')).toBe('#ffffff');
  });
});
