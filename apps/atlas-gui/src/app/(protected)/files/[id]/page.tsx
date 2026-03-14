'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function FileRedirect() {
  const { id } = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/files?docId=${id}`);
  }, [id, router]);

  return null;
}
