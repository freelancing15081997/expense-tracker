import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Hx from './Hx.jsx';

describe('Hx interactive element', () => {
  it('renders the requested tag with children and base style', () => {
    const { container } = render(
      <Hx as="button" s="height:38px;background:#fff">Click</Hx>
    );
    const el = container.querySelector('button');
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent('Click');
    expect(el.style.height).toBe('38px');
    expect(el.style.background).toBe('rgb(255, 255, 255)');
  });

  it('applies hover styles on mouseenter and removes on mouseleave', () => {
    const { container } = render(
      <Hx as="div" s="background:#fff" h="background:#F4F6F8">x</Hx>
    );
    const el = container.firstChild;
    expect(el.style.background).toBe('rgb(255, 255, 255)');
    fireEvent.mouseEnter(el);
    expect(el.style.background).toBe('rgb(244, 246, 248)');
    fireEvent.mouseLeave(el);
    expect(el.style.background).toBe('rgb(255, 255, 255)');
  });

  it('applies active styles on mousedown and removes on mouseup', () => {
    const { container } = render(
      <Hx as="div" s="transform:none" a="transform:scale(.97)">x</Hx>
    );
    const el = container.firstChild;
    fireEvent.mouseDown(el);
    expect(el.style.transform).toBe('scale(.97)');
    fireEvent.mouseUp(el);
    expect(el.style.transform).toBe('none');
  });

  it('mouseleave clears both hover and active state', () => {
    const { container } = render(
      <Hx as="div" s="background:#fff" h="background:#eee" a="transform:scale(.9)">x</Hx>
    );
    const el = container.firstChild;
    fireEvent.mouseDown(el);
    fireEvent.mouseEnter(el);
    expect(el.style.transform).toBe('scale(.9)');
    fireEvent.mouseLeave(el);
    // base style has no transform → property is removed entirely
    expect(el.style.transform).toBe('');
    expect(el.style.background).toBe('rgb(255, 255, 255)');
  });

  it('forwards click and other props', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Hx as="span" s="cursor:pointer" onClick={onClick} title="hi" data-x="1">x</Hx>
    );
    const el = container.firstChild;
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(el).toHaveAttribute('title', 'hi');
    expect(el).toHaveAttribute('data-x', '1');
  });

  it('chains caller-provided mouse handlers', () => {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const { container } = render(
      <Hx as="div" s="color:red" onMouseEnter={onEnter} onMouseLeave={onLeave}>x</Hx>
    );
    const el = container.firstChild;
    fireEvent.mouseEnter(el);
    fireEvent.mouseLeave(el);
    expect(onEnter).toHaveBeenCalled();
    expect(onLeave).toHaveBeenCalled();
  });
});
