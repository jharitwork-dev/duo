import RegisterForm from '@/register/components/RegisterForm';

export const metadata = {
  title: 'ลงทะเบียนล่วงหน้า | Innovator\'s',
  description: 'ลงทะเบียนล่วงหน้าเข้าร่วมโครงการ Innovator\'s Academy',
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-start justify-center bg-gray-100 px-4 py-8 sm:py-12">
      <div className="w-full max-w-xl">
        <RegisterForm />
      </div>
    </main>
  );
}
