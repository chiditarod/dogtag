import { useParams } from 'react-router-dom';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';

export function ResetPasswordRoute() {
  const { token = '' } = useParams();
  return <ResetPasswordForm token={token} />;
}
