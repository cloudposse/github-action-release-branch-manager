<!-- markdownlint-disable -->

## Inputs

| Name | Description | Default | Required |
|------|-------------|---------|----------|
| dry-run | Run action without pushing changes to upstream | false | false |
| git-user-email | Git user email that will be used for git config | actions-bot@users.noreply.github.com | false |
| git-user-name | Git user name that will be used for git config | actions-bot | false |
| log-level | Log level for this action. Available options: ['off', 'error', 'warn', 'info', 'debug']. Default 'info' | info | false |
| token | GitHub Personal Access Token (PAT) used to work with repository | N/A | true |


## Outputs

| Name | Description |
|------|-------------|
| response | Response in json format for example: {"succeeded":true,"reason":"CREATED\_BRANCHES","message":"Successfully created release branches","data":{"release/v3":"3.1.0","release/v2":"2.0.0","release/v1":"1.1.0"}} |
<!-- markdownlint-restore -->
