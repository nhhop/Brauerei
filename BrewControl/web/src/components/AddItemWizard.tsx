import type { ComponentChildren } from 'preact';
import { Check, X, type LucideIcon } from 'lucide-preact';
import { btnPrimary, btnSecondary, dialogFooter } from '../ui';

// Chrome for the multi-step "Gerät hinzufügen" flow: scrim, responsive panel,
// the desktop step rail, the mobile header + segment bar, and the footer.
// Knows nothing about item types — the step bodies come in as children.
//
// Responsive without JS: the DOM order is [rail, mobile header, pane], so
// `hidden md:flex` on the rail and `md:hidden` on the header give the right
// order in both layouts with no `order-*` utilities. Mobile is a full-bleed
// sheet, desktop a centred 880×640 panel.

export interface WizardStep {
  label: string;
  value: string;   // the choice made in that step, shown under the rail label
}

export function AddItemWizard({
  steps, step, maxStep, onStep, title, subtitle,
  onCancel, onBack, backDisabled, next, onNext, children,
}: {
  steps: WizardStep[];
  step: number;
  maxStep: number;
  onStep: (s: number) => void;
  title: string;
  subtitle: string;
  // Omitted on the success screen — there is nothing left to cancel or go back to.
  onCancel?: () => void;
  onBack?: () => void;
  backDisabled?: boolean;
  next: { label: string; disabled?: boolean; submit?: boolean };
  onNext?: () => void;
  children: ComponentChildren;
}) {
  return (
    <div
      class="fixed inset-0 z-50 flex md:items-center md:justify-center md:bg-black/40 md:p-4"
      onClick={() => onCancel?.()}
    >
      {/* Not `dialogFrame`: that hard-codes the radius and elevation, which we
          only want from md up. */}
      <div
        class="flex h-full w-full flex-col overflow-hidden bg-surface
               pt-[var(--safe-t)] pb-[var(--safe-b)] pl-[var(--safe-l)] pr-[var(--safe-r)]
               md:h-[640px] md:max-h-[90vh] md:w-[880px] md:max-w-full md:rounded-lg
               md:p-0 md:shadow-elev-64"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Desktop step rail */}
          <nav aria-label="Schritte"
            class="hidden w-60 shrink-0 flex-col border-r border-border bg-bg/60 px-4 py-6 md:flex">
            <h2 class="mb-4 px-2 text-base font-medium text-fg">Gerät hinzufügen</h2>
            <ol class="space-y-0.5">
              {steps.map((s, i) => {
                const n = i + 1;
                const done = n < step;
                const active = n === step;
                return (
                  <li key={s.label}>
                    <button type="button" disabled={n > maxStep}
                      onClick={() => onStep(n)}
                      class={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                        active ? 'bg-accent/10 text-fg'
                        : n > maxStep ? 'text-faint'
                        : 'text-muted hover:bg-subtle-hover active:bg-subtle-pressed'
                      }`}>
                      <span class={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                        done || active ? 'bg-accent text-accent-fg' : 'bg-fg/10 text-muted'
                      }`}>
                        {done ? <Check size={14} /> : n}
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block">{s.label}</span>
                        {s.value && (
                          <span class="block truncate text-xs font-normal text-faint">{s.value}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Mobile header + progress */}
          <div class="shrink-0 md:hidden">
            <div class="flex h-14 items-center gap-1 px-2">
              {onCancel && (
                <button type="button" onClick={onCancel} title="Abbrechen"
                  class="flex size-11 items-center justify-center rounded-md text-faint transition-colors hover:bg-subtle-hover hover:text-fg">
                  <X size={20} />
                </button>
              )}
              <h1 class="text-base font-medium text-fg">Gerät hinzufügen</h1>
            </div>
            <div class="flex gap-1 px-5">
              {steps.map((s, i) => (
                <span key={s.label}
                  class={`h-1 flex-1 rounded-full ${i + 1 <= step ? 'bg-accent' : 'bg-fg/10'}`} />
              ))}
            </div>
            <div class="flex items-baseline justify-between gap-3 px-5 pt-2 text-xs text-muted">
              <span>Schritt {Math.min(step, steps.length)} von {steps.length}</span>
              <span class="truncate">{steps[Math.min(step, steps.length) - 1]?.label}</span>
            </div>
          </div>

          {/* Content pane */}
          <div class="flex min-h-0 min-w-0 flex-1 flex-col px-5 pt-4 md:px-8 md:pt-6">
            <h3 class="text-base font-medium text-fg">{title}</h3>
            <p class="mt-1 text-sm text-muted">{subtitle}</p>
            <div class="mt-4 min-h-0 flex-1 overflow-y-auto pb-5">{children}</div>
          </div>
        </div>

        <div class={`${dialogFooter} justify-between pb-6 md:pb-4`}>
          {onCancel && (
            <button type="button" onClick={onCancel} class={`${btnSecondary} hidden md:inline-flex`}>
              Abbrechen
            </button>
          )}
          <div class="flex w-full gap-2 md:w-auto">
            {onBack && (
              <button type="button" onClick={onBack} disabled={backDisabled}
                class={`${btnSecondary} flex-1 justify-center py-3 md:min-w-24 md:flex-none md:py-1.5`}>
                Zurück
              </button>
            )}
            <button type={next.submit ? 'submit' : 'button'}
              onClick={next.submit ? undefined : onNext}
              disabled={next.disabled}
              class={`${btnPrimary} justify-center py-3 md:min-w-30 md:flex-none md:py-1.5 ${
                onBack ? 'flex-[2]' : 'flex-1'
              }`}>
              {next.label}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// One selectable card. Steps 1 and 2 stack icon over text on desktop; step 3
// stays a row at every width (`row`). Mobile is always a row.
export function ChoiceCard({ icon: Icon, label, desc, selected, row, disabled, onPick }: {
  icon: LucideIcon;
  label: string;
  desc?: string;
  selected: boolean;
  row?: boolean;
  disabled?: boolean;
  onPick: () => void;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onPick} disabled={disabled}
      class={`relative flex w-full items-center gap-3 rounded-md border px-3 py-3 pr-9 text-left transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 ${
        row ? '' : 'md:flex-col md:items-start md:gap-0 md:px-4 md:py-4'
      } ${
        selected
          ? 'border-accent bg-accent/10'
          : 'border-card-border bg-card hover:bg-subtle-hover active:bg-subtle-pressed'
      }`}>
      <span class={`flex size-9 shrink-0 items-center justify-center rounded-md ${
        selected ? 'bg-accent/15 text-accent' : 'bg-fg/5 text-muted'
      }`}>
        <Icon size={22} />
      </span>
      <span class={`min-w-0 flex-1 ${row ? '' : 'md:mt-3 md:flex-none'}`}>
        <span class="block text-sm font-medium text-fg">{label}</span>
        {desc && <span class="mt-0.5 block text-xs text-muted">{desc}</span>}
      </span>
      <span class={`absolute right-3 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full border-2 ${
        row ? '' : 'md:top-4 md:translate-y-0'
      } ${selected ? 'border-accent' : 'border-border'}`}>
        {selected && <span class="size-2 rounded-full bg-accent" />}
      </span>
    </button>
  );
}
