import client from './client'

export const submitParcel = (data) => client.post('/parcels', data)

export const listParcels = (params) => client.get('/parcels', { params })

export const getParcel = (id) => client.get(`/parcels/${id}`)

export const uploadBatch = (formData) =>
  client.post('/parcels/batch', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const requeueStuck = () => client.post('/parcels/requeue')
