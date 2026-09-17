import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function TeacherDashboard() {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">ยินดีต้อนรับ, คุณครู</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            เลือกห้องเรียนจากเมนูด้านซ้ายเพื่อเริ่มต้น
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
