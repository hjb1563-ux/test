import { STORAGE, normalizeProject, type LocalProject } from './bathroom-consultation';
import { builderBathroomSteps } from './bathroom-builder-options';
import { bathroomSteps as legacySteps } from './bathroom-options';
import { getVisibleSteps, nearestVisibleStep } from './bathroom-builder-mode';

export const ENTRY_SESSION = 'bath-designer-active-project-v1';
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
/** Read-only inspection; a failed read must never repair or remove the original. */
export function inspectProject() {
  const raw = localStorage.getItem(STORAGE);
  const input: unknown = raw === null ? {} : JSON.parse(raw);
  if (!record(input)) throw new Error('Invalid project');
  for (const key of ['values', 'projectInfo', 'checks']) {
    if (key in input && !record(input[key])) throw new Error('Invalid project field');
  }
  for (const key of ['memo', 'specialNotes']) {
    if (key in input && typeof input[key] !== 'string') throw new Error('Invalid text');
  }
  const maxStep = input.version === 3 ? builderBathroomSteps.length - 1 : legacySteps.length - 1;
  if ('current' in input && (typeof input.current !== 'number' || !Number.isInteger(input.current) || input.current < 0 || input.current > maxStep)) throw new Error('Invalid step');
  if ('imageHistoryOrder' in input && (!Array.isArray(input.imageHistoryOrder) || !input.imageHistoryOrder.every(x => typeof x === 'string'))) throw new Error('Invalid history');
  if (record(input.values) && Object.values(input.values).some(x => typeof x !== 'string' && !(Array.isArray(x) && x.every(v => typeof v === 'string')))) throw new Error('Invalid selections');
  const normalized = normalizeProject(input);
  const project = { ...input, ...normalized, projectInfo: { ...(record(input.projectInfo) ? input.projectInfo : {}), ...normalized.projectInfo } } as LocalProject;
  const meaningful = Object.values(project.values).some(x => Array.isArray(x) ? x.length > 0 : !!x.trim())
    || project.current > 0 || !!project.memo.trim() || !!project.specialNotes.trim()
    || Object.entries(project.projectInfo).some(([k, v]) => k !== 'builderMode' && v !== null && v !== '')
    || project.projectInfo.builderMode === 'professional' || Object.keys(project.checks).length > 0;
  const step = typeof input.current === 'number' ? nearestVisibleStep(project.current, project.projectInfo.builderMode, project.values) : null;
  const stepNumber = step === null ? null : getVisibleSteps(project.projectInfo.builderMode).findIndex(x => x.stepIndex === step) + 1;
  return { raw, project, meaningful, stepNumber, sourceStepCount: maxStep + 1 };
}
export function isActiveProject(raw: string | null) {
  try {
    const active = sessionStorage.getItem(ENTRY_SESSION);
    if (raw === null || active === null) return false;
    // Consultation edits update notes/checks without passing through Configurator.
    // The same project in this tab remains active across those updates.
    const identity = (value: string) => {
      const project = normalizeProject(JSON.parse(value));
      return JSON.stringify([project.projectInfo, project.values]);
    };
    return active === raw || identity(active) === identity(raw);
  } catch { return false; }
}
export function activateProject(raw: string | null) {
  try { if (raw === null) sessionStorage.removeItem(ENTRY_SESSION); else sessionStorage.setItem(ENTRY_SESSION, raw); } catch { /* The current page still works when session storage is unavailable. */ }
}
