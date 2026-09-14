import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { expect } from 'chai';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { loginAsAdmin, loginAsAluno } from './helpers/authHelpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'flowCases.json'), 'utf8'));

let app;
let mongoServer;

describe('API de gestão escolar', function () {
  this.timeout(30000);

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    const appModule = await import('../src/app.js');
    app = appModule.default;
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('POST /api/auth/login', () => {
    for (const testCase of cases.loginCases) {
      it(testCase.name, async () => {
        const resposta = await request(app).post('/api/auth/login').send(testCase.payload);

        expect(resposta.status).to.equal(testCase.expectedStatus);

        if (testCase.expectedError) {
          expect(resposta.body.error).to.equal(testCase.expectedError);
          return;
        }

        expect(resposta.body).to.have.property('token');
        expect(resposta.body.usuario).to.have.property('role', testCase.expectedRole);
      });
    }
  });

  describe('Fluxo administrativo e do aluno', () => {
    it('deve fazer login como admin, cadastrar um aluno, logar como aluno e registrar entrega de trabalho', async () => {
      const adminToken = await loginAsAdmin(app, {
        email: 'admin@escola.com',
        senha: 'admin123',
      });

      const alunoCriado = await request(app)
        .post('/api/admin/alunos')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(cases.novoAluno);

      expect(alunoCriado.status).to.equal(201);
      expect(alunoCriado.body).to.include({
        nome: cases.novoAluno.nome,
        email: cases.novoAluno.email,
        matricula: cases.novoAluno.matricula,
      });

      const matricula = await request(app)
        .post(`/api/admin/disciplinas/${cases.novaEntrega.disciplinaId}/matriculas`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ alunoId: alunoCriado.body.id });

      expect(matricula.status).to.equal(201);

      const alunoToken = await loginAsAluno(app, {
        email: cases.novoAluno.email,
        senha: cases.novoAluno.senha,
      });

      const entrega = await request(app)
        .post(`/api/alunos/${alunoCriado.body.id}/trabalhos`)
        .set('Authorization', `Bearer ${alunoToken}`)
        .send(cases.novaEntrega);

      expect(entrega.status).to.equal(201);
      expect(entrega.body).to.include({
        alunoId: alunoCriado.body.id,
        disciplinaId: cases.novaEntrega.disciplinaId,
        titulo: cases.novaEntrega.titulo,
      });
      expect(entrega.body.status).to.equal('entregue');
    });
  });
});
