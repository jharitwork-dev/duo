'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ClassroomCardData {
  id: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  groupCount: number;
}

interface ClassroomCardsProps {
  classrooms: ClassroomCardData[];
}

export function ClassroomCards({ classrooms }: ClassroomCardsProps) {
  const router = useRouter();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {classrooms.map((classroom) => (
        <Card
          key={classroom.id}
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => router.push(`/student/classroom/${classroom.id}`)}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">{classroom.name}</CardTitle>
              {classroom.isArchived && (
                <Badge variant="secondary">Archived</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {classroom.description && (
              <p className="text-muted-foreground mb-2 text-sm">
                {classroom.description}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              {classroom.groupCount} กลุ่ม
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
