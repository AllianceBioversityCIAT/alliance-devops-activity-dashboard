# Infrastructure (Phase 5)

This directory contains the AWS SAM template for MVP infrastructure:

- Backend: Lambda + API Gateway (HTTP API) + IAM
- Frontend: S3 + CloudFront

## Template

- `infra/sam/template.yaml`

## Environment configs

- `infra/env/local.toml`
- `infra/env/dev.toml`
- `infra/env/prod.toml`

Each file uses SAM config format (`[default.deploy.parameters]`) and must be updated with real values before deployment.

## Validate (no deploy)

```bash
cd infra/sam
sam validate --template-file template.yaml
```

## Build (no deploy)

```bash
cd infra/sam
sam build --template-file template.yaml
```

## Deploy examples

```bash
cd infra/sam
sam deploy --template-file template.yaml --config-file ../env/dev.toml
```

```bash
cd infra/sam
sam deploy --template-file template.yaml --config-file ../env/prod.toml
```

## Notes

- Keep secrets out of source control. Replace placeholder values via CI/CD or secure parameter injection.
- For MVP, backend runtime uses explicit AWS credentials from environment variables to match current backend configuration.
