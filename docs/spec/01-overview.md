# Overview

The DevOps Activity Dashboard is an MVP designed to provide visibility into deployment activity across PRMS platforms.

The first version will display:
- deployment counts per application
- recent deployment executions
- success/failure distribution
- filters by date, job, and result

The solution must support:
- local development
- serverless deployment in AWS 
- the deplyment must to use sam, infra as code
- authentication with Cognito using email/password