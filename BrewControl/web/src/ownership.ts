import type { Controller, ProgramConfig } from './types';
import { programIds } from './program';

// Who currently drives an actuator or controller, derived client-side since
// neither the actuator/controller record nor the wire format carries a
// back-reference to its owner (see ControllerParams.actuator/heatActuator/
// coolActuator and ProgramStep.targets — both point "down" at the id they
// drive, never the reverse). Mirrors the drivenBy logic in
// ProgramStepsEditor.tsx, kept separate here for reuse on the dashboard cards.

export function controllerOwnerOf(controllers: Controller[], id: string): Controller | undefined {
  return controllers.find((c) =>
    c.params?.actuator === id || c.params?.heatActuator === id || c.params?.coolActuator === id);
}

const ACTIVE_PROGRAM_STATUS = new Set(['running', 'awaiting', 'paused']);

export function programOwnerOf(programs: ProgramConfig[], id: string): ProgramConfig | undefined {
  return programs.find((p) => ACTIVE_PROGRAM_STATUS.has(p.status) && programIds(p.steps).includes(id));
}
