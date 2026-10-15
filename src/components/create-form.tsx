'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { issueSchema, categories, type IssueInput } from '@/lib/schemas';
import { api } from '@/lib/api';
import { z } from 'zod';
export function CreateForm({ point, onDone }: { point: [number, number]; onDone: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<IssueInput>({ resolver: zodResolver(issueSchema), defaultValues: { lat: point[0], lng: point[1], category: 'POWER', city: 'Алматы', region: '', address: '' } });
  const submit = handleSubmit(async data => { try { await api('/api/issues', z.object({ id: z.string() }), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); onDone(); } catch (error) { setError('root', { message: error instanceof Error ? error.message : 'Не удалось отправить' }); } });
  return <form onSubmit={submit} className="form"><p className="muted">Точка на карте: {point[0].toFixed(5)}, {point[1].toFixed(5)}</p><label>Что произошло?<input {...register('title')} placeholder="Например, нет электричества в доме" /></label><label>Категория<select {...register('category')}>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Описание<textarea {...register('description')} rows={4} placeholder="Когда началось и какие дома затронуты?" /></label><div className="form-grid"><label>Город<input {...register('city')} /></label><label>Регион<input {...register('region')} /></label></div><label>Адрес<input {...register('address')} placeholder="Улица и номер дома" /></label>{Object.entries(errors).map(([key, error]) => <p role="alert" className="form-error" key={key}>{error.message}</p>)}<button className="primary" disabled={isSubmitting}>{isSubmitting ? 'Публикуем…' : 'Опубликовать проблему'}</button><p className="fine-print">Не указывайте номера квартир, телефоны и персональные данные других людей.</p></form>;
}
