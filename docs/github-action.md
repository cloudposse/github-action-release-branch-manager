<!-- markdownlint-disable -->

## Inputs

| Name | Description | Default | Required |
|------|-------------|---------|----------|
| log-level | Log level for this action. Available options: ['off', 'error', 'warn', 'info', 'debug']. Default 'info' | info | false |


## Outputs

| Name | Description |
|------|-------------|
| response | Response in json format for example: {"succeeded":true,"reason":"CREATED\_BRANCHES","message":"Successfully created release branches","data":{"release/v3":"3.1.0","release/v2":"2.0.0","release/v1":"1.1.0"}} |
<!-- markdownlint-restore -->
