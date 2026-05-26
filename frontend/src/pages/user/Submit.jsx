import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { submitParcel } from '../../api/parcels'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { CheckCircle2, Plus, X } from 'lucide-react'

const schema = z.object({
  weight_kg: z.coerce.number().positive('Weight must be greater than 0'),
  value_eur: z.coerce.number().min(0, 'Value must be 0 or more'),
  destination_country: z.string().length(2, 'Must be a 2-letter ISO code (e.g. IN)').toUpperCase(),
  attributes: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
})

const card = {
  background: 'var(--bg-card)', borderRadius: '12px',
  border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  padding: '28px',
}

export default function Submit() {
  const [result, setResult] = useState(null)
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { destination_country: 'IN', attributes: [] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'attributes' })

  const mutation = useMutation({
    mutationFn: (data) => {
      const attrs = {}
      for (const { key, value } of data.attributes || []) {
        if (key) attrs[key] = value
      }
      return submitParcel({ weight_kg: data.weight_kg, value_eur: data.value_eur, destination_country: data.destination_country, attributes: attrs })
    },
    onSuccess: (res) => { setResult(res.data.parcel_id); reset() },
  })

  return (
    <div style={{ maxWidth: '540px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '6px' }}>Submit Parcel</h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Fill in the parcel details below to route it automatically.</p>
      </div>

      {result && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '10px',
          padding: '14px 18px', marginBottom: '24px',
        }}>
          <CheckCircle2 size={20} color="#047857" />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#065f46' }}>Parcel created successfully</div>
            <div style={{ fontSize: '13px', color: '#047857', fontFamily: 'monospace', marginTop: '2px' }}>{result}</div>
          </div>
        </div>
      )}

      {mutation.isError && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '14px', color: '#dc2626' }}>
          {mutation.error?.response?.data?.detail || 'Submission failed. Please try again.'}
        </div>
      )}

      <div style={card}>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input label="Weight (kg)" type="number" step="0.001" min="0.001" placeholder="e.g. 2.500" {...register('weight_kg')} error={errors.weight_kg?.message} />
            <Input label="Value (₹)" type="number" step="1" min="0" placeholder="e.g. 1499" {...register('value_eur')} error={errors.value_eur?.message} />
          </div>
          <Input
            label="Destination Country (ISO 3166-1)"
            placeholder="IN"
            maxLength={2}
            {...register('destination_country')}
            error={errors.destination_country?.message}
          />

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-body)' }}>
                Custom Attributes <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <button
                type="button"
                onClick={() => append({ key: '', value: '' })}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '13px', color: 'var(--primary)', background: 'none',
                  border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0,
                }}
              >
                <Plus size={14} /> Add
              </button>
            </div>
            {fields.map((field, i) => (
              <div key={field.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start' }}>
                <Input placeholder="key" {...register(`attributes.${i}.key`)} />
                <Input placeholder="value" {...register(`attributes.${i}.value`)} />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  style={{
                    marginTop: '1px', padding: '8px', borderRadius: '8px',
                    border: '1.5px solid var(--border)', background: 'var(--bg-card)',
                    color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0,
                    transition: 'color 150ms, border-color 150ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fca5a5' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <Button type="submit" size="lg" disabled={mutation.isPending} style={{ width: '100%', justifyContent: 'center' }}>
            {mutation.isPending ? 'Submitting…' : 'Submit Parcel'}
          </Button>
        </form>
      </div>
    </div>
  )
}
