import request from 'supertest';

export async function loginAsAdmin(app, credentials) {
  const response = await request(app).post('/api/auth/login').send(credentials);

  if (response.status !== 200) {
    throw new Error(`Falha ao autenticar admin: ${response.status} ${response.body?.error || ''}`);
  }

  return response.body.token;
}

export async function loginAsAluno(app, credentials) {
  const response = await request(app).post('/api/auth/login').send(credentials);

  if (response.status !== 200) {
    throw new Error(`Falha ao autenticar aluno: ${response.status} ${response.body?.error || ''}`);
  }

  return response.body.token;
}
