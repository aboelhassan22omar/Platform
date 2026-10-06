'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

interface Notice {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function NotificationsPanel() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ items: Notice[]; unread: number }>('/notifications'),
  });
  const readAll = useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}),
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }),
  });
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-gold-700 dark:text-gold-300">آخر التحديثات</p>
          <h1 className="font-display text-3xl font-black">الإشعارات</h1>
        </div>
        {Boolean(query.data?.unread) && (
          <Button variant="outline" onClick={() => readAll.mutate()}>
            تحديد الكل كمقروء
          </Button>
        )}
      </header>
      {query.isLoading ? (
        <p>جاري التحميل…</p>
      ) : query.data?.items.length ? (
        <ul className="space-y-3">
          {query.data.items.map((notice) => (
            <li
              key={notice.id}
              className={`rounded-2xl border p-4 ${notice.readAt ? 'border-midnight-100 opacity-75 dark:border-midnight-800' : 'border-gold-500/40 bg-gold-500/5'}`}
            >
              <div className="flex justify-between gap-4">
                <h2 className="font-black">{notice.title}</h2>
                <time className="shrink-0 text-xs text-midnight-400">
                  {formatDate(notice.createdAt)}
                </time>
              </div>
              <p className="mt-2 text-sm leading-7 text-midnight-600 dark:text-ivory-300">
                {notice.body}
              </p>
              {!notice.readAt && (
                <button
                  className="mt-2 text-xs font-black text-gold-700"
                  onClick={async () => {
                    await api.patch(`/notifications/${notice.id}/read`, {});
                    await client.invalidateQueries({ queryKey: ['notifications'] });
                  }}
                >
                  تمت القراءة
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-gold-500/30 p-10 text-center">
          لا توجد إشعارات حتى الآن.
        </div>
      )}
    </div>
  );
}
