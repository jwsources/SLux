import { CrossScopePrivilege } from '@servicenow/sdk/core'

CrossScopePrivilege({
    $id: Now.ID['0c0881d787ec17106b93106bbbbb3576'],
    operation: 'read',
    status: 'allowed',
    targetName: 'sys_generative_ai_log',
    targetScope: 'global',
    targetType: 'sys_db_object',
})
