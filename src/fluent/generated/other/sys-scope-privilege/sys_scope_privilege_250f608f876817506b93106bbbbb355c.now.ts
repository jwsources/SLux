import { CrossScopePrivilege } from '@servicenow/sdk/core'

CrossScopePrivilege({
    $id: Now.ID['250f608f876817506b93106bbbbb355c'],
    operation: 'read',
    status: 'allowed',
    targetName: 'wm_order',
    targetScope: 'global',
    targetType: 'sys_db_object',
})
