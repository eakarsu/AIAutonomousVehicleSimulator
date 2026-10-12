import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import AIWorkspace from './AIWorkspace';
import '@testing-library/jest-dom';
import AIReport from './AIReport';

const structured = {
  summary: { safe: false, collisions: 0, note: '' },
  findings: [{ scenario: 'Urban merge', count: 0 }, { scenario: 'Rain', count: 2 }],
  actions: ['Review radar logs', 'Repeat the run'],
};

test.each([
  ['returned', { parsed: structured, content: JSON.stringify(structured), model: 'fixture' }],
  ['saved detail', { id: 17, parsed: structured, content: JSON.stringify(structured), model: 'fixture' }],
])('%s structured response renders labeled facts, table, and list without losing falsy values', (_surface, response) => {
  const { container } = render(<AIReport response={response} title="Safety report" />);
  expect(screen.getByRole('heading', { name: 'Summary' })).toBeInTheDocument();
  expect(screen.getByText('No')).toBeInTheDocument();
  expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  expect([...container.querySelectorAll('dd')].some((element) => element.textContent === '')).toBe(true);
  const table = screen.getByRole('table');
  expect(within(table).getByText('Urban merge')).toBeInTheDocument();
  expect(screen.getByText('Review radar logs')).toBeInTheDocument();
  expect(container.querySelector('pre')).toBeNull();
});


test('saved history opens a structured report detail without invoking generation', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = jest.fn(async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method || 'GET' });
    return { ok: true, json: async () => ({ items: [{ id: 17, input: { goal: 'Review safety' }, output: structured, created_at: '2026-10-11T00:00:00Z', model: 'fixture' }] }) };
  });
  try {
    render(<AIWorkspace feature={{ id: 'fixture', title: 'Fixture workspace', description: 'Local test', samples: [] }} token="fixture-token" />);
    const row = await screen.findByRole('button', { name: /Review safety/ });
    fireEvent.click(row);
    expect(screen.getByRole('heading', { name: 'Summary' })).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
  } finally { global.fetch = originalFetch; }
});
