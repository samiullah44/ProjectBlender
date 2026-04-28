import React from 'react';

type Status = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';

interface StatusBadgeProps {
  status: Status;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  DRAFT: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-600',
  },
  IN_REVIEW: {
    label: 'In Review',
    className: 'bg-amber-100 text-amber-700',
  },
  PUBLISHED: {
    label: 'Published',
    className: 'bg-green-100 text-green-700',
  },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { label, className } = statusConfig[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
};

export default StatusBadge;
