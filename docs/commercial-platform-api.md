# Commercial teaching platform API

Base URL: `http://127.0.0.1:8788/api`

## Identity boundary

Mutating endpoints require `X-User-Id`. Organization-scoped paper endpoints also accept
`X-Organization-Id`. These headers are a development integration boundary, not a complete
authentication system. In production, a verified JWT/session filter or API gateway must derive
the actor and organization; clients must not be trusted to assert arbitrary identities.

## Database initialization

Run `server/src/main/resources/schema.sql` against MySQL before starting the service. The schema
contains normalized tables for papers, questions, parse jobs, teaching tasks, teacher applications,
learning products, recording associations and purchases.

## Papers and AI parse jobs

- `GET /papers`
- `POST /papers` (`multipart/form-data`: `file`, `title`, `subject`, `grade`)
- `GET /papers/{paperId}/questions`
- `PATCH /questions/{questionId}`

Uploading a PDF stores the original file and creates a `teaching_parse_job` in `queued` state. It
does not fabricate AI results. An AI worker should claim queued jobs, update progress, insert
questions and finally set the paper to `review`.

## Customized teaching tasks

- `GET /teaching-tasks?status=&studentId=&teacherId=`
- `POST /teaching-tasks`
- `POST /teaching-tasks/{taskId}/applications`
- `POST /teaching-tasks/{taskId}/assignments/{applicationId}`

Teacher applications are unique per task and teacher. Assignment is transactional: only an open
task can be assigned, the chosen application becomes `accepted`, other applications become
`rejected`, and the task becomes `scheduled`.

## Tldraw recording assets

- `GET /teaching-assets`
- `GET /whiteboard/recordings/{sessionId}`
- `POST /whiteboard/recordings/{sessionId}/audio` (`multipart/form-data`)
- `GET /whiteboard/recordings/{sessionId}/audio`

Business records reference recording `sessionId` values. Tldraw baseline snapshots and event
chunks remain in recording storage and are not duplicated into order or product tables.
Teacher audio is stored as a separate binary object. The recording package stores its URL, MIME
type, duration and start offset; playback uses the audio element as the master clock for tldraw
event application and seeking. Existing databases must apply
`server/src/main/resources/migration/V002__recording_audio.sql`.

## Paid learning products

- `GET /learning-products?status=published&teacherId=`
- `PUT /learning-products/{productId}`
- `POST /learning-products/{productId}/purchases`
- `GET /learning-purchases`

Publishing validates that every associated recording session exists and is ready. Purchases start
in `pending`; a payment provider webhook must mark them paid before content authorization is
granted. Never grant access solely because the browser called the purchase creation endpoint.

## Example task creation

```http
POST /api/teaching-tasks
X-User-Id: student_001
Content-Type: application/json

{
  "studentName": "陈同学",
  "studentGrade": "高三",
  "subject": "数学",
  "title": "三道导数错题直播讲解",
  "description": "重点说明构造函数和分类讨论。",
  "questionCount": 3,
  "serviceType": "直播讲解",
  "expectedAt": "2026-08-12 20:00",
  "budget": 89,
  "tags": ["函数", "导数"]
}
```
