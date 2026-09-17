/**
 * Suggest book evolution when spend patterns emerge — confirmation required.
 */
import type { ExpenseRow } from './money-reports';
import { getPurposeTemplate, type PurposeId } from './purpose-templates';

export type EvolutionSuggestion = {
  id: string;
  title: string;
  detail: string;
  suggestedPurposeId: PurposeId;
  features: string[];
};

export function suggestBookEvolution(
  expenses: ExpenseRow[],
  currentPurposeId?: string,
): EvolutionSuggestion | null {
  const purpose = String(currentPurposeId || 'default');
  if (purpose !== 'default' && purpose !== 'other') return null;

  const outs = expenses.filter((e) => String(e.entryType || 'out') === 'out');
  if (outs.length < 8) return null;

  const hay = outs.map((e) => `${e.category} ${e.merchant} ${e.description}`).join(' ').toLowerCase();
  const fuel = (hay.match(/\bfuel\b|\bpetrol\b|\bdiesel\b|\bparking\b|\bhotel\b/g) || []).length;
  const construct = (hay.match(/\bcement\b|\blabour\b|\blabor\b|\bsteel\b|\bmaterial\b/g) || []).length;
  const vehicle = (hay.match(/\bservice\b|\binsurance\b|\btoll\b|\bgarage\b/g) || []).length;

  if (fuel >= 5) {
    const tpl = getPurposeTemplate('trip');
    return {
      id: 'evolve-trip',
      title: 'Make this Book smarter?',
      detail: 'Fuel, parking, or hotel spend keeps showing up.',
      suggestedPurposeId: 'trip',
      features: ['Fuel tracking', 'Parking tracking', 'Road-trip dashboard', ...tpl.quickActions.slice(0, 2).map(String)],
    };
  }
  if (construct >= 5) {
    return {
      id: 'evolve-construction',
      title: 'Make this Book smarter?',
      detail: 'Material and labour payments look like a construction project.',
      suggestedPurposeId: 'construction',
      features: ['Material', 'Labour', 'Payment tracking'],
    };
  }
  if (vehicle >= 5) {
    return {
      id: 'evolve-vehicle',
      title: 'Make this Book smarter?',
      detail: 'Service and vehicle costs keep repeating.',
      suggestedPurposeId: 'vehicle',
      features: ['Fuel', 'Service', 'Reminders'],
    };
  }
  return null;
}
