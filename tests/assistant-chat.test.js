'use strict';

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';
process.env.OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5-chat-latest';
process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5';

const request = require('supertest');
const path = require('path');
const { app, pool, requestOpenAiUploadPrediction } = require('../server');

const originalFetch = global.fetch;

afterEach(() => {
    global.fetch = originalFetch;
});

afterAll(async () => {
    global.fetch = originalFetch;
    await pool.end();
});

describe('POST /api/assistant/chat', () => {
    it('400 when message is missing', async () => {
        const res = await request(app).post('/api/assistant/chat').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBeTruthy();
    });

    it('200 and returns assistant answer from OpenAI payload', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                model: 'gpt-5-chat-latest',
                output_text: 'Kiểm tra khẩu phần, nước uống và nhiệt độ chuồng trước.',
            }),
            headers: { get: () => 'req_test_123' },
        });

        const res = await request(app)
            .post('/api/assistant/chat')
            .send({
                message: 'Bò ăn kém thì nên kiểm tra gì?',
                history: [{ role: 'user', content: 'Xin chào' }],
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.answer).toContain('Kiểm tra khẩu phần');
        expect(res.body.data.model).toBe('gpt-5-chat-latest');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('retries once when OpenAI returns incomplete because max_output_tokens was exhausted', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    model: 'gpt-5-chat-latest',
                    status: 'incomplete',
                    incomplete_details: { reason: 'max_output_tokens' },
                    output: [],
                }),
                headers: { get: () => 'req_first' },
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    model: 'gpt-5-chat-latest',
                    output_text: 'Tăng khẩu phần nước và theo dõi thân nhiệt trong 24 giờ tới.',
                }),
                headers: { get: () => 'req_second' },
            });

        const res = await request(app)
            .post('/api/assistant/chat')
            .send({
                message: 'Bò có dấu hiệu mệt thì làm gì trước?',
                history: [{ role: 'assistant', content: 'Tôi có thể hỗ trợ chăn nuôi bò.' }],
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.answer).toContain('Tăng khẩu phần nước');
        expect(global.fetch).toHaveBeenCalledTimes(2);

        const firstRequestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
        const secondRequestBody = JSON.parse(global.fetch.mock.calls[1][1].body);

        expect(firstRequestBody.input).toEqual([
            { role: 'assistant', content: 'Tôi có thể hỗ trợ chăn nuôi bò.' },
            { role: 'user', content: 'Bò có dấu hiệu mệt thì làm gì trước?' },
        ]);
        expect(firstRequestBody.reasoning).toEqual({ effort: 'low' });
        expect(secondRequestBody.max_output_tokens).toBeGreaterThan(firstRequestBody.max_output_tokens);
    });
});

describe('requestOpenAiUploadPrediction', () => {
    it('retries when Tool Pro gets incomplete due to max_output_tokens', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    model: 'gpt-5',
                    status: 'incomplete',
                    incomplete_details: { reason: 'max_output_tokens' },
                    output: [],
                }),
                headers: { get: () => 'req_upload_first' },
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    model: 'gpt-5',
                    output_text: '{"behavior":"standing","confidence":0.91,"summary":"Bo dang dung yen."}',
                }),
                headers: { get: () => 'req_upload_second' },
            });

        const result = await requestOpenAiUploadPrediction({
            imagePath: path.join(__dirname, 'fixtures', 'test.jpg'),
            requestId: 'req_upload_test',
            imageMimeType: 'image/jpeg',
        });

        expect(result.predicted_behavior).toBe('standing');
        expect(result.provider).toBe('tool_pro');
        expect(result.confidence).toBeCloseTo(0.91);
        expect(global.fetch).toHaveBeenCalledTimes(2);

        const firstRequestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
        const secondRequestBody = JSON.parse(global.fetch.mock.calls[1][1].body);

        expect(firstRequestBody.reasoning).toEqual({ effort: 'low' });
        expect(secondRequestBody.max_output_tokens).toBeGreaterThan(firstRequestBody.max_output_tokens);
    });
});
