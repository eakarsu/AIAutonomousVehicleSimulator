import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AIScenarioSafetyPage from './AIScenarioSafetyPage';
import { aiExtended } from '../services/api';

jest.mock('../services/api', () => ({ aiExtended: {
  scenarioGenerate: jest.fn(), safetyAssessment: jest.fn(),
} }));
const response = { generated: { parsed: { summary: { safe: false, collisions: 0 }, scenarios: [{ name: 'Urban merge' }] } } };
const mount = () => render(<MemoryRouter><AIScenarioSafetyPage onLogout={() => {}} /></MemoryRouter>);

test('generation preset supplies all fields and submits the backend contract', async () => {
  aiExtended.scenarioGenerate.mockResolvedValue({ data: response });
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Fill Urban example' }));
  expect(aiExtended.scenarioGenerate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Generate Scenarios' }));
  await waitFor(() => expect(aiExtended.scenarioGenerate).toHaveBeenCalledWith(expect.objectContaining({
    domain: expect.stringContaining('urban'), difficulty: 'hard', count: 8,
    constraints: expect.objectContaining({ seed_description: expect.stringContaining('cyclist') }),
  })));
  expect(await screen.findByText('Urban merge')).toBeInTheDocument();
});

test('safety preset submits a nonempty failure_events array and renders structured output', async () => {
  aiExtended.safetyAssessment.mockResolvedValue({ data: { safety_assessment: { parsed: { summary: { safe: false, collisions: 0 }, findings: [{ mode: 'Occlusion' }] } } } });
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Safety Assessment' }));
  fireEvent.click(screen.getByRole('button', { name: 'Fill Suburban example' }));
  expect(aiExtended.safetyAssessment).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Run Safety Assessment' }));
  await waitFor(() => expect(aiExtended.safetyAssessment).toHaveBeenCalledWith(expect.objectContaining({
    sae_level: 3, vehicle_context: expect.objectContaining({ odd: expect.stringContaining('urban') }),
    failure_events: expect.arrayContaining([expect.objectContaining({ description: expect.stringContaining('occlusion') })]),
  })));
  expect(await screen.findByText('Occlusion')).toBeInTheDocument();
});
