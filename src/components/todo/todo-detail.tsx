'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TodoDetailProps {
  notes: string | null;
  description: string | null;
}

export function TodoDetail({ notes, description }: TodoDetailProps) {
  const hasContent = notes || description;

  if (!hasContent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">โน้ตจากครู</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">ยังไม่มีโน้ต</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">โน้ตจากครู</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
        {notes && (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
            {notes}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
