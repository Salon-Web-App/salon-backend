# Local production-like stack

Runs the production images behind nginx, routed the same way as the ALB.

```
browser ──► nginx :8080
             ├─ /api/*        ─► backend × 2
             ├─ /backoffice*  ─► backend × 2
             └─ /             ─► frontend
            worker
            postgres · redis
            migrate (runs once before backend/worker start)
```

Expects `backend/` and `frontend/` checked out side by side. Secrets are read
from `backend/.env`.

## Run

```bash
make stack-up
cd stack && docker compose run --rm migrate npm run db:seed
```

Open http://localhost:8080 (site) and http://localhost:8080/backoffice (admin).

```bash
make stack-logs    # api + worker logs
make stack-down
make stack-reset   # also drops the stack database
```

## Checks

| Check             | Command                                                                                                                       | Expected                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Load spread       | `for i in $(seq 10); do curl -s -o /dev/null -D - localhost:8080/api/services \| grep -i x-upstream; done \| sort \| uniq -c` | two upstreams                |
| Shared rate limit | 7× wrong `POST /api/admin/auth/login`                                                                                         | 401 … then 429               |
| Replica stop      | `docker stop salon-stack-backend-1` during a curl loop                                                                        | only 200s, exit code 0       |
| Clean shutdown    | `docker compose down`                                                                                                         | every container stops in ~1s |
