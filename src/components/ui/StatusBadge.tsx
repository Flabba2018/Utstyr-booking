// =============================================================================
// StatusBadge: Viser status med riktig farge
// =============================================================================

import type { StatusConfig } from '../../types';

interface StatusBadgeProps {
  config: StatusConfig;
}

export function StatusBadge({ config }: StatusBadgeProps) {
  return (
    <span
      className="badge"
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      {config.label}
    </span>
  );
}
