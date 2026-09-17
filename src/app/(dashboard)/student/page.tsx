import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function StudentDashboard() {
  await requireRole(ROLES.STUDENT);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">ยินดีต้อนรับ</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            เลือกห้องเรียนจากเมนูด้านซ้ายเพื่อดูโปรเจกต์ของคุณ
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
