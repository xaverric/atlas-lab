'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NoteRedirect() {
  const { id } = useParams();
  const router = useRouter();
  useEffect(() => { router.replace(`/notes?noteId=${id}`); }, [id, router]);
  return null;
}
