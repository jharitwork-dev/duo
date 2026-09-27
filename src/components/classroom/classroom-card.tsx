'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, FolderOpen } from 'lucide-react';

interface ClassroomCardProps {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  groupCount: number;
}

export function ClassroomCard({
  id,
  name,
  description,
  memberCount,
  groupCount,
}: ClassroomCardProps) {
  return (
    <Link href={`/teacher/classroom/${id}`}>
      <Card className="transition-colors hover:border-primary/50 hover:shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{name}</CardTitle>
        </CardHeader>
        <CardContent>
          {description && (
            <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
              {description}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1">
              <Users className="size-3" />
              {memberCount} คน
            </Badge>
            <Badge variant="outline" className="gap-1">
              <FolderOpen className="size-3" />
              {groupCount} กลุ่ม
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
