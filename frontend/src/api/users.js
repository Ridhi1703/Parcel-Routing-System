import client from './client'

export const listUsers = () => client.get('/admin/users')
export const createUser = (data) => client.post('/admin/users', data)
export const updateRole = (id, role) => client.patch(`/admin/users/${id}/role`, { role })
export const deleteUser = (id) => client.delete(`/admin/users/${id}`)
export const updateUser = (id, data) => client.patch(`/admin/users/${id}`, data)

export const getMe = () => client.get('/users/me')
export const updateMe = (data) => client.patch('/users/me', data)
