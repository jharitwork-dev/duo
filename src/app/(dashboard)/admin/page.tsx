import { clerkClient } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminActions } from './admin-actions';

export default async function AdminDashboard() {
  await requireRole(ROLES.SUPERADMIN);

  const client = await clerkClient();
  const usersResponse = await client.users.getUserList({ limit: 100 });

  const pendingTeachers = usersResponse.data.filter(
    (user) => user.publicMetadata?.role === 'teacher_pending'
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">อนุมัติครู</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingTeachers.length === 0 ? (
            <p className="text-muted-foreground">ไม่มีครูที่รอการอนุมัติ</p>
          ) : (
            <div className="space-y-4">
              {pendingTeachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">
                      {teacher.firstName} {teacher.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {teacher.emailAddresses[0]?.emailAddress ?? 'ไม่มีอีเมล'}
                    </p>
                  </div>
                  <AdminActions teacherUserId={teacher.id} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
