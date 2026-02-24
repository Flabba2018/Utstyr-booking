// =============================================================================
// EmptyState: Vises når det ikke er data
// =============================================================================

import { Package } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  message: string;
  icon?: ReactNode;
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon || <Package size={48} strokeWidth={1} />}
      <p>{message}</p>
    </div>
  );
}
