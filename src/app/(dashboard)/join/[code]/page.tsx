import { redirect } from 'next/navigation';
import { getCurrentUserId } from '@/lib/auth';
import { joinByCode } from '@/server/actions/classroom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Props {
  params: Promise<{ code: string }>;
}

export default async function JoinPage({ params }: Props) {
  // Ensure user is authenticated
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    // Not authenticated - redirect to sign-in, then back to join URL
    const { code } = await params;
    redirect(`/sign-in?redirect_url=/join/${code}`);
  }

  const { code } = await params;

  // Attempt to join
  let error: string | null = null;
  let classroomId: string | null = null;
  try {
    const result = await joinByCode({ code: code.toUpperCase() });
    classroomId = result.classroomId;
  } catch (e) {
    error = e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการเข้าร่วม';
  }

  // On success, go to the classroom page: it shows the group picker (self modes) or the waiting card.
  if (!error && classroomId) {
    redirect(`/student/classroom/${classroomId}`);
  }

  // On error, show error message with link back
  return (
    <div className="mx-auto max-w-md pt-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-xl text-destructive">
            ไม่สามารถเข้าร่วมได้
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button render={<Link href="/student" />}>
            กลับหน้าหลัก
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
