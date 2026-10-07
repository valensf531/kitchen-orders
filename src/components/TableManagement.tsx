'use client';

import { ZoneType } from '@/types/table';
import { FloorPlan } from './FloorPlan';

interface TableManagementProps {
  zone: ZoneType;
  zoneName?: string;
}

export function TableManagement({ zone, zoneName }: TableManagementProps) {
  return <FloorPlan zone={zone} zoneName={zoneName} />;
}