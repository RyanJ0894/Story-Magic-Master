import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ code: string }>;
}

// Redirect /share/[code] to /s/[code] for backward compatibility with email links
export default async function ShareRedirect({ params }: Props) {
  const { code } = await params;
  redirect(`/s/${code}`);
}
