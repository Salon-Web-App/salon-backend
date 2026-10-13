
set -euo pipefail

REGION="ap-south-1"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
REPO="${REGISTRY}/salon-app"

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty. Commit or stash before pushing." >&2
  exit 1
fi

SHA="$(git rev-parse --short HEAD)"

aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

docker build --target runtime --build-arg GIT_SHA="$SHA" \
  -t "${REPO}:backend-${SHA}" .

docker tag "${REPO}:backend-${SHA}" "${REPO}:app-${SHA}"
docker tag "${REPO}:backend-${SHA}" "${REPO}:worker-${SHA}"

docker push "${REPO}:backend-${SHA}"
docker push "${REPO}:app-${SHA}"
docker push "${REPO}:worker-${SHA}"

echo "Pushed ${REPO}:backend-${SHA}"