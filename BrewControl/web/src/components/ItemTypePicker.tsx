import { ITEM_TYPES, ROLE_LABEL, type ItemTypeEntry, type Role } from '../itemTypes';
import { Segmented } from './Segmented';
import { SettingsGroup } from './SettingsCard';
import { btnSecondary, dialogFrame, dialogFooter, dialogBtnRow } from '../ui';

// Step 1 of the add dialog: pick role + type. Kept as its own dialog so
// AddItemModal only renders the fields of the type that was chosen here.

const ROLES: { value: Role; label: string }[] =
  (['sensor', 'actuator', 'controller'] as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }));

// Compact row — a full card per type would be as crowded as the dropdown it
// replaces, so this is the card style at list density.
const typeRow =
  'block w-full rounded-md border border-card-border bg-card px-3 py-2 text-left transition-colors ' +
  'hover:bg-subtle-hover active:bg-subtle-pressed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function ItemTypePicker({ role, onRole, onPick, onClose }: {
  role: Role;
  onRole: (r: Role) => void;
  onPick: (e: ItemTypeEntry) => void;
  onClose: () => void;
}) {
  // Group in array order so the ordering of the old dropdowns is preserved.
  const groups = new Map<string, ItemTypeEntry[]>();
  for (const e of ITEM_TYPES) {
    if (e.role !== role) continue;
    const list = groups.get(e.group) ?? [];
    list.push(e);
    groups.set(e.group, list);
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-md ${dialogFrame}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 space-y-4 overflow-y-auto p-5">
          <h2 class="text-base font-medium text-fg">Gerät hinzufügen</h2>

          <Segmented value={role} options={ROLES} onChange={onRole} />

          <div class="space-y-4">
            {[...groups.entries()].map(([group, list]) => (
              <SettingsGroup key={group} title={group}>
                {list.map((e) => (
                  <button key={e.type} type="button" class={typeRow} onClick={() => onPick(e)}>
                    <div class="text-sm font-medium text-fg">{e.label}</div>
                    <div class="text-xs text-muted">{e.hint}</div>
                  </button>
                ))}
              </SettingsGroup>
            ))}
          </div>
        </div>

        <div class={dialogFooter}>
          <div class={dialogBtnRow}>
            <button type="button" onClick={onClose} class={btnSecondary}>Abbrechen</button>
          </div>
        </div>
      </div>
    </div>
  );
}
