import { redirect } from 'next/navigation';

export default function HomePage() {
  // Immediately redirect to dashboard
  // The middleware will handle authentication
  redirect('/dashboard');
}
