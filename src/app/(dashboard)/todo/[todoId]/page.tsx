import { redirect } from 'next/navigation';
import { getCurrentUserId, getCurrentRole } from '@/lib/auth';
import { getTodoDetail } from '@/server/queries/todo';
import { TodoDetail } from '@/components/todo/todo-detail';
import { TodoAttachmentsList } from '@/components/todo/todo-attachments-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface Props {
  params: Promise<{ todoId: string }>;
}

export default async function TodoDetailPage({ params }: Props) {
  const userId = await getCurrentUserId();
  const role = await getCurrentRole();
  const { todoId } = await params;

  const todo = await getTodoDetail(todoId, userId);
  if (!todo) {
    redirect('/student');
  }

  const isTeacher = role === 'teacher' || role === 'superadmin';
  const phase = todo.phase;
  const group = phase.group;
  const classroom = group.classroom;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <nav className="text-muted-foreground flex items-center gap-1 text-sm">
        <span>{classroom.name}</span>
        <ChevronRight className="h-3 w-3" />
        <span>{group.name}</span>
        <ChevronRight className="h-3 w-3" />
        <span>{phase.name}</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{todo.title}</span>
      </nav>

      {/* Title + badges */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{todo.title}</h1>
          <div className="flex gap-2">
            <Badge variant="outline">
              {todo.submissionMode === 'individual' ? 'รายบุคคล' : 'กลุ่ม'}
            </Badge>
            {todo.deadline && (
              <Badge variant="secondary">
                กำหนดส่ง:{' '}
                {new Date(todo.deadline).toLocaleDateString('th-TH')}
              </Badge>
            )}
          </div>
        </div>
        {isTeacher && (
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/teacher/classrooms/${classroom.id}/group/${group.id}`}
            >
              แก้ไข
            </Link>
          </Button>
        )}
      </div>

      <Separator />

      {/* Section 1: Teacher notes */}
      <TodoDetail notes={todo.notes} description={todo.description} />

      {/* Section 2: Downloadable attachments */}
      {todo.attachments && todo.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ไฟล์แนบ</CardTitle>
          </CardHeader>
          <CardContent>
            <TodoAttachmentsList attachments={todo.attachments} />
          </CardContent>
        </Card>
      )}

      {/* Section 3: Submission placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ส่งงาน</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            การส่งงานจะเปิดให้ใน Phase ถัดไป
          </p>
        </CardContent>
      </Card>

      {/* Section 4: Past submissions placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">งานที่ส่งแล้ว</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">ยังไม่มีงานที่ส่ง</p>
        </CardContent>
      </Card>
    </div>
  );
}
