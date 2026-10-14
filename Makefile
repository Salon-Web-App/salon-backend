.PHONY: up down migrate seed db-status logs

up:
	docker compose up -d db redis
	docker compose run --rm migrate
	docker compose up -d

down:
	docker compose down

migrate:
	docker compose run --rm migrate

seed:
	docker compose run --rm migrate npm run db:seed

db-status:
	docker compose run --rm migrate npm run db:status

logs:
	docker compose logs -f app worker

test:
	docker compose --profile test run --rm test
	docker compose --profile test rm -sf db-test redis-test