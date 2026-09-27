'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Users, UserPlus } from 'lucide-react';
import { AssignStudentDialog } from '@/components/group/assign-student-dialog';

interface ClassroomMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: Date | null;
}

interface GroupCardProps {
  id: string;
  name: string;
  memberCount: number;
  maxGroupSize: number | null;
  classroomId: string;
  classroomMembers: ClassroomMember[];
}

export function GroupCard({
  id,
  name,
  memberCount,
  maxGroupSize,
  classroomId,
  classroomMembers,
}: GroupCardProps) {
  const capacityText = maxGroupSize
    ? `${memberCount}/${maxGroupSize}`
    : `${memberCount}`;

  return (
    <Card className="transition-colors hover:border-primary/50 hover:shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Link href={`/teacher/classroom/${classroomId}/group/${id}`}>
            <CardTitle className="text-base hover:underline">{name}</CardTitle>
          </Link>
          <Badge variant="secondary" className="gap-1">
            <Users className="size-3" />
            {capacityText} คน
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex -space-x-2">
            {Array.from({ length: Math.min(memberCount, 5) }).map((_, i) => (
              <Avatar key={i} className="size-7 border-2 border-background">
                <AvatarFallback className="text-xs">
                  {i + 1}
                </AvatarFallback>
              </Avatar>
            ))}
            {memberCount > 5 && (
              <Avatar className="size-7 border-2 border-background">
                <AvatarFallback className="text-xs">
                  +{memberCount - 5}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          <AssignStudentDialog
            groupId={id}
            classroomMembers={classroomMembers}
          />
        </div>
      </CardContent>
    </Card>
  );
}
