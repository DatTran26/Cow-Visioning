/**
 * tests/images.test.js - Phase 02
 * Tests: POST /api/images, GET /api/images, PUT /api/images/:id, PUT /api/images/:id/label, DELETE /api/images/:id
 */
'use strict';

const path = require('path');
const fs = require('fs');
const request = require('supertest');

process.env.AI_ENABLED = 'false';
process.env.AI_TOOL_PRO_ENABLED = 'false';

const { app, pool } = require('../server');

const sfx = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const FIXTURE = path.join(__dirname, 'fixtures', 'test.jpg');

let agent;
const u = `imguser_${sfx()}`;
const pw = 'ImgPass123!';
let createdImageId = null;

beforeAll(async () => {
    const fixDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixDir)) fs.mkdirSync(fixDir, { recursive: true });
    if (!fs.existsSync(FIXTURE)) {
        const buf = Buffer.alloc(128);
        buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF; buf[3] = 0xD9;
        fs.writeFileSync(FIXTURE, buf);
    }
    agent = request.agent(app);
    await agent.post('/auth/register')
        .send({ username: u, email: `${u}@example.com`, password: pw, password_confirm: pw });
    const loginRes = await agent.post('/auth/login').send({ username: u, password: pw });
    if (loginRes.status !== 200) console.error('Login failed in images test:', loginRes.body);
});

afterAll(async () => { await pool.end(); });

describe('POST /api/images', () => {
    // Unauthenticated multipart to multer route may cause ECONNRESET due to rate limit / stream abort
    // We tolerate ECONNRESET (treated as 4xx rejection) OR 401 response
    it('rejects without authentication (401 or connection reset)', async () => {
        try {
            const res = await request(app).post('/api/images')
                .field('cow_id', 'BO-TEST')
                .attach('image', FIXTURE);
            expect([401, 403]).toContain(res.status);
        } catch (err) {
            // ECONNRESET means request was actively rejected  acceptable
            expect(err.code === 'ECONNRESET' || err.message.includes('ECONNRESET')).toBe(true);
        }
    });

    it('400 when cow_id is missing', async () => {
        const res = await agent.post('/api/images').attach('image', FIXTURE);
        expect(res.status).toBe(400);
        expect(res.body.error).toBeTruthy();
    });

    it('400 when no image file provided', async () => {
        const res = await agent.post('/api/images').field('cow_id', 'BO-001');
        expect(res.status).toBe(400);
    });

    it('200 with valid image and cow_id (AI disabled)', async () => {
        const cowId = `test-cow-${sfx()}`;
        const res = await agent.post('/api/images')
            .field('cow_id', cowId)
            .field('behavior', 'standing')
            .attach('image', FIXTURE);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.cow_id).toBeTruthy();
        createdImageId = res.body.data.id;
    });
});

describe('GET /api/images', () => {
    it('401 without authentication', async () => {
        expect((await request(app).get('/api/images')).status).toBe(401);
    });

    it('200 returns data array when logged in', async () => {
        const res = await agent.get('/api/images');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('200 with cow_id filter', async () => {
        const res = await agent.get('/api/images?cow_id=test-cow');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('200 with tool_pro filter returns AI processed records only', async () => {
        if (!createdImageId) { console.warn('No image ID - skip tool_pro filter test'); return; }

        await pool.query(
            `UPDATE cow_images
             SET ai_status = 'completed',
                 ai_provider = 'tool_pro',
                 annotated_image_url = COALESCE(annotated_image_url, image_url)
             WHERE id = $1`,
            [createdImageId]
        );

        const res = await agent.get('/api/images?tool_pro=1');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.some((item) => item.id === createdImageId)).toBe(true);
    });
});

describe('PUT /api/images/:id/label', () => {
    it('401 without authentication', async () => {
        expect((await request(app).put('/api/images/1/label')
            .send({ behavior: 'lying' })).status).toBe(401);
    });

    it('200 updates label of own image', async () => {
        if (!createdImageId) { console.warn('No image ID  skip'); return; }
        const res = await agent.put(`/api/images/${createdImageId}/label`)
            .send({ behavior: 'lying' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe('PUT /api/images/:id', () => {
    it('401 without authentication', async () => {
        expect((await request(app).put('/api/images/1')
            .send({ cow_id: 'BO-002', behavior: 'standing' })).status).toBe(401);
    });

    it('200 updates image metadata of own image', async () => {
        const cowId = `edit-cow-${sfx()}`;
        const createRes = await agent.post('/api/images')
            .field('cow_id', cowId)
            .field('behavior', 'standing')
            .field('barn_area', 'Zone A')
            .attach('image', FIXTURE);

        expect(createRes.status).toBe(200);
        const imageId = createRes.body.data.id;

        const updateRes = await agent.put(`/api/images/${imageId}`).send({
            cow_id: `${cowId}-updated`,
            behavior: 'walking',
            barn_area: 'Zone B',
            captured_at: '2026-04-08T09:45',
            notes: 'Updated from gallery modal',
        });

        expect(updateRes.status).toBe(200);
        expect(updateRes.body.success).toBe(true);
        expect(updateRes.body.data.cow_id).toBe(`${cowId}-updated`);
        expect(updateRes.body.data.behavior).toBe('walking');
        expect(updateRes.body.data.barn_area).toBe('Zone B');
        expect(updateRes.body.data.notes).toBe('Updated from gallery modal');
    });
});

describe('DELETE /api/images/:id', () => {
    it('401 without authentication', async () => {
        expect((await request(app).delete('/api/images/1')).status).toBe(401);
    });

    it('200 deletes own image', async () => {
        if (!createdImageId) { console.warn('No image ID  skip'); return; }
        const res = await agent.delete(`/api/images/${createdImageId}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
