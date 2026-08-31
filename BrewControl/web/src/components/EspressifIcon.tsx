import type { LucideIcon } from 'lucide-preact';
import { SiEspressif } from 'react-icons/si';

// Adapts react-icons' SiEspressif (React-style `className` prop) to the
// lucide-preact call signature (`class`, Preact's JSX attribute) so it drops
// into the same icon slots as the lucide-preact icons (SettingsCard, Entry).
export const EspressifIcon: LucideIcon = ({ size, class: cls }) => (
  <SiEspressif size={size as number | string | undefined} className={cls as string | undefined} />
);
