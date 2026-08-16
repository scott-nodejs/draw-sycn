# Paper processing pipeline

The Java backend now owns the complete asynchronous path from uploaded PDF/images to teacher-reviewable questions.

## Runtime configuration

Set `DEEPSEEK_API_KEY` and `PADDLEOCR_API_TOKEN` in the Java server process environment. PaddleOCR/PP is the default OCR provider (`OCR_PROVIDER=paddleocr`); MinerU remains an optional fallback. Never prefix server secrets with `VITE_`; Vite variables are bundled into browser code. Optional overrides are documented in `.env.example`.

Apply these migrations before starting the worker:

- `V003__learning_product_preview_policy.sql`
- `V004__accounts_and_teacher_profiles.sql`
- `V005__paper_processing_pipeline.sql`

## Pipeline

1. `POST /api/papers` accepts one PDF or up to 30 ordered JPG/PNG/WEBP images.
2. The backend stores immutable source files and `source-manifest.json`, then renders PDFs at 180 DPI or normalizes uploaded images into ordered PNG pages.
3. The scheduled worker requests MinerU v4 signed upload URLs, uploads every original source, and persists the returned batch id.
4. The worker polls MinerU. Completed ZIP results, combined Markdown and `content_list.json` layout blocks are stored beside the paper source.
5. DeepSeek receives OCR text plus normalized 0–1000 layout coordinates with JSON output enabled. Every question must return one or more `sourceRegions`.
6. The backend validates unique question numbers, supported types, non-empty stems and source regions, then generates PNG question crops from normalized pages.
7. Question insertion, crop metadata and the initial AI revision run in one database transaction.
8. The paper moves to `review`; the authenticated crop endpoint lets the teacher compare the original question image, and only teacher confirmation changes it to `confirmed`.

## State and recovery

`GET /api/papers/{paperId}/processing` returns the current stage, progress, provider task id, retry count and stable error details. `POST /api/papers/{paperId}/processing/retry` resets the latest failed job. Provider failures are retried up to three times with increasing delay; configuration errors fail immediately.

Stages: `queued`, `normalizing`, `mineru_running`, `deepseek_pending`, `review_required`. Original files, normalized pages, MinerU raw responses, OCR Markdown, layout JSON, DeepSeek JSON, question crops and teacher revisions are stored separately so a re-run never silently destroys confirmed content.

## Security

Provider keys are read only from server environment variables. Logs and API responses must never contain Authorization headers or signed MinerU upload URLs. Rotate any key that has been copied into chat, issue trackers or shared logs.
